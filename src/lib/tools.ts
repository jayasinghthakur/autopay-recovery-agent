import { findCustomer, type CustomerRecord } from "@/data/customers";
import { addDays, formatINR, istDate, istHour, last4, rupeesInWords, spokenDate } from "@/lib/format";
import { kv } from "@/lib/kv";
import { markPaid } from "@/lib/payments";
import { createPaymentLink, fetchLinkStatus } from "@/lib/razorpay";
import { customerFacts, getState, logEvent, saveLink, sendSimulatedSms, setOutcome } from "@/lib/store";
import type { Outcome } from "@/lib/types";

/**
 * Business logic behind every tool the voice agent can call. All rules (verification,
 * retry windows, calling hours, idempotency) are enforced HERE, not in the prompt, so the
 * model cannot promise something the system won't honour.
 */

export interface ToolContext {
  callId?: string;
  /** Customer bound to the call by our server when it started. Wins over model-supplied IDs. */
  customerId?: string;
  baseUrl: string;
}

type Args = Record<string, unknown>;
type Result = Record<string, unknown>;

const MAX_VERIFY_ATTEMPTS = 3;

function verifyKey(ctx: ToolContext, cid: string) {
  return `avr:verify:${ctx.callId ?? "nocall"}:${cid}`;
}

async function getVerification(ctx: ToolContext, cid: string) {
  return (await kv().get<{ attempts: number; verified: boolean }>(verifyKey(ctx, cid))) ?? { attempts: 0, verified: false };
}

const NOT_VERIFIED: Result = {
  error: "identity_not_verified",
  instruction: "You must verify the customer's identity with verify_identity before doing this.",
};

function accountDetails(c: CustomerRecord) {
  const f = customerFacts(c);
  return {
    merchant: c.merchant,
    plan: c.plan,
    amount_due: formatINR(c.amount),
    amount_due_spoken: rupeesInWords(c.amount),
    payment_method: `${c.mandate.method} (${c.mandate.instrument})`,
    ...(c.mandate.maxAmount ? { mandate_limit_spoken: rupeesInWords(c.mandate.maxAmount) } : {}),
    failed_on: spokenDate(f.failedOn),
    debit_attempts: c.failure.debitAttempts,
    failure_reason: f.failure.explanation,
    retry_possible_on_current_mandate: f.failure.retryable,
    latest_retry_date: f.latestRetryDate,
    latest_retry_date_spoken: spokenDate(f.latestRetryDate),
    service_pause_date_spoken: spokenDate(f.servicePauseDate),
    registered_mobile_ending: last4(c.phone),
  };
}

async function verifyIdentity(c: CustomerRecord, args: Args, ctx: ToolContext): Promise<Result> {
  const key = verifyKey(ctx, c.id);
  const v = await getVerification(ctx, c.id);
  const state = await getState(c.id);

  const success = (): Result => ({
    verified: true,
    account: accountDetails(c),
    history: {
      already_paid: Boolean(state.paid),
      payment_link_already_sent: state.paymentLink?.status === "created",
      retry_already_scheduled_for: state.retryDate ? spokenDate(state.retryDate) : null,
    },
    allowed_actions: customerFacts(c).failure.actions,
    instruction: state.paid
      ? "Payment has already been received. Thank them, confirm nothing is due, and end the call."
      : "Thank them. Explain the situation in one or two sentences, then ask how they would like to resolve it.",
  });

  if (v.verified) return success();
  if (v.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { verified: false, attempts_left: 0, instruction: "Verification is locked for this call. Do not share details; end the call politely." };
  }

  const year = String(args.year_of_birth ?? "").replace(/\D/g, "");
  if (year.length !== 4) {
    return { verified: false, instruction: "Ask for the full four-digit year of birth, e.g. nineteen ninety-four." };
  }

  const attempts = v.attempts + 1;
  const ok = Number(year) === c.yearOfBirth;
  await kv().set(key, { attempts, verified: ok }, 60 * 60);

  if (ok) {
    await logEvent({ customerId: c.id, callId: ctx.callId, kind: "tool", text: "Identity verified (year of birth)" });
    return success();
  }

  const left = MAX_VERIFY_ATTEMPTS - attempts;
  if (left > 0) {
    await logEvent({ customerId: c.id, callId: ctx.callId, kind: "tool", text: `Verification failed (${left} attempt${left > 1 ? "s" : ""} left)` });
    return {
      verified: false,
      attempts_left: left,
      instruction: "That didn't match. Politely ask them to check and try once more. Never reveal or hint at the correct year.",
    };
  }
  await setOutcome(c.id, "not_verified", "Failed identity verification 3 times", ctx.callId);
  await logEvent({ customerId: c.id, callId: ctx.callId, kind: "outcome", text: "Verification failed 3 times — no details disclosed" });
  return {
    verified: false,
    attempts_left: 0,
    instruction: `For security you cannot discuss the account. Suggest they contact ${c.merchant} support through the app or website, then end the call politely.`,
  };
}

async function sendPaymentLink(c: CustomerRecord, args: Args, ctx: ToolContext): Promise<Result> {
  if (!(await getVerification(ctx, c.id)).verified) return NOT_VERIFIED;
  const state = await getState(c.id);
  if (state.paid) return { sent: false, already_paid: true, instruction: "The payment is already received. Tell them nothing is due." };

  const type = args.link_type === "update_mandate" ? "update_mandate" : "pay_now";
  const ending = last4(c.phone);
  const explain =
    type === "update_mandate"
      ? "Explain the link lets them pay this bill now and set up autopay again, so future payments go through."
      : "Explain the link opens a secure Razorpay checkout where they can pay by UPI, card or net banking.";

  // Idempotency: don't spam the customer with a new link if a fresh one is still open.
  const existing = state.paymentLink;
  if (existing && existing.status === "created" && existing.type === type && Date.now() - new Date(existing.createdAt).getTime() < 24 * 3600 * 1000) {
    await sendSimulatedSms(c, `${c.merchant}: Reminder — pay ${formatINR(c.amount)} for your ${c.plan} here: ${existing.url}`, existing.url);
    await logEvent({ customerId: c.id, callId: ctx.callId, kind: "tool", text: "Existing payment link re-sent by SMS" });
    return { sent: true, reused_existing_link: true, sent_to: `registered mobile ending ${ending}`, instruction: `Tell them you've re-sent the same secure link. ${explain} Offer to stay on the line while they pay.` };
  }

  const link = await createPaymentLink({ customer: c, type, baseUrl: ctx.baseUrl, callId: ctx.callId });
  await saveLink(c.id, link);
  await setOutcome(c.id, "link_sent", type === "update_mandate" ? "Pay + re-authorise autopay link sent" : "Pay-now link sent", ctx.callId, {
    paymentLink: link,
  });
  const action = type === "update_mandate" ? "pay and set up autopay again" : "pay securely";
  await sendSimulatedSms(c, `${c.merchant}: Hi ${c.firstName}, your autopay of ${formatINR(c.amount)} for ${c.plan} didn't go through. Tap to ${action}: ${link.url}`, link.url);
  await logEvent({
    customerId: c.id,
    callId: ctx.callId,
    kind: "tool",
    text: `${type === "update_mandate" ? "Mandate update" : "Payment"} link created (${link.provider === "razorpay" ? "Razorpay test mode" : "mock"}) and sent by SMS`,
  });
  return {
    sent: true,
    sent_to: `registered mobile ending ${ending}`,
    link_valid_for: "3 days",
    instruction: `Tell them the secure link has been sent by SMS to the number ending ${ending.split("").join(" ")}. ${explain} Offer to stay on the line while they pay.`,
  };
}

async function scheduleRetry(c: CustomerRecord, args: Args, ctx: ToolContext): Promise<Result> {
  if (!(await getVerification(ctx, c.id)).verified) return NOT_VERIFIED;
  const f = customerFacts(c);
  if (!f.failure.retryable) {
    return {
      scheduled: false,
      instruction: `A retry would fail again because ${f.failure.explanation}. Offer the update_mandate link instead.`,
    };
  }
  const date = String(args.retry_date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { scheduled: false, instruction: "Ask which date works and pass it as YYYY-MM-DD." };

  const tomorrow = addDays(istDate(), 1);
  if (date < tomorrow) return { scheduled: false, instruction: "The retry date must be tomorrow or later. Ask for another date." };
  if (date > f.latestRetryDate) {
    return {
      scheduled: false,
      latest_retry_date_spoken: spokenDate(f.latestRetryDate),
      instruction: `The latest possible retry is ${spokenDate(f.latestRetryDate)}, before the service is paused. Ask if that works, or offer a payment link they can use any time. If neither works, record_outcome "hardship".`,
    };
  }

  await setOutcome(c.id, "retry_scheduled", `Auto-debit retry on ${date}`, ctx.callId, { retryDate: date });
  await sendSimulatedSms(c, `${c.merchant}: We'll retry your autopay of ${formatINR(c.amount)} on ${spokenDate(date)}. Please keep sufficient balance in your account.`);
  await logEvent({ customerId: c.id, callId: ctx.callId, kind: "tool", text: `Auto-debit retry scheduled for ${spokenDate(date)}` });
  return {
    scheduled: true,
    retry_date_spoken: spokenDate(date),
    instruction:
      c.failure.code === "MANDATE_PAUSED"
        ? "Confirm the date, and remind them to resume the autopay mandate in their UPI app before then."
        : "Confirm the date and ask them to keep the balance ready. Mention they'll get an SMS confirmation.",
  };
}

async function scheduleCallback(c: CustomerRecord, args: Args, ctx: ToolContext): Promise<Result> {
  let raw = String(args.callback_at ?? "").trim();
  if (raw && !/(Z|[+-]\d{2}:?\d{2})$/.test(raw)) raw += "+05:30"; // model gave a local time: treat as IST
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return { scheduled: false, instruction: "Ask what day and time suits them." };

  const now = Date.now();
  const h = istHour(at);
  if (at.getTime() < now + 5 * 60 * 1000 || at.getTime() > now + 7 * 24 * 3600 * 1000) {
    return { scheduled: false, instruction: "The callback must be later today or within the next 7 days. Ask for another time." };
  }
  if (h < 8 || h >= 19) {
    return { scheduled: false, instruction: "We only call between 8 AM and 7 PM. Ask for a time in that window." };
  }

  const spoken = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(at);
  await setOutcome(c.id, "callback_scheduled", `Callback ${spoken} IST`, ctx.callId, { callbackAt: at.toISOString() });
  await logEvent({ customerId: c.id, callId: ctx.callId, kind: "tool", text: `Callback scheduled for ${spoken} IST` });
  return { scheduled: true, callback_spoken: spoken, instruction: "Confirm the callback time, thank them, and end the call." };
}

async function checkPaymentStatus(c: CustomerRecord, _args: Args, ctx: ToolContext): Promise<Result> {
  if (!(await getVerification(ctx, c.id)).verified) return NOT_VERIFIED;
  let state = await getState(c.id);
  const link = state.paymentLink;
  if (!state.paid && link?.provider === "razorpay") {
    try {
      const live = await fetchLinkStatus(link.id);
      if (live.status === "paid") {
        await markPaid(link.id, { paymentId: live.paymentId, via: "razorpay" });
        state = await getState(c.id);
      }
    } catch {
      // fall through to the stored status
    }
  }
  if (state.paid) {
    return {
      paid: true,
      amount_spoken: rupeesInWords(state.paid.amount),
      instruction: "Confirm the payment was received, thank them warmly, and end the call.",
    };
  }
  if (!link) return { paid: false, instruction: "No payment link has been sent yet. Offer to send one." };
  return {
    paid: false,
    instruction: "The payment hasn't shown up yet. It can take a minute — offer to wait briefly and check again, or tell them they'll get an SMS confirmation once it's through.",
  };
}

const OUTCOME_INSTRUCTIONS: Record<string, string> = {
  dispute:
    "Tell them a billing specialist will review the transaction within 2 working days and no further auto-debit will be attempted until then. Do not ask them to pay.",
  cancellation_request:
    "Confirm their cancellation request has been passed to the team, who will confirm by email. No further autopay attempts will be made.",
  hardship:
    "Thank them for sharing. Tell them a specialist will call within 2 working days to discuss options, and retries are paused until then.",
  escalate_to_human: "Tell them a team member will call them back within one working day.",
  do_not_call: "Confirm they won't receive more calls about this, apologise for the disturbance, and end the call.",
  wrong_person: "Apologise for the trouble and end the call. Do not share any details.",
  refused: "Acknowledge respectfully. Mention they can pay any time from the app, then end the call.",
};

async function recordOutcome(c: CustomerRecord, args: Args, ctx: ToolContext): Promise<Result> {
  const outcome = String(args.outcome ?? "") as Outcome;
  if (!(outcome in OUTCOME_INSTRUCTIONS)) {
    return { recorded: false, instruction: `Unknown outcome. Use one of: ${Object.keys(OUTCOME_INSTRUCTIONS).join(", ")}.` };
  }
  const notes = String(args.notes ?? "").slice(0, 300);
  await setOutcome(c.id, outcome, notes, ctx.callId, outcome === "do_not_call" ? { doNotCall: true } : {});
  await logEvent({ customerId: c.id, callId: ctx.callId, kind: "outcome", text: `Outcome: ${outcome.replace(/_/g, " ")}${notes ? ` — ${notes}` : ""}` });
  return { recorded: true, instruction: OUTCOME_INSTRUCTIONS[outcome] };
}

const HANDLERS: Record<string, (c: CustomerRecord, args: Args, ctx: ToolContext) => Promise<Result>> = {
  verify_identity: verifyIdentity,
  send_payment_link: sendPaymentLink,
  schedule_payment_retry: scheduleRetry,
  schedule_callback: scheduleCallback,
  check_payment_status: checkPaymentStatus,
  record_outcome: recordOutcome,
};

export async function runTool(name: string, args: Args, ctx: ToolContext): Promise<Result> {
  const handler = HANDLERS[name];
  if (!handler) return { error: `unknown_tool:${name}` };
  // The customer bound to the call by the server wins, so a confused or manipulated model
  // can't act on someone else's account by passing a different ID.
  const customer = findCustomer(ctx.customerId) ?? findCustomer(String(args.customer_id ?? ""));
  if (!customer) return { error: "unknown_customer", instruction: "Apologise and say you're unable to access the account right now." };
  return handler(customer, args, { ...ctx, customerId: customer.id });
}
