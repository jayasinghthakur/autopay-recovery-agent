"use client";

import { ExternalLink, Mic, Phone, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect } from "react";
import type { ActivityEvent, CustomerView } from "@/lib/types";
import { Avatar, fmtDate, fmtDateTime, fmtDuration, fmtTime, inr, outcomeLabel, StatusBadge, statusDetail } from "./ui";

/** Vapi transcripts are "AI: …" / "User: …" lines; render them as chat bubbles when possible. */
function parseTranscript(t: string) {
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  const parsed = lines.map((l) => {
    const m = l.match(/^(AI|Assistant|Bot|User|Customer)\s*:\s*(.*)$/i);
    return m ? { ai: /^(ai|assistant|bot)$/i.test(m[1]), text: m[2] } : null;
  });
  return parsed.every(Boolean) ? (parsed as { ai: boolean; text: string }[]) : null;
}

export default function CustomerDrawer(props: {
  c: CustomerView;
  events: ActivityEvent[];
  onClose: () => void;
  onTalk: () => void;
  onPhone: () => void;
  talkDisabled: boolean;
}) {
  const { c, events, onClose } = props;
  const call = c.lastCall;
  const a = call?.analysis;
  const blocked = c.status === "recovered" || c.status === "do_not_call" || c.status === "in_call";
  const bubbles = call?.transcript ? parseTranscript(call.transcript) : null;
  const s = c.state;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <aside className="drawer-in relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-slate-50 shadow-2xl">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-start gap-3">
            <Avatar name={c.name} id={c.id} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold text-slate-900">{c.name}</h2>
              <p className="truncate text-xs text-slate-500">
                {c.merchant} · {c.plan}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <StatusBadge status={c.status} />
                <span className="text-[11px] text-slate-500">{statusDetail(c)}</span>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="space-y-4 p-5">
          {/* Role-play card */}
          <section className="rounded-2xl bg-slate-900 p-4 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Your role</p>
            <p className="mt-1 flex items-center gap-1.5 text-base font-semibold">
              <Sparkles className="h-4 w-4 text-amber-400" /> {c.scenario}
            </p>
            <p className="mt-2 text-sm text-slate-300">Try: “{c.tryLine}”</p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Year of birth <b>{c.verifyAnswer}</b>
              <span className="text-slate-400">· agent never sees this</span>
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={props.onTalk}
                disabled={props.talkDisabled || blocked}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold hover:bg-blue-500 disabled:bg-white/10 disabled:text-slate-500"
              >
                <Mic className="h-4 w-4" /> Talk in browser
              </button>
              <button
                onClick={props.onPhone}
                disabled={blocked}
                className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/20 disabled:text-slate-500"
              >
                <Phone className="h-4 w-4" /> My phone
              </button>
            </div>
          </section>

          <Card title="Why autopay failed">
            <p className="text-2xl font-semibold tabular-nums text-slate-900">{inr(c.amount)}</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{c.failure.label}</p>
            <p className="text-sm text-slate-500">{c.failure.explanation.charAt(0).toUpperCase() + c.failure.explanation.slice(1)}.</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <Fact k="Mandate" v={c.mandate.method} />
              <Fact k="Instrument" v={c.mandate.instrument} />
              <Fact k="Failed on" v={`${fmtDate(c.failure.failedOn)} · ${c.failure.debitAttempts}×`} />
              <Fact k="Retry until" v={fmtDate(c.latestRetryDate)} />
              {c.mandate.maxAmount && <Fact k="Mandate limit" v={inr(c.mandate.maxAmount)} />}
              <Fact k="Mobile" v={`${c.phoneMasked} (fake)`} />
            </dl>
          </Card>

          {(s.outcome || s.paid) && (
            <Card title="Outcome">
              <p className="text-sm font-medium text-slate-900">{s.paid ? `Paid ${inr(s.paid.amount)}` : outcomeLabel(s.outcome)}</p>
              {s.outcomeNote && !s.paid && <p className="text-sm text-slate-500">{s.outcomeNote}</p>}
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                {s.paid && <Fact k="Paid at" v={fmtDateTime(s.paid.at)} />}
                {s.paid?.paymentId && <Fact k="Payment ID" v={s.paid.paymentId} />}
                {s.retryDate && <Fact k="Retry on" v={fmtDate(s.retryDate)} />}
                {s.callbackAt && <Fact k="Callback" v={fmtDateTime(s.callbackAt)} />}
                {s.paymentLink && (
                  <Fact
                    k="Link"
                    v={`${s.paymentLink.type === "update_mandate" ? "Pay + re-authorise" : "Pay now"} · ${s.paymentLink.provider === "razorpay" ? "Razorpay" : "mock"}`}
                  />
                )}
              </dl>
              {s.paymentLink && s.paymentLink.status !== "paid" && (
                <a
                  href={s.paymentLink.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Open payment link <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </Card>
          )}

          {call && (
            <Card
              title={`Last call · ${call.channel}`}
              aside={call.durationSec !== undefined ? fmtDuration(call.durationSec) : call.status === "ended" ? "" : "in progress"}
            >
              {call.summary ? (
                <p className="text-sm leading-relaxed text-slate-700">{call.summary}</p>
              ) : (
                <p className="text-xs text-slate-400">Summary, recording and QA appear a few seconds after the call ends.</p>
              )}
              {a && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {a.outcome && <Chip>{a.outcome.replace(/_/g, " ")}</Chip>}
                  {a.sentiment && <Chip>{a.sentiment} sentiment</Chip>}
                  {a.compliance_flags?.length ? (
                    <Chip tone="bad">⚠ {a.compliance_flags.join("; ")}</Chip>
                  ) : (
                    <Chip tone="good">✓ Compliance OK</Chip>
                  )}
                </div>
              )}
              {call.recordingUrl && <audio controls src={call.recordingUrl} className="mt-3 h-9 w-full" />}
              {call.transcript && (
                <details className="mt-3 group">
                  <summary className="cursor-pointer text-xs font-semibold text-blue-700">Transcript</summary>
                  {bubbles ? (
                    <div className="mt-2 max-h-80 space-y-1.5 overflow-y-auto">
                      {bubbles.map((b, i) => (
                        <div key={i} className={`flex ${b.ai ? "justify-start" : "justify-end"}`}>
                          <p
                            className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs leading-snug ${
                              b.ai ? "rounded-bl-sm bg-slate-100 text-slate-800" : "rounded-br-sm bg-blue-600 text-white"
                            }`}
                          >
                            {b.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-xs text-slate-700">
                      {call.transcript}
                    </pre>
                  )}
                </details>
              )}
            </Card>
          )}

          {events.length > 0 && (
            <Card title="Timeline">
              <ol className="space-y-2">
                {events.map((e, i) => (
                  <li key={i} className="flex gap-3 text-xs">
                    <span className="w-14 shrink-0 tabular-nums text-slate-400">{fmtTime(e.ts)}</span>
                    <span className="text-slate-700">{e.text}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </aside>
    </div>
  );
}

function Card({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
        {aside && <span className="text-xs tabular-nums text-slate-400">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-400">{k}</dt>
      <dd className="truncate text-slate-800" title={v}>
        {v}
      </dd>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "good" | "bad" }) {
  const cls = tone === "good" ? "bg-emerald-50 text-emerald-700" : tone === "bad" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${cls}`}>{children}</span>;
}
