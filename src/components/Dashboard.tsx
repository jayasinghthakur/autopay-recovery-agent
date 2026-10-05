"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CustomerView, Snapshot } from "@/lib/types";
import CustomerDrawer from "./CustomerDrawer";
import HowItWorks from "./HowItWorks";
import { fmtDate, fmtTime, inr, Pill, StatusBadge, statusDetail } from "./ui";
import { useVapiCall, type VapiCallControls } from "./useVapiCall";

const PASS_KEY = "avr-operator-passcode";

function readPass(): string | null {
  try {
    return localStorage.getItem(PASS_KEY);
  } catch {
    return null;
  }
}
function writePass(v: string | null) {
  try {
    if (v) localStorage.setItem(PASS_KEY, v);
    else localStorage.removeItem(PASS_KEY);
  } catch {}
}

export default function Dashboard() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [offline, setOffline] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [dialing, setDialing] = useState<string | null>(null);
  const call = useVapiCall();
  const versionRef = useRef<number | null>(null);
  const fastRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const v = versionRef.current;
      const res = await fetch(`/api/state${v !== null ? `?v=${v}` : ""}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.unchanged) setSnap(data as Snapshot);
      versionRef.current = data.version;
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  // Poll fast while something is happening, slowly otherwise, and not at all in a hidden tab.
  useEffect(() => {
    const lastEvent = snap?.events[0]?.ts ? Date.parse(snap.events[0].ts) : 0;
    fastRef.current =
      call.phase !== "idle" || Boolean(snap?.customers.some((c) => c.status === "in_call")) || Date.now() - lastEvent < 120_000;
  }, [snap, call.phase]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const loop = async () => {
      if (!document.hidden) await refresh();
      if (!stopped) timer = setTimeout(loop, fastRef.current ? 2000 : 7000);
    };
    void loop();
    const onVisible = () => !document.hidden && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const operatorHeaders = useCallback((): Record<string, string> | null => {
    if (!snap?.setup.passcodeRequired) return {};
    let p = readPass();
    if (!p) {
      p = window.prompt("Operator passcode (the ADMIN_PASSCODE set on the server):");
      if (!p) return null;
      writePass(p);
    }
    return { "x-operator-passcode": p };
  }, [snap?.setup.passcodeRequired]);

  const startWebCall = useCallback(
    (c: CustomerView) => {
      if (call.phase !== "idle") return;
      setNotice(null);
      call.clearError();
      void call.start(c.id);
    },
    [call],
  );

  const startPhoneCall = useCallback(
    async (c: CustomerView) => {
      if (!snap) return;
      if (!snap.setup.phoneCalls) {
        setNotice({
          kind: "info",
          text: "Real phone calls aren't configured on this deployment. Use “Talk in browser” — it's the same agent, tools and outcomes.",
        });
        return;
      }
      const ok = window.confirm(
        `This rings the operator's own phone (${snap.setup.destinationMasked}). Answer and play ${c.name}.\n\nVerification answer → ${c.verificationHint}\n\nContinue?`,
      );
      if (!ok) return;
      const headers = operatorHeaders();
      if (headers === null) return;
      setDialing(c.id);
      try {
        const res = await fetch("/api/call", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ customerId: c.id }),
        });
        const data = await res.json();
        if (res.status === 401) writePass(null);
        setNotice(
          res.ok
            ? { kind: "info", text: `Calling ${snap.setup.destinationMasked}… pick up and play ${c.firstName}. (${c.verificationHint})` }
            : { kind: "error", text: data.error ?? "Call failed" },
        );
      } finally {
        setDialing(null);
        void refresh();
      }
    },
    [snap, operatorHeaders, refresh],
  );

  const resetDemo = useCallback(async () => {
    if (!window.confirm("Reset all demo data (outcomes, calls, payment links, activity)?")) return;
    const headers = operatorHeaders();
    if (headers === null) return;
    const res = await fetch("/api/reset", { method: "POST", headers });
    if (res.status === 401) writePass(null);
    if (!res.ok) setNotice({ kind: "error", text: (await res.json()).error ?? "Reset failed" });
    else setNotice({ kind: "info", text: "Demo data reset." });
    void refresh();
  }, [operatorHeaders, refresh]);

  const kpis = useMemo(() => {
    if (!snap) return null;
    const cs = snap.customers;
    const total = cs.reduce((s, c) => s + c.amount, 0);
    const recovered = cs.filter((c) => c.state.paid).reduce((s, c) => s + (c.state.paid?.amount ?? 0), 0);
    const contacted = cs.filter((c) => (c.state.callCount ?? 0) > 0 || c.state.outcome || c.state.paid).length;
    const committed = cs.filter((c) => ["recovered", "awaiting_payment", "retry_scheduled", "callback"].includes(c.status)).length;
    const calls = cs.reduce((s, c) => s + (c.state.callCount ?? 0), 0);
    return { total, recovered, contacted, committed, calls, recoveredCount: cs.filter((c) => c.state.paid).length };
  }, [snap]);

  const selected = snap?.customers.find((c) => c.id === selectedId) ?? null;
  const liveCustomer = snap?.customers.find((c) => c.id === call.customerId) ?? null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Voice AI · Payments recovery</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Autopay Recovery Agent</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            An AI voice agent that calls customers whose UPI Autopay / e-mandate debit failed, verifies them, explains why,
            and resolves it — payment link, mandate re-authorisation, retry, callback or escalation. All 10 customers are fictional.
          </p>
        </div>
        {snap && (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Pill ok={snap.setup.webCalls}>Browser calls</Pill>
            <Pill ok={snap.setup.phoneCalls} title="Outbound calls only ever dial the operator's own allow-listed number">
              Phone calls{snap.setup.destinationMasked ? ` → ${snap.setup.destinationMasked}` : ""}
            </Pill>
            <Pill ok={snap.setup.payments === "razorpay-test" ? true : "warn"}>
              {snap.setup.payments === "razorpay-test" ? "Razorpay test mode" : "Mock payments"}
            </Pill>
            <Pill ok={snap.setup.storage === "redis" ? true : "warn"}>{snap.setup.storage === "redis" ? "Redis" : "In-memory store"}</Pill>
            <Pill ok={snap.setup.callingHoursOpen || !snap.setup.callingHoursEnforced ? true : "warn"}>
              {snap.setup.callingHoursOpen ? "Within 8am–7pm IST" : snap.setup.callingHoursEnforced ? "Outside calling hours" : "Calling hours overridden"}
            </Pill>
            <button onClick={resetDemo} className="rounded-full px-2.5 py-1 text-xs text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100">
              Reset demo
            </button>
          </div>
        )}
      </header>

      {snap && !snap.setup.webhookReachable && snap.setup.webCalls && (
        <Banner kind="error">
          Webhook URL is <code className="break-all font-mono">{snap.setup.webhookUrl}</code>, which Vapi can&apos;t reach. Set{" "}
          <code className="font-mono">PUBLIC_BASE_URL</code> to a tunnel URL (e.g. cloudflared / ngrok) so the agent&apos;s tools work.
        </Banner>
      )}
      {offline && <Banner kind="error">Can&apos;t reach the server — retrying…</Banner>}
      {call.error && (
        <Banner kind="error" onClose={call.clearError}>
          Browser call: {call.error}
        </Banner>
      )}
      {notice && (
        <Banner kind={notice.kind} onClose={() => setNotice(null)}>
          {notice.text}
        </Banner>
      )}

      {kpis && (
        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Failed autopay value" value={inr(kpis.total)} sub="10 customers" />
          <Kpi
            label="Recovered"
            value={inr(kpis.recovered)}
            sub={`${Math.round((kpis.recovered / kpis.total) * 100)}% of value · ${kpis.recoveredCount} paid`}
            accent
          />
          <Kpi label="Committed next step" value={`${kpis.committed} / ${kpis.contacted || 0}`} sub="of customers contacted" />
          <Kpi label="Calls completed" value={String(kpis.calls)} sub="browser + phone" />
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
            <div className="hidden grid-cols-[1.6fr_0.7fr_1.3fr_1.1fr_auto] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-500 md:grid">
              <span>Customer</span>
              <span>Due</span>
              <span>Why autopay failed</span>
              <span>Status</span>
              <span className="w-[12.5rem] text-right">Call</span>
            </div>
            {!snap && <p className="p-6 text-sm text-slate-500">Loading…</p>}
            <ul className="divide-y divide-slate-100">
              {snap?.customers.map((c) => (
                <CustomerRow
                  key={c.id}
                  c={c}
                  onOpen={() => setSelectedId(c.id)}
                  onWebCall={() => startWebCall(c)}
                  onPhoneCall={() => startPhoneCall(c)}
                  webDisabled={call.phase !== "idle" || !snap.setup.webCalls}
                  dialing={dialing === c.id}
                />
              ))}
            </ul>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Tip: click a customer for their role-play brief, verification answer, transcript, recording and AI call analysis.
          </p>
        </section>

        <aside className="space-y-6">
          {call.phase !== "idle" && <LiveCall call={call} customer={liveCustomer} />}
          <SmsInbox snap={snap} />
          <ActivityFeed snap={snap} />
        </aside>
      </div>

      <HowItWorks />

      <footer className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">
        Demo only. All customers, merchants and numbers are fictional; outbound calls go solely to the operator&apos;s own number.
        Payments run in Razorpay test mode (no real money).
      </footer>

      {selected && (
        <CustomerDrawer
          c={selected}
          events={snap?.events.filter((e) => e.customerId === selected.id) ?? []}
          onClose={() => setSelectedId(null)}
          onWebCall={() => startWebCall(selected)}
          onPhoneCall={() => startPhoneCall(selected)}
          webDisabled={call.phase !== "idle" || !snap?.setup.webCalls}
        />
      )}
    </div>
  );
}

function Banner({ kind, children, onClose }: { kind: "error" | "info"; children: React.ReactNode; onClose?: () => void }) {
  return (
    <div
      className={`mt-4 flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm ring-1 ring-inset ${
        kind === "error" ? "bg-rose-50 text-rose-800 ring-rose-200" : "bg-blue-50 text-blue-800 ring-blue-200"
      }`}
    >
      <div className="min-w-0">{children}</div>
      {onClose && (
        <button onClick={onClose} className="text-current opacity-60 hover:opacity-100" aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? "text-emerald-600" : "text-slate-900"}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function CustomerRow(props: {
  c: CustomerView;
  onOpen: () => void;
  onWebCall: () => void;
  onPhoneCall: () => void;
  webDisabled: boolean;
  dialing: boolean;
}) {
  const { c } = props;
  const blocked = c.status === "recovered" || c.status === "do_not_call" || c.status === "in_call";
  return (
    <li className="grid min-w-0 gap-3 px-4 py-3.5 hover:bg-slate-50/70 md:grid-cols-[1.6fr_0.7fr_1.3fr_1.1fr_auto] md:items-center md:gap-4">
      <button onClick={props.onOpen} className="text-left">
        <span className="flex items-center gap-2">
          <span className="font-medium text-slate-900 hover:text-blue-700">{c.name}</span>
          {c.language === "hi" && <span className="rounded bg-slate-100 px-1.5 text-[10px] font-medium text-slate-600">हिंदी</span>}
        </span>
        <span className="block text-xs text-slate-500">
          {c.merchant} · {c.plan}
        </span>
      </button>
      <div className="text-sm">
        <span className="font-medium tabular-nums text-slate-900">{inr(c.amount)}</span>
        <span className="block text-xs text-slate-500">{c.mandate.method}</span>
      </div>
      <div className="text-sm">
        <span className="text-slate-800">{c.failure.label}</span>
        <span className="block text-xs text-slate-500">
          Failed {fmtDate(c.failure.failedOn)} · {c.failure.debitAttempts} attempt{c.failure.debitAttempts > 1 ? "s" : ""}
        </span>
      </div>
      <div>
        <StatusBadge status={c.status} />
        <span className="mt-0.5 block text-xs text-slate-500">{statusDetail(c)}</span>
      </div>
      <div className="flex gap-2 md:w-[12.5rem] md:justify-end">
        <button
          onClick={props.onWebCall}
          disabled={props.webDisabled || blocked}
          className="whitespace-nowrap rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          Talk in browser
        </button>
        <button
          onClick={props.onPhoneCall}
          disabled={blocked || props.dialing}
          className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {props.dialing ? "Dialling…" : "Call my phone"}
        </button>
      </div>
    </li>
  );
}

function LiveCall({ call, customer }: { call: VapiCallControls; customer: CustomerView | null }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [call.lines]);

  return (
    <div className="overflow-hidden rounded-xl bg-slate-900 text-white ring-1 ring-slate-800">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-400">
            {call.phase === "connecting" ? "Connecting…" : call.phase === "ending" ? "Ending…" : "Live browser call"}
          </p>
          <p className="font-medium">You are playing {customer?.name ?? "the customer"}</p>
        </div>
        <VoiceOrb active={call.assistantSpeaking} level={call.volume} />
      </div>
      {customer && (
        <div className="mx-4 rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">
          <p>
            <span className="text-slate-400">Verification answer:</span>{" "}
            <span className="font-semibold text-white">{customer.verificationHint}</span>
          </p>
          <p className="mt-1">
            <span className="text-slate-400">Try:</span> {customer.demoHint}
          </p>
        </div>
      )}
      <div ref={scrollRef} className="mt-3 max-h-72 space-y-2 overflow-y-auto px-4 pb-3 text-sm">
        {call.lines.length === 0 && <p className="text-slate-400">Allow microphone access. The agent speaks first.</p>}
        {call.lines.map((l, i) => (
          <p key={i} className={l.role === "assistant" ? "text-slate-100" : "text-sky-300"}>
            <span className="mr-1.5 text-[10px] uppercase tracking-wider text-slate-500">{l.role === "assistant" ? "Agent" : "You"}</span>
            {l.text}
          </p>
        ))}
      </div>
      <div className="flex gap-2 border-t border-white/10 px-4 py-3">
        <button onClick={call.toggleMute} disabled={call.phase !== "active"} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20 disabled:opacity-40">
          {call.muted ? "Unmute" : "Mute"}
        </button>
        <button onClick={call.stop} className="ml-auto rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold hover:bg-rose-500">
          End call
        </button>
      </div>
    </div>
  );
}

function VoiceOrb({ active, level }: { active: boolean; level: number }) {
  const scale = 1 + Math.min(level, 1) * 0.6;
  return (
    <div className="relative flex h-10 w-10 items-center justify-center">
      <span
        className={`absolute inset-0 rounded-full transition-transform duration-100 ${active ? "bg-blue-500/40" : "bg-white/10"}`}
        style={{ transform: `scale(${active ? scale : 1})` }}
      />
      <span className={`relative h-4 w-4 rounded-full ${active ? "bg-blue-400" : "bg-slate-500"}`} />
    </div>
  );
}

function SmsInbox({ snap }: { snap: Snapshot | null }) {
  const names = new Map(snap?.customers.map((c) => [c.id, c.name]));
  return (
    <div className="rounded-xl bg-white ring-1 ring-slate-200">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Customer&apos;s phone · SMS</p>
        <p className="text-xs text-slate-500">Simulated delivery — open a link to pay as the customer</p>
      </div>
      <div className="max-h-80 space-y-2 overflow-y-auto p-3">
        {!snap?.sms.length && <p className="px-1 py-2 text-xs text-slate-400">Links the agent sends will appear here.</p>}
        {snap?.sms.map((m, i) => (
          <div key={i} className="rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2 text-xs text-slate-800">
            <p className="mb-0.5 text-[10px] text-slate-500">
              To {names.get(m.customerId)} ({m.to}) · {fmtTime(m.ts)}
            </p>
            <p className="break-words">
              {m.url ? m.body.replace(m.url, "") : m.body}
              {m.url && (
                <a href={m.url} target="_blank" rel="noreferrer" className="break-all font-medium text-blue-600 underline">
                  {m.url}
                </a>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityFeed({ snap }: { snap: Snapshot | null }) {
  const names = new Map(snap?.customers.map((c) => [c.id, c.firstName]));
  const icon: Record<string, string> = { call: "📞", tool: "⚙️", payment: "💰", outcome: "📌", system: "🛡️" };
  return (
    <div className="rounded-xl bg-white ring-1 ring-slate-200">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Live activity</p>
        <p className="text-xs text-slate-500">Every tool call the agent makes, as it happens</p>
      </div>
      <ul className="max-h-96 space-y-2.5 overflow-y-auto p-4">
        {!snap?.events.length && <li className="text-xs text-slate-400">No activity yet. Start a call.</li>}
        {snap?.events.map((e, i) => (
          <li key={i} className="flex gap-2 text-xs">
            <span aria-hidden>{icon[e.kind] ?? "•"}</span>
            <span className="text-slate-700">
              <span className="font-medium text-slate-900">{names.get(e.customerId)}</span> · {e.text}
              <span className="block text-[10px] text-slate-400">{fmtTime(e.ts)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
