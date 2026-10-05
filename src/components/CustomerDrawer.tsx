"use client";

import { useEffect } from "react";
import type { ActivityEvent, CustomerView } from "@/lib/types";
import { fmtDate, fmtDateTime, fmtTime, inr, outcomeLabel, StatusBadge, statusDetail } from "./ui";

export default function CustomerDrawer(props: {
  c: CustomerView;
  events: ActivityEvent[];
  onClose: () => void;
  onWebCall: () => void;
  onPhoneCall: () => void;
  webDisabled: boolean;
}) {
  const { c, events, onClose } = props;
  const call = c.lastCall;
  const a = call?.analysis;
  const blocked = c.status === "recovered" || c.status === "do_not_call" || c.status === "in_call";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-label="Close" />
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs text-slate-500">{c.id}</p>
            <h2 className="text-lg font-semibold text-slate-900">{c.name}</h2>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={c.status} />
              <span className="text-xs text-slate-500">{statusDetail(c)}</span>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <section className="rounded-lg bg-blue-50 p-4 ring-1 ring-blue-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Role-play brief (you are the customer)</p>
            <p className="mt-2 text-sm text-slate-800">{c.demoHint}</p>
            <p className="mt-2 text-sm">
              <span className="text-slate-600">Verification answer: </span>
              <span className="font-semibold text-slate-900">{c.verificationHint}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">The agent never sees this answer — it is checked on the server.</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={props.onWebCall}
                disabled={props.webDisabled || blocked}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
              >
                Talk in browser
              </button>
              <button
                onClick={props.onPhoneCall}
                disabled={blocked}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100 disabled:text-slate-400"
              >
                Call my phone
              </button>
            </div>
          </section>

          <Section title="Account (fictional)">
            <Fact k="Merchant" v={`${c.merchant} · ${c.category}`} />
            <Fact k="Plan" v={c.plan} />
            <Fact k="Amount due" v={inr(c.amount)} />
            <Fact k="Autopay" v={`${c.mandate.method} — ${c.mandate.instrument}${c.mandate.maxAmount ? ` · limit ${inr(c.mandate.maxAmount)}` : ""}`} />
            <Fact k="Failure" v={`${c.failure.label} on ${fmtDate(c.failure.failedOn)} (${c.failure.debitAttempts} attempt${c.failure.debitAttempts > 1 ? "s" : ""})`} />
            <Fact k="Why" v={c.failure.explanation} />
            <Fact k="Retry window" v={`Until ${fmtDate(c.latestRetryDate)}, then service pauses`} />
            <Fact k="Registered mobile" v={`${c.phoneMasked} (fictional, never dialled)`} />
            <Fact k="Language" v={c.language === "hi" ? "Hindi / Hinglish" : "English"} />
          </Section>

          <Section title="Recovery state">
            <Fact k="Outcome" v={c.state.paid ? "Paid" : outcomeLabel(c.state.outcome) || "—"} />
            {c.state.outcomeNote && <Fact k="Note" v={c.state.outcomeNote} />}
            {c.state.paymentLink && (
              <Fact
                k="Payment link"
                v={
                  <a href={c.state.paymentLink.url} target="_blank" rel="noreferrer" className="break-all text-blue-600 underline">
                    {c.state.paymentLink.url}
                  </a>
                }
              />
            )}
            {c.state.paymentLink && (
              <Fact
                k="Link type"
                v={`${c.state.paymentLink.type === "update_mandate" ? "Pay + re-authorise autopay" : "Pay now"} · ${
                  c.state.paymentLink.provider === "razorpay" ? "Razorpay test mode" : "mock"
                } · ${c.state.paymentLink.status}`}
              />
            )}
            {c.state.paid && <Fact k="Paid" v={`${inr(c.state.paid.amount)} at ${fmtDateTime(c.state.paid.at)}${c.state.paid.paymentId ? ` · ${c.state.paid.paymentId}` : ""}`} />}
            {c.state.retryDate && <Fact k="Retry on" v={fmtDate(c.state.retryDate)} />}
            {c.state.callbackAt && <Fact k="Callback" v={`${fmtDateTime(c.state.callbackAt)} IST`} />}
            <Fact k="Calls so far" v={String(c.state.callCount ?? 0)} />
          </Section>

          {call && (
            <Section title={`Last call · ${call.channel === "phone" ? "phone" : "browser"}`}>
              <Fact k="Status" v={`${call.status}${call.endedReason ? ` — ${call.endedReason.replace(/-/g, " ")}` : ""}`} />
              {call.durationSec !== undefined && <Fact k="Duration" v={`${Math.floor(call.durationSec / 60)}m ${call.durationSec % 60}s`} />}
              {call.cost !== undefined && <Fact k="Cost" v={`$${call.cost.toFixed(3)}`} />}
              {call.summary && <Fact k="Summary" v={call.summary} />}
              {a && (
                <>
                  <Fact k="AI outcome" v={a.outcome?.replace(/_/g, " ") ?? "—"} />
                  {a.customer_reason && <Fact k="Customer said" v={a.customer_reason} />}
                  {a.sentiment && <Fact k="Sentiment" v={a.sentiment} />}
                  <Fact
                    k="Compliance QA"
                    v={
                      a.compliance_flags?.length ? (
                        <span className="text-rose-700">⚠ {a.compliance_flags.join("; ")}</span>
                      ) : (
                        <span className="text-emerald-700">✓ No issues flagged</span>
                      )
                    }
                  />
                </>
              )}
              {call.recordingUrl && (
                <div className="pt-1">
                  <audio controls src={call.recordingUrl} className="w-full" />
                </div>
              )}
              {call.transcript && (
                <details className="pt-1">
                  <summary className="cursor-pointer text-xs font-medium text-blue-700">Full transcript</summary>
                  <pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-xs leading-relaxed text-slate-700">
                    {call.transcript}
                  </pre>
                </details>
              )}
              {call.status !== "ended" && <p className="text-xs text-slate-500">Summary, recording and analysis appear a few seconds after the call ends.</p>}
            </Section>
          )}

          <Section title="Timeline">
            {events.length === 0 && <p className="text-xs text-slate-400">No activity yet.</p>}
            <ul className="space-y-2">
              {events.map((e, i) => (
                <li key={i} className="text-xs text-slate-700">
                  <span className="mr-2 tabular-nums text-slate-400">{fmtTime(e.ts)}</span>
                  {e.text}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 text-sm">
      <span className="text-slate-500">{k}</span>
      <span className="text-slate-800">{v}</span>
    </div>
  );
}
