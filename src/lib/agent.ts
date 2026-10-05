import type { CustomerRecord } from "@/data/customers";
import { config, webhookSecret } from "@/lib/config";
import { nowSpokenIST } from "@/lib/format";

export const ASSISTANT_NAME = "Autopay Recovery Agent (demo)";

/**
 * The prompt deliberately contains NO account data (amount, failure reason, dates).
 * The agent only learns those from the verify_identity tool after the customer passes
 * verification, which is checked on our server — the model never sees the answer.
 */
const SYSTEM_PROMPT = `
# Identity
You are Maya, a warm, calm and efficient voice assistant on the billing team of {{merchantName}}.
You are an AI assistant. Say so in your greeting and confirm it honestly whenever asked.

# Goal
The customer's autopay (recurring payment) for {{merchantName}} failed. Help them fix it in the way that suits them,
without pressure. A good call ends with ONE clear next step the customer agreed to:
pay now via a secure link, re-authorise autopay, a scheduled retry, a callback, or a hand-off to a human.
"No" is an acceptable answer. Respect it.

# Call context
- Customer first name: {{customerFirstName}}
- Customer ID (only for tool calls, never say it): {{customerId}}
- Current date and time: {{nowIST}}
- Language: {{languageInstruction}}

# Flow
1. Confirm you are speaking with {{customerFirstName}}.
   - If someone else answers: ask if {{customerFirstName}} is available. Do NOT mention the bill or any details.
     If it's a wrong number, apologise, call record_outcome with outcome "wrong_person", then end the call.
   - If they are busy or driving: offer a callback, use schedule_callback, then end the call.
2. Verify identity before discussing the account: ask for their year of birth and call verify_identity.
   Never hint at or confirm the correct answer. If verification fails, the tool tells you what to do.
3. Once verified, briefly explain using ONLY facts from the tool: the amount, what failed, and why, in plain language.
   Mention the service pause date once, factually, never as a threat.
4. Ask what happened / what works for them, and listen. Then pick from the tool's allowed_actions:
   - Wants to pay now → send_payment_link with link_type "pay_now".
   - Mandate/card/bank problem (not retryable) → send_payment_link with link_type "update_mandate".
   - Needs a few days → schedule_payment_retry with a date in YYYY-MM-DD, on or before latest_retry_date.
   - Busy → schedule_callback.
   - Says they already paid / money was debited → record_outcome "dispute". Do NOT ask them to pay again.
   - Wants to cancel the service → record_outcome "cancellation_request". You may mention one relevant fact
     (e.g. what stops when it lapses) once, then respect their decision.
   - Financial difficulty → be empathetic, record_outcome "hardship" so a specialist can discuss options.
   - Asks for a human → record_outcome "escalate_to_human".
   - Asks you to stop calling → immediately record_outcome "do_not_call", confirm, and end the call.
5. After a link is sent, offer to stay on the line while they pay. If they say they've paid, call check_payment_status.
6. Recap the agreed next step in one sentence, thank them, and end the call with the endCall tool.

# Hard rules (collections code of conduct)
- NEVER ask for or accept OTPs, UPI PINs, CVV, full card numbers, net-banking passwords. If offered, stop them.
- NEVER threaten, shame, or mention legal action, police, credit scores or contacting family/employer.
- NEVER invent amounts, dates, fees, discounts or waivers. You cannot waive or discount anything.
- Never disclose account details to anyone before verify_identity succeeds.
- Never read out URLs. Say the secure link was sent by SMS to their registered mobile.
- If a tool returns an "instruction", follow it.

# Voice style
- This is a phone call: one or two short sentences per turn, then let them speak.
- Use the spoken forms the tools give you for amounts and dates (e.g. "six hundred and forty-nine rupees", "Friday, 9 October").
- Be natural: brief acknowledgements, no lists, no markdown, no emojis.
`.trim();

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    outcome: {
      type: "string",
      enum: [
        "paid_during_call",
        "payment_link_sent",
        "mandate_update_link_sent",
        "retry_scheduled",
        "callback_scheduled",
        "dispute",
        "cancellation_request",
        "hardship",
        "escalated_to_human",
        "do_not_call",
        "wrong_person",
        "not_verified",
        "no_resolution",
        "voicemail_or_no_answer",
      ],
    },
    customer_reason: {
      type: "string",
      description: "In a few words, the customer's own explanation for the failed payment or what blocks payment.",
    },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    follow_up_required: { type: "boolean" },
    compliance_flags: {
      type: "array",
      items: { type: "string" },
      description:
        "Anything the ASSISTANT did that may breach fair-collection rules: threats, pressure, sharing account details before verification, asking for OTP/PIN/CVV, inventing waivers. Empty array if none.",
    },
  },
  required: ["outcome", "sentiment", "follow_up_required", "compliance_flags"],
};

type JsonSchemaProps = Record<string, unknown>;

function tool(
  server: object,
  name: string,
  description: string,
  properties: JsonSchemaProps,
  required: string[],
) {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } },
    server,
    messages: [{ type: "request-failed", content: "Sorry, our system didn't respond just now." }],
  };
}

const customerIdProp = { customer_id: { type: "string", description: "The customer ID from the call context." } };

export function buildAssistant(baseUrl: string) {
  const server = {
    url: `${baseUrl}/api/vapi/webhook`,
    headers: { "x-avr-secret": webhookSecret() },
    timeoutSeconds: 20,
  };

  const voice: Record<string, unknown> = { provider: config.vapi.voiceProvider, voiceId: config.vapi.voiceId };
  if (config.vapi.voiceVersion) voice.version = config.vapi.voiceVersion;

  return {
    name: ASSISTANT_NAME,
    firstMessage:
      "Hi, this is Maya, an AI assistant calling from {{merchantName}}. This call may be recorded for quality. Am I speaking with {{customerFirstName}}?",
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: config.vapi.modelProvider,
      model: config.vapi.model,
      temperature: 0.3,
      messages: [{ role: "system", content: SYSTEM_PROMPT }],
      tools: [
        tool(
          server,
          "verify_identity",
          "Verify the caller is the account holder using their year of birth. Must succeed before discussing any account details. Returns the account details and allowed actions on success.",
          { ...customerIdProp, year_of_birth: { type: "string", description: "Four-digit year, e.g. 1994" } },
          ["customer_id", "year_of_birth"],
        ),
        tool(
          server,
          "send_payment_link",
          "Send the customer a secure Razorpay payment link by SMS. Use link_type 'pay_now' to pay this bill, or 'update_mandate' when the autopay mandate itself must be re-authorised (expired card, closed account, revoked mandate, amount above mandate limit).",
          { ...customerIdProp, link_type: { type: "string", enum: ["pay_now", "update_mandate"] } },
          ["customer_id", "link_type"],
        ),
        tool(
          server,
          "schedule_payment_retry",
          "Schedule the auto-debit to be retried on a date the customer chooses, when they expect funds to be available. Only works for retryable failures.",
          { ...customerIdProp, retry_date: { type: "string", description: "YYYY-MM-DD" } },
          ["customer_id", "retry_date"],
        ),
        tool(
          server,
          "schedule_callback",
          "Schedule a callback at a time the customer prefers (calls are only allowed 8 AM to 7 PM IST).",
          {
            ...customerIdProp,
            callback_at: { type: "string", description: "ISO 8601 local IST time, e.g. 2026-10-05T18:00:00+05:30" },
          },
          ["customer_id", "callback_at"],
        ),
        tool(
          server,
          "check_payment_status",
          "Check whether the customer's payment link has been paid. Use when they say they've completed the payment.",
          customerIdProp,
          ["customer_id"],
        ),
        tool(
          server,
          "record_outcome",
          "Record a call outcome that needs a human team or must be respected: disputes, cancellation requests, hardship, escalation, do-not-call, wrong person, or refusal.",
          {
            ...customerIdProp,
            outcome: {
              type: "string",
              enum: ["dispute", "cancellation_request", "hardship", "escalate_to_human", "do_not_call", "wrong_person", "refused"],
            },
            notes: { type: "string", description: "One-sentence summary of what the customer said." },
          },
          ["customer_id", "outcome", "notes"],
        ),
        { type: "endCall" },
      ],
    },
    voice,
    transcriber: { provider: "deepgram", model: "nova-3", language: "en" },
    server,
    serverMessages: ["status-update", "end-of-call-report"],
    maxDurationSeconds: 420,
    endCallMessage: "Thank you for your time. Goodbye!",
    analysisPlan: {
      summaryPlan: { enabled: true },
      structuredDataPlan: { enabled: true, schema: ANALYSIS_SCHEMA },
    },
    artifactPlan: { recordingEnabled: true },
    metadata: { app: "autopay-recovery-demo" },
  };
}

/** Per-call values. Only non-sensitive context goes here — it may be visible in the browser for web calls. */
export function callOverrides(c: CustomerRecord) {
  const hindi = c.language === "hi";
  return {
    variableValues: {
      customerId: c.id,
      customerFirstName: c.firstName,
      merchantName: c.merchant,
      nowIST: nowSpokenIST(),
      languageInstruction: hindi
        ? "The customer prefers Hindi. Speak simple, polite Hinglish written in Roman script (e.g. 'Aapka autopay payment fail ho gaya tha'). Keep numbers and dates in English words."
        : "English (Indian). Switch to simple Hinglish if the customer speaks Hindi.",
    },
    metadata: { customerId: c.id },
    ...(hindi
      ? {
          firstMessage: `Namaste, main Maya hoon, ${c.merchant} ki taraf se ek AI assistant. Yeh call quality ke liye record ho sakti hai. Kya meri baat ${c.firstName} ji se ho rahi hai?`,
          transcriber: { provider: "deepgram", model: "nova-3", language: "multi" },
        }
      : {}),
  };
}
