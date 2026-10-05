"use client";

import { ArrowRight, Mic, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CustomerView, Snapshot } from "@/lib/types";
import ActivityFeed from "./ActivityFeed";
import CustomerCard from "./CustomerCard";
import CustomerDrawer from "./CustomerDrawer";
import HowItWorks from "./HowItWorks";
import LiveCall from "./LiveCall";
import { Logo } from "./Logo";
import PhoneInbox from "./PhoneInbox";
import StatusMenu from "./StatusMenu";
import Toasts, { type Toast } from "./Toasts";
import { GitHubMark, inr, REPO_URL } from "./ui";
import { useVapiCall } from "./useVapiCall";

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
  const [dialing, setDialing] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const call = useVapiCall();
  const versionRef = useRef<number | null>(null);
  const fastRef = useRef(false);
  const seenRef = useRef<{ init: boolean; newest: string | null }>({ init: false, newest: null });
  const toastSeq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++toastSeq.current;
      setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), t.kind === "error" ? 9000 : 5500);
    },
    [dismiss],
  );

  const refresh = useCallback(async () => {
    try {
      const v = versionRef.current;
      const res = await fetch(`/api/state${v !== null ? `?v=${v}` : ""}`, { cache: "no-store" });
      const data = await res.json();
      versionRef.current = data.version;
      setOffline(false);
      if (data.unchanged) return;

      const next = data as Snapshot;
      // Pop a toast for recoveries and finished calls that happened since the last poll.
      const seen = seenRef.current;
      if (seen.init) {
        const names = new Map(next.customers.map((c) => [c.id, c.firstName]));
        const fresh = next.events.filter((e) => !seen.newest || e.ts > seen.newest).reverse();
        for (const e of fresh) {
          if (e.kind === "payment") toast({ kind: "success", title: `Recovered from ${names.get(e.customerId)}`, body: e.text });
          else if (e.kind === "call" && e.text.startsWith("Call ended"))
            toast({ kind: "info", title: `Call with ${names.get(e.customerId)} ended`, body: "Summary and transcript are on their card." });
        }
      }
      seenRef.current = { init: true, newest: next.events[0]?.ts ?? null };
      setSnap(next);
    } catch {
      setOffline(true);
    }
  }, [toast]);

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
      p = window.prompt("Operator passcode (ADMIN_PASSCODE):");
      if (!p) return null;
      writePass(p);
    }
    return { "x-operator-passcode": p };
  }, [snap?.setup.passcodeRequired]);

  const startTalk = useCallback(
    (c: CustomerView) => {
      if (call.phase !== "idle") return;
      call.clearError();
      setSelectedId(null);
      void call.start(c.id);
    },
    [call],
  );

  const startPhone = useCallback(
    async (c: CustomerView) => {
      if (!snap) return;
      if (!snap.setup.phoneCalls) {
        toast({ kind: "info", title: "Phone calls aren't set up here", body: "Use Talk — same agent, tools and outcomes, right in your browser." });
        return;
      }
      if (!window.confirm(`Ring ${snap.setup.destinationMasked} and play ${c.firstName}?\nVerification: year of birth ${c.verifyAnswer}`)) return;
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
        if (res.ok) toast({ kind: "info", title: `Calling ${snap.setup.destinationMasked}…`, body: `Pick up and play ${c.firstName}.` });
        else toast({ kind: "error", title: "Couldn't place the call", body: data.error });
      } finally {
        setDialing(null);
        void refresh();
      }
    },
    [snap, operatorHeaders, refresh, toast],
  );

  const resetDemo = useCallback(async () => {
    if (!window.confirm("Reset all demo data?")) return;
    const headers = operatorHeaders();
    if (headers === null) return;
    const res = await fetch("/api/reset", { method: "POST", headers });
    if (res.status === 401) writePass(null);
    if (res.ok) toast({ kind: "success", title: "Demo reset" });
    else toast({ kind: "error", title: "Reset failed", body: (await res.json()).error });
    void refresh();
  }, [operatorHeaders, refresh, toast]);

  const kpis = useMemo(() => {
    if (!snap) return null;
    const cs = snap.customers;
    const total = cs.reduce((s, c) => s + c.amount, 0);
    const recovered = cs.reduce((s, c) => s + (c.state.paid?.amount ?? 0), 0);
    const contacted = cs.filter((c) => (c.state.callCount ?? 0) > 0 || c.state.outcome || c.state.paid).length;
    const resolved = cs.filter((c) => ["recovered", "awaiting_payment", "retry_scheduled", "callback"].includes(c.status)).length;
    const calls = cs.reduce((s, c) => s + (c.state.callCount ?? 0), 0);
    return { total, recovered, pct: total ? Math.round((recovered / total) * 100) : 0, contacted, resolved, calls };
  }, [snap]);

  const next = snap?.customers.find((c) => c.status === "pending") ?? null;
  const selected = snap?.customers.find((c) => c.id === selectedId) ?? null;
  const liveCustomer = snap?.customers.find((c) => c.id === call.customerId) ?? null;
  const inCall = call.phase !== "idle";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2">
            <a href="#how" className="hidden rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 sm:inline">
              How it works
            </a>
            {snap && <StatusMenu setup={snap.setup} onReset={resetDemo} />}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              aria-label="Source code on GitHub"
            >
              <GitHubMark />
            </a>
          </nav>
        </div>
      </header>

      <main className={`mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-10 ${inCall ? "pb-96 lg:pb-10" : ""}`}>
        {snap && snap.setup.webCalls && !snap.setup.webhookReachable && (
          <Alert>
            Vapi can&apos;t reach <code className="break-all">{snap.setup.webhookUrl}</code>. Set <code>PUBLIC_BASE_URL</code> to a tunnel URL.
          </Alert>
        )}
        {snap && !snap.setup.webCalls && <Alert>Add VAPI_PRIVATE_KEY and VAPI_PUBLIC_KEY to enable calls.</Alert>}
        {offline && <Alert>Reconnecting…</Alert>}
        {call.error && <Alert onClose={call.clearError}>Call failed: {call.error}</Alert>}

        {/* Hero */}
        <section className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">UPI Autopay · e-Mandate · eNACH</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-[42px] sm:leading-[1.1]">
              Failed autopay?
              <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text pb-1 text-transparent">Let the agent call.</span>
            </h1>
            <p className="mt-3 max-w-lg text-[15px] text-slate-600">
              Play a customer. The agent verifies you, explains what failed, and recovers the payment — live.
            </p>
            <ol className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-slate-700">
              {["Pick a customer", "Talk in your browser", "Watch it recover"].map((s, i) => (
                <li key={s} className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 ring-1 ring-slate-200">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap gap-3">
              {next ? (
                <button
                  onClick={() => startTalk(next)}
                  disabled={inCall || !snap?.setup.webCalls}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-50"
                >
                  <Mic className="h-4 w-4" /> Start with {next.firstName}
                </button>
              ) : (
                <button onClick={resetDemo} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
                  All contacted — reset demo
                </button>
              )}
              <a
                href="#customers"
                className="flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-white"
              >
                Choose a customer <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          {kpis && (
            <div className="grid grid-cols-2 gap-3">
              <Kpi label="At risk" value={inr(kpis.total)} sub="10 failed debits" />
              <Kpi label="Recovered" value={inr(kpis.recovered)} sub={`${kpis.pct}% of value`} tone="good" progress={kpis.pct} />
              <Kpi label="Resolved" value={`${kpis.resolved}/${kpis.contacted}`} sub="next step agreed" />
              <Kpi label="Calls" value={String(kpis.calls)} sub="browser + phone" />
            </div>
          )}
        </section>

        {/* Customers + live rail */}
        <section id="customers" className="mt-10 grid scroll-mt-20 grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Customers</h2>
              <p className="text-xs text-slate-500">Fictional · tap a card for details</p>
            </div>
            {!snap && <CardSkeletons />}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {snap?.customers.map((c) => (
                <CustomerCard
                  key={c.id}
                  c={c}
                  recommended={next?.id === c.id && !inCall}
                  live={inCall && call.customerId === c.id}
                  talkDisabled={inCall || !snap.setup.webCalls}
                  dialing={dialing === c.id}
                  onOpen={() => setSelectedId(c.id)}
                  onTalk={() => startTalk(c)}
                  onPhone={() => startPhone(c)}
                />
              ))}
            </div>
          </div>

          <aside className="space-y-6 lg:col-span-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pb-2 rail">
            {inCall && <LiveCall call={call} customer={liveCustomer} />}
            <PhoneInbox snap={snap} />
            <ActivityFeed snap={snap} />
          </aside>
        </section>

        <HowItWorks />
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:px-6">
          <span>Fictional customers · Razorpay Test Mode · calls only to the operator&apos;s own number</span>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-slate-800">
            <GitHubMark className="h-3.5 w-3.5" /> GitHub
          </a>
        </div>
      </footer>

      {selected && (
        <CustomerDrawer
          c={selected}
          events={snap?.events.filter((e) => e.customerId === selected.id) ?? []}
          onClose={() => setSelectedId(null)}
          onTalk={() => startTalk(selected)}
          onPhone={() => startPhone(selected)}
          talkDisabled={inCall || !snap?.setup.webCalls}
        />
      )}
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function Alert({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} className="text-amber-700 hover:text-amber-950" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone, progress }: { label: string; value: string; sub: string; tone?: "good"; progress?: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${tone === "good" ? "text-emerald-600" : "text-slate-900"}`}>{value}</p>
      {progress !== undefined ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.max(progress, 2)}%` }} />
        </div>
      ) : null}
      <p className="mt-1.5 text-[11px] text-slate-500">{sub}</p>
    </div>
  );
}

function CardSkeletons() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-[188px] animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />
      ))}
    </div>
  );
}
