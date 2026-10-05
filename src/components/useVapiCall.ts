"use client";

import type Vapi from "@vapi-ai/web";
import { useCallback, useEffect, useRef, useState } from "react";

export type CallPhase = "idle" | "connecting" | "active" | "ending";
export interface LiveLine {
  role: "assistant" | "user";
  text: string;
  final: boolean;
}

function describeError(e: unknown): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  const anyE = e as { error?: { message?: string; msg?: string }; errorMsg?: string; message?: string };
  return anyE.error?.message ?? anyE.error?.msg ?? anyE.errorMsg ?? anyE.message ?? JSON.stringify(e).slice(0, 200);
}

/** Browser (WebRTC) call with the agent via the Vapi Web SDK. The reviewer plays the customer. */
export function useVapiCall() {
  const vapiRef = useRef<Vapi | null>(null);
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [lines, setLines] = useState<LiveLine[]>([]);
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => void vapiRef.current?.stop(), []);

  const start = useCallback(async (cid: string) => {
    if (vapiRef.current) return;
    setError(null);
    setLines([]);
    setMuted(false);
    setCustomerId(cid);
    setPhase("connecting");

    try {
      const res = await fetch("/api/web-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: cid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the call");

      const { default: VapiClient } = await import("@vapi-ai/web");
      const vapi = new VapiClient(data.publicKey);
      vapiRef.current = vapi;

      vapi.on("call-start", () => setPhase("active"));
      vapi.on("call-end", () => {
        setPhase("idle");
        setAssistantSpeaking(false);
        setVolume(0);
        vapiRef.current = null;
      });
      vapi.on("speech-start", () => setAssistantSpeaking(true));
      vapi.on("speech-end", () => setAssistantSpeaking(false));
      vapi.on("volume-level", (v: number) => setVolume(v));
      vapi.on("message", (m: { type?: string; role?: string; transcriptType?: string; transcript?: string }) => {
        if (m.type !== "transcript" || !m.transcript) return;
        const role = m.role === "assistant" ? "assistant" : "user";
        const final = m.transcriptType === "final";
        setLines((prev) => {
          const last = prev[prev.length - 1];
          if (last && !last.final && last.role === role) return [...prev.slice(0, -1), { role, text: m.transcript!, final }];
          return [...prev, { role, text: m.transcript!, final }];
        });
      });
      vapi.on("error", (e: unknown) => {
        const msg = describeError(e);
        if (/meeting has ended|ejected/i.test(msg)) return; // normal hang-up noise
        setError(msg);
      });

      await vapi.start(data.assistantId, data.assistantOverrides);
    } catch (e) {
      setError(describeError(e));
      setPhase("idle");
      vapiRef.current?.stop();
      vapiRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (!vapiRef.current) return;
    setPhase("ending");
    void vapiRef.current.stop();
  }, []);

  const toggleMute = useCallback(() => {
    const v = vapiRef.current;
    if (!v) return;
    v.setMuted(!v.isMuted());
    setMuted(v.isMuted());
  }, []);

  return { phase, customerId, lines, assistantSpeaking, volume, muted, error, start, stop, toggleMute, clearError: () => setError(null) };
}

export type VapiCallControls = ReturnType<typeof useVapiCall>;
