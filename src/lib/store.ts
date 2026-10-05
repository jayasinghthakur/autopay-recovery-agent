import { CUSTOMERS, FAILURES, type CustomerRecord } from "@/data/customers";
import { addDays, istDate, maskPhone } from "@/lib/format";
import { kv } from "@/lib/kv";
import type {
  ActivityEvent,
  CallRecord,
  CustomerState,
  CustomerView,
  DisplayStatus,
  Outcome,
  PaymentLink,
  SimulatedSms,
} from "@/lib/types";

const K = {
  version: "avr:version",
  state: (cid: string) => `avr:state:${cid}`,
  call: (id: string) => `avr:call:${id}`,
  lastCall: (cid: string) => `avr:lastcall:${cid}`,
  link: (id: string) => `avr:link:${id}`,
  events: "avr:events",
  sms: "avr:sms",
};

const ACTIVE_CALL_STATUSES = new Set(["scheduled", "queued", "ringing", "in-progress", "forwarding"]);

async function bump() {
  await kv().incr(K.version);
}

export async function getVersion(): Promise<number> {
  return Number((await kv().get<number>(K.version)) ?? 0);
}

// ---------- customer facts derived from the static record ----------

export function customerFacts(c: CustomerRecord) {
  const today = istDate();
  const failedOn = addDays(today, -c.failure.failedDaysAgo);
  const latestRetryDate = addDays(failedOn, c.graceDays);
  return {
    failedOn,
    latestRetryDate,
    servicePauseDate: addDays(latestRetryDate, 1),
    failure: FAILURES[c.failure.code],
  };
}

// ---------- customer state ----------

export async function getState(cid: string): Promise<CustomerState> {
  return (await kv().get<CustomerState>(K.state(cid))) ?? {};
}

export async function patchState(cid: string, patch: Partial<CustomerState>): Promise<CustomerState> {
  const next = { ...(await getState(cid)), ...patch };
  await kv().set(K.state(cid), next);
  await bump();
  return next;
}

export async function setOutcome(cid: string, outcome: Outcome, note?: string, callId?: string, extra: Partial<CustomerState> = {}) {
  return patchState(cid, {
    outcome,
    outcomeNote: note,
    outcomeAt: new Date().toISOString(),
    outcomeCallId: callId,
    ...extra,
  });
}

// ---------- calls ----------

export async function getCall(id: string): Promise<CallRecord | null> {
  return kv().get<CallRecord>(K.call(id));
}

export async function upsertCall(id: string, customerId: string, patch: Partial<CallRecord>): Promise<CallRecord> {
  const now = new Date().toISOString();
  const existing = await getCall(id);
  const next: CallRecord = {
    channel: "web",
    status: "queued",
    createdAt: now,
    ...existing,
    ...patch,
    id,
    customerId,
    updatedAt: now,
  };
  await kv().set(K.call(id), next, 60 * 60 * 24 * 30);
  if (!existing) await kv().set(K.lastCall(customerId), id);
  await bump();
  return next;
}

export function isCallActive(call?: CallRecord | null): boolean {
  if (!call || !ACTIVE_CALL_STATUSES.has(call.status)) return false;
  // Guard against a missed "ended" webhook leaving a customer stuck "in call" forever.
  return Date.now() - new Date(call.updatedAt).getTime() < 15 * 60 * 1000;
}

export async function getLastCall(cid: string): Promise<CallRecord | null> {
  const id = await kv().get<string>(K.lastCall(cid));
  return id ? getCall(String(id)) : null;
}

// ---------- payment links ----------

export async function saveLink(cid: string, link: PaymentLink) {
  await kv().set(K.link(link.id), { customerId: cid, ...link }, 60 * 60 * 24 * 30);
}

export async function getLink(id: string): Promise<(PaymentLink & { customerId: string }) | null> {
  return kv().get(K.link(id));
}

// ---------- activity + simulated SMS ----------

export async function logEvent(e: Omit<ActivityEvent, "ts">) {
  await kv().lpush(K.events, { ts: new Date().toISOString(), ...e }, 200);
  await bump();
}

export async function sendSimulatedSms(c: CustomerRecord, body: string, url?: string) {
  const sms: SimulatedSms = { ts: new Date().toISOString(), customerId: c.id, to: maskPhone(c.phone), body, url };
  await kv().lpush(K.sms, sms, 50);
  await bump();
}

// ---------- dashboard snapshot ----------

export function displayStatus(state: CustomerState, lastCall: CallRecord | null): DisplayStatus {
  if (state.paid) return "recovered";
  if (isCallActive(lastCall)) return "in_call";
  switch (state.outcome) {
    case "link_sent":
      return "awaiting_payment";
    case "retry_scheduled":
      return "retry_scheduled";
    case "callback_scheduled":
      return "callback";
    case "dispute":
    case "cancellation_request":
    case "hardship":
    case "escalate_to_human":
      return "escalated";
    case "do_not_call":
      return "do_not_call";
    case undefined:
      return "pending";
    default:
      return "follow_up";
  }
}

export async function buildCustomerViews(): Promise<CustomerView[]> {
  const store = kv();
  const ids = CUSTOMERS.map((c) => c.id);
  const [states, lastCallIds] = await Promise.all([
    store.mget<CustomerState>(ids.map(K.state)),
    store.mget<string>(ids.map(K.lastCall)),
  ]);
  const callKeys = lastCallIds.map((id) => (id ? K.call(String(id)) : null));
  const calls = await store.mget<CallRecord>(callKeys.filter((k): k is string => Boolean(k)));
  let ci = 0;
  const lastCalls = callKeys.map((k) => (k ? calls[ci++] : null));

  return CUSTOMERS.map((c, i) => {
    const facts = customerFacts(c);
    const state = states[i] ?? {};
    const lastCall = lastCalls[i] ?? null;
    return {
      id: c.id,
      name: c.name,
      firstName: c.firstName,
      phoneMasked: maskPhone(c.phone),
      language: c.language,
      merchant: c.merchant,
      category: c.category,
      plan: c.plan,
      amount: c.amount,
      mandate: c.mandate,
      failure: {
        code: c.failure.code,
        label: facts.failure.label,
        explanation: facts.failure.explanation,
        failedOn: facts.failedOn,
        debitAttempts: c.failure.debitAttempts,
      },
      latestRetryDate: facts.latestRetryDate,
      demoHint: c.demoHint,
      verificationHint: `Year of birth: ${c.yearOfBirth}`,
      state,
      lastCall: lastCall ?? undefined,
      status: displayStatus(state, lastCall),
    };
  });
}

export async function getActivity() {
  const [events, sms] = await Promise.all([
    kv().lrange<ActivityEvent>(K.events, 60),
    kv().lrange<SimulatedSms>(K.sms, 20),
  ]);
  return { events, sms };
}

export async function resetDemo() {
  const keys = await kv().keys("avr:*");
  // Keep the cached Vapi assistant id (avoids a re-sync) and the version counter
  // (so open dashboards notice the reset instead of seeing an "unchanged" version).
  await kv().del(keys.filter((k) => k !== "avr:vapi:assistant" && k !== K.version));
  await bump();
}
