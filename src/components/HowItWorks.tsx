const FLOW = [
  { t: "Failed autopay", d: "Mandate debit fails (low balance, expired card, limit, revoked…)" },
  { t: "Voice agent calls", d: "Vapi: STT → LLM → TTS, browser or phone, discloses it's an AI" },
  { t: "Server-side verify", d: "Year of birth checked by our API; no details before it passes" },
  { t: "Right fix per reason", d: "Pay link · re-authorise mandate · retry date · callback · escalate" },
  { t: "Razorpay link", d: "Test-mode Payment Link, signature-verified callback / webhook" },
  { t: "Recovered", d: "Dashboard updates live; post-call summary + compliance QA" },
];

const GUARDRAILS = [
  ["Only my number", "Every outbound call dials one allow-listed number the operator owns. Fictional records use invalid numbers that can't be dialled."],
  ["Verify before disclosing", "The amount and reason are only returned by the verify_identity tool after the check passes on the server. The model never sees the answer."],
  ["Rules in code, not the prompt", "Retry windows, non-retryable failures, calling hours and callback slots are validated by the API, so the agent can't promise what the system won't honour."],
  ["Fair-collection conduct", "No threats, shaming or credit-score talk; no OTP/PIN/CVV requests; calls only 8 AM–7 PM IST; do-not-call is honoured immediately and blocks future calls."],
  ["Bound to one customer", "Tool calls act on the customer bound to the call by the server, so a confused or manipulated model can't touch another account."],
  ["Idempotent & safe", "Tool calls are de-duplicated by ID, open payment links are reused instead of re-sent, and Razorpay callbacks/webhooks are signature-checked."],
];

export default function HowItWorks() {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-slate-900">How it works</h2>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {FLOW.map((s, i) => (
          <li key={s.t} className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
            <p className="text-[10px] font-semibold text-blue-600">STEP {i + 1}</p>
            <p className="text-sm font-medium text-slate-900">{s.t}</p>
            <p className="mt-0.5 text-xs text-slate-500">{s.d}</p>
          </li>
        ))}
      </ol>
      <h3 className="mt-6 text-sm font-semibold text-slate-900">Guardrails</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GUARDRAILS.map(([t, d]) => (
          <div key={t} className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-900">{t}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
