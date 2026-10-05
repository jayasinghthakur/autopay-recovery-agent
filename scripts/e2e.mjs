// Simulates Vapi webhook traffic against a running server to exercise the full recovery flow
// (verification, payment links, retries, callbacks, do-not-call, payments, idempotency) with no
// voice provider or phone involved. See README → "Automated checks" for how to start the server.
//
//   BASE_URL=http://localhost:3100 SECRET=testsecret PASSCODE=demo node scripts/e2e.mjs
//   KEEP=1 skips the final reset so you can look at the populated dashboard.
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SECRET = process.env.SECRET ?? "testsecret";
const PASSCODE = process.env.PASSCODE ?? "demo";
const H = { "Content-Type": "application/json", "x-avr-secret": SECRET };
let n = 0;
const results = [];
const check = (name, cond, extra = "") => {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  — ${extra}` : ""}`);
};

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/state`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server not up");
}

function callObj(callId, customerId, type = "webCall") {
  return { id: callId, type, assistantOverrides: { variableValues: { customerId } } };
}

async function tool(callId, customerId, name, args, { asString = false, secret = SECRET } = {}) {
  const id = `tc_${++n}`;
  const res = await fetch(`${BASE}/api/vapi/webhook`, {
    method: "POST",
    headers: { ...H, "x-avr-secret": secret },
    body: JSON.stringify({
      message: {
        type: "tool-calls",
        call: callObj(callId, customerId),
        toolCallList: [{ id, type: "function", function: { name, arguments: asString ? JSON.stringify(args) : args } }],
      },
    }),
  });
  if (res.status !== 200) return { status: res.status };
  const body = await res.json();
  return JSON.parse(body.results[0].result);
}

async function event(message) {
  return fetch(`${BASE}/api/vapi/webhook`, { method: "POST", headers: H, body: JSON.stringify({ message }) });
}

async function state() {
  return (await fetch(`${BASE}/api/state`)).json();
}
const cust = (s, id) => s.customers.find((c) => c.id === id);

await waitUp();

// Auth
const unauth = await tool("call_x", "CUST-1001", "verify_identity", { customer_id: "CUST-1001", year_of_birth: "1994" }, { secret: "nope" });
check("webhook rejects wrong secret", unauth.status === 401);

// --- Aarav: pay now flow ---
const A = "call_aarav";
await event({ type: "status-update", status: "in-progress", call: callObj(A, "CUST-1001") });
let s = await state();
check("status-update marks customer in_call", cust(s, "CUST-1001").status === "in_call");

let r = await tool(A, "CUST-1001", "send_payment_link", { customer_id: "CUST-1001", link_type: "pay_now" });
check("send_payment_link blocked before verification", r.error === "identity_not_verified");

r = await tool(A, "CUST-1001", "verify_identity", { customer_id: "CUST-1001", year_of_birth: "1990" });
check("wrong year rejected, no details leaked", r.verified === false && !r.account && r.attempts_left === 2, JSON.stringify(r).slice(0, 80));

r = await tool(A, "CUST-1001", "verify_identity", { customer_id: "CUST-1001", year_of_birth: "nineteen 94" });
check("non 4-digit year asks again without burning attempt", r.verified === false && r.attempts_left === undefined);

r = await tool(A, "CUST-1001", "verify_identity", { customer_id: "CUST-1001", year_of_birth: "1994" }, { asString: true });
check("correct year verifies (string args)", r.verified === true && r.account?.amount_due === "₹649", r.account?.amount_due_spoken);

const hijack = await tool(A, "CUST-1001", "send_payment_link", { customer_id: "CUST-1005", link_type: "pay_now" });
s = await state();
check("model can't act on another customer (call-bound id wins)", !cust(s, "CUST-1005").state.paymentLink && hijack.sent === true);

const link = cust(s, "CUST-1001").state.paymentLink;
check("mock payment link created for Aarav", link?.provider === "mock" && link.url.includes("/pay/mock_"), link?.url);
check("simulated SMS sent with link", s.sms.some((m) => m.customerId === "CUST-1001" && m.url === link.url));
check("status = awaiting_payment", cust(s, "CUST-1001").status === "in_call" || cust(s, "CUST-1001").status === "awaiting_payment");

r = await tool(A, "CUST-1001", "send_payment_link", { customer_id: "CUST-1001", link_type: "pay_now" });
s = await state();
check("second request reuses the open link (no spam)", r.reused_existing_link === true && cust(s, "CUST-1001").state.paymentLink.id === link.id);

r = await tool(A, "CUST-1001", "check_payment_status", { customer_id: "CUST-1001" });
check("check_payment_status: not yet paid", r.paid === false);

const page = await fetch(link.url.replace(/^https?:\/\/[^/]+/, BASE));
check("mock checkout page renders", page.ok && (await page.text()).includes("649"));

const pay = await fetch(`${BASE}/api/mock-pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ linkId: link.id }) });
check("mock payment succeeds", pay.ok);

r = await tool(A, "CUST-1001", "check_payment_status", { customer_id: "CUST-1001" });
check("check_payment_status: paid during call", r.paid === true, r.amount_spoken);

await event({
  type: "end-of-call-report",
  call: callObj(A, "CUST-1001"),
  endedReason: "assistant-ended-call",
  startedAt: new Date(Date.now() - 95000).toISOString(),
  endedAt: new Date().toISOString(),
  analysis: { summary: "Customer paid via link.", structuredData: { outcome: "paid_during_call", sentiment: "positive", follow_up_required: false, compliance_flags: [] } },
  artifact: { transcript: "AI: Hi...\nUser: Hello", recording: { mono: { combinedUrl: "https://example.com/rec.wav" } } },
  cost: 0.12,
});
s = await state();
const a = cust(s, "CUST-1001");
check("Aarav recovered", a.status === "recovered" && a.state.paid?.amount === 649);
check("end-of-call stored summary/recording/duration", a.lastCall?.summary === "Customer paid via link." && a.lastCall?.recordingUrl && a.lastCall?.durationSec === 95, `dur=${a.lastCall?.durationSec}`);

// --- Priya: card expired -> retry must be refused ---
const P = "call_priya";
await tool(P, "CUST-1002", "verify_identity", { customer_id: "CUST-1002", year_of_birth: "1990" });
r = await tool(P, "CUST-1002", "schedule_payment_retry", { customer_id: "CUST-1002", retry_date: "2099-01-01" });
check("retry refused for non-retryable failure (expired card)", r.scheduled === false && /update_mandate/.test(r.instruction));
r = await tool(P, "CUST-1002", "send_payment_link", { customer_id: "CUST-1002", link_type: "update_mandate" });
s = await state();
check("mandate update link sent", r.sent === true && cust(s, "CUST-1002").state.paymentLink?.type === "update_mandate");

// --- Vikram: retry window validation ---
const V = "call_vikram";
r = await tool(V, "CUST-1005", "verify_identity", { customer_id: "CUST-1005", year_of_birth: "1985" });
const latest = r.account.latest_retry_date;
const plus = (iso, d) => { const x = new Date(iso + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
r = await tool(V, "CUST-1005", "schedule_payment_retry", { customer_id: "CUST-1005", retry_date: plus(latest, 3) });
check("retry beyond grace window refused", r.scheduled === false && r.latest_retry_date_spoken);
r = await tool(V, "CUST-1005", "schedule_payment_retry", { customer_id: "CUST-1005", retry_date: latest });
s = await state();
check("retry within window scheduled", r.scheduled === true && cust(s, "CUST-1005").status === "retry_scheduled", r.retry_date_spoken);

// --- Ananya: callback hours ---
const AN = "call_ananya";
const istTomorrow = plus(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()), 1);
r = await tool(AN, "CUST-1006", "schedule_callback", { customer_id: "CUST-1006", callback_at: `${istTomorrow}T21:00:00` });
check("callback at 9 PM refused (calling hours)", r.scheduled === false);
r = await tool(AN, "CUST-1006", "schedule_callback", { customer_id: "CUST-1006", callback_at: `${istTomorrow}T18:00:00` });
s = await state();
check("callback at 6 PM IST accepted (no offset → IST)", r.scheduled === true && /6:00/.test(r.callback_spoken) && cust(s, "CUST-1006").status === "callback", r.callback_spoken);

// --- Arjun: do not call blocks future calls ---
const AR = "call_arjun";
r = await tool(AR, "CUST-1009", "record_outcome", { customer_id: "CUST-1009", outcome: "do_not_call", notes: "Asked not to be called" });
s = await state();
check("do_not_call recorded", r.recorded === true && cust(s, "CUST-1009").status === "do_not_call");
const OP = { "Content-Type": "application/json", "x-operator-passcode": PASSCODE };
const noPass = await fetch(`${BASE}/api/call`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: "CUST-1007" }) });
check("phone call without operator passcode refused", noPass.status === 401);
const blocked = await fetch(`${BASE}/api/call`, { method: "POST", headers: OP, body: JSON.stringify({ customerId: "CUST-1009" }) });
const bj = await blocked.json();
check("phone call to do-not-call customer refused", blocked.status === 409, bj.error);
const paidCall = await fetch(`${BASE}/api/web-call`, { method: "POST", headers: OP, body: JSON.stringify({ customerId: "CUST-1001" }) });
check("web call to already-paid customer refused", paidCall.status === 409, (await paidCall.json()).error);
const fakeKey = await fetch(`${BASE}/api/call`, { method: "POST", headers: OP, body: JSON.stringify({ customerId: "CUST-1007" }) });
const fk = await fakeKey.json();
check("Vapi API errors surface cleanly (fake key)", fakeKey.status === 502 && /Vapi/.test(fk.error), fk.error?.slice(0, 90));

// --- Verification lockout ---
const L = "call_lock";
for (const y of ["1111", "2222"]) await tool(L, "CUST-1004", "verify_identity", { customer_id: "CUST-1004", year_of_birth: y });
r = await tool(L, "CUST-1004", "verify_identity", { customer_id: "CUST-1004", year_of_birth: "3333" });
const r2 = await tool(L, "CUST-1004", "verify_identity", { customer_id: "CUST-1004", year_of_birth: "1992" });
check("3 failures lock verification for the call", r.attempts_left === 0 && r2.verified === false && !r2.account);

// --- No-answer phone call -> outcome via endedReason ---
await event({ type: "end-of-call-report", call: callObj("call_noans", "CUST-1003", "outboundPhoneCall"), endedReason: "customer-did-not-answer" });
s = await state();
check("no-answer call → follow_up", cust(s, "CUST-1003").status === "follow_up" && cust(s, "CUST-1003").lastCall.channel === "phone");

// --- Duplicate tool call id replays result instead of re-running ---
const dupBody = (id) => JSON.stringify({ message: { type: "tool-calls", call: callObj("call_dup", "CUST-1008"), toolCallList: [{ id, function: { name: "record_outcome", arguments: { customer_id: "CUST-1008", outcome: "dispute", notes: "says debited" } } }] } });
await fetch(`${BASE}/api/vapi/webhook`, { method: "POST", headers: H, body: dupBody("dup1") });
await fetch(`${BASE}/api/vapi/webhook`, { method: "POST", headers: H, body: dupBody("dup1") });
s = await state();
check("duplicate tool call executed once", s.events.filter((e) => e.customerId === "CUST-1008").length === 1);

// --- Version short-circuit ---
const v = s.version;
const un = await (await fetch(`${BASE}/api/state?v=${v}`)).json();
check("state polling short-circuits when unchanged", un.unchanged === true);

// --- Razorpay callback with bad signature ---
const cb = await fetch(`${BASE}/api/razorpay/callback?razorpay_payment_id=pay_x&razorpay_payment_link_id=plink_x&razorpay_payment_link_reference_id=r&razorpay_payment_link_status=paid&razorpay_signature=bad`, { redirect: "manual" });
check("razorpay callback with bad signature not trusted", cb.status === 303 && cb.headers.get("location").includes("invalid_signature"));

// --- Reset ---
if (process.env.KEEP) {
  console.log(results.join("\n"));
  process.exit(results.some((x) => x.startsWith("FAIL")) ? 1 : 0);
}
const rs = await fetch(`${BASE}/api/reset`, { method: "POST", headers: { "x-operator-passcode": PASSCODE } });
s = await state();
check("reset clears state", rs.ok && s.customers.every((c) => c.status === "pending") && s.events.length === 0);

console.log(results.join("\n"));
console.log(`\n${results.filter((x) => x.startsWith("PASS")).length}/${results.length} passed`);
process.exit(results.some((x) => x.startsWith("FAIL")) ? 1 : 0);
