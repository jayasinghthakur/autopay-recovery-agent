"use client";

import { Mic, MicOff, PhoneOff, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CustomerView } from "@/lib/types";
import type { VapiCallControls } from "./useVapiCall";
import { Avatar, fmtDuration } from "./ui";

function useElapsed(startedAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  return startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
}

/** Browser call panel. Docked in the right rail on desktop, a bottom sheet on mobile. */
export default function LiveCall({ call, customer }: { call: VapiCallControls; customer: CustomerView | null }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const elapsed = useElapsed(call.startedAt);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [call.lines]);

  const phaseLabel =
    call.phase === "connecting" ? "Connecting…" : call.phase === "ending" ? "Ending…" : `Live · ${fmtDuration(elapsed)}`;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 overflow-hidden rounded-2xl bg-slate-950 text-white shadow-2xl ring-1 ring-white/10 lg:static lg:inset-auto lg:shadow-xl">
      <div className="flex items-center gap-3 px-4 pt-4">
        {customer && <Avatar name={customer.name} id={customer.id} size="sm" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">You&apos;re {customer?.firstName ?? "the customer"}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className={`h-1.5 w-1.5 rounded-full ${call.phase === "active" ? "animate-pulse bg-emerald-400" : "bg-amber-400"}`} />
            {phaseLabel}
          </p>
        </div>
        <VoiceOrb active={call.assistantSpeaking} level={call.volume} />
      </div>

      {customer && (
        <div className="mt-3 flex flex-wrap gap-1.5 px-4">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px]">
            <ShieldCheck className="h-3 w-3 text-emerald-400" /> Year of birth <b className="font-semibold">{customer.verifyAnswer}</b>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px]">
            <Sparkles className="h-3 w-3 text-amber-400" /> Try: “{customer.tryLine}”
          </span>
        </div>
      )}

      <div ref={scrollRef} className="mt-3 max-h-40 space-y-2 overflow-y-auto px-4 pb-3 lg:max-h-72">
        {call.lines.length === 0 && (
          <p className="py-4 text-center text-xs text-slate-500">
            {call.phase === "connecting" ? "Allow microphone access…" : "The agent speaks first. Just answer naturally."}
          </p>
        )}
        {call.lines.map((l, i) => (
          <div key={i} className={`flex ${l.role === "assistant" ? "justify-start" : "justify-end"}`}>
            <p
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                l.role === "assistant" ? "rounded-bl-sm bg-white/10 text-slate-100" : "rounded-br-sm bg-blue-600 text-white"
              } ${l.final ? "" : "opacity-70"}`}
            >
              {l.text}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-t border-white/10 p-3">
        <button
          onClick={call.toggleMute}
          disabled={call.phase !== "active"}
          className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium hover:bg-white/20 disabled:opacity-40"
        >
          {call.muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          {call.muted ? "Unmute" : "Mute"}
        </button>
        <button
          onClick={call.stop}
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold hover:bg-rose-500"
        >
          <PhoneOff className="h-3.5 w-3.5" /> End call
        </button>
      </div>
    </div>
  );
}

function VoiceOrb({ active, level }: { active: boolean; level: number }) {
  const bars = [0.5, 0.8, 1, 0.8, 0.5];
  return (
    <div className="flex h-8 items-center gap-0.5" aria-label={active ? "Agent speaking" : "Listening"}>
      {bars.map((b, i) => (
        <span
          key={i}
          className={`w-1 rounded-full transition-all duration-100 ${active ? "bg-blue-400" : "bg-slate-600"}`}
          style={{ height: `${active ? Math.max(6, Math.min(1, level * 2.5) * 28 * b) : 6}px` }}
        />
      ))}
    </div>
  );
}
