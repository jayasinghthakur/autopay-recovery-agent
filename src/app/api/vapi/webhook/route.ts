import { timingSafeEqual } from "node:crypto";
import { findCustomer } from "@/data/customers";
import { baseUrlFrom, webhookSecret } from "@/lib/config";
import { kv } from "@/lib/kv";
import { getCall, getState, logEvent, patchState, setOutcome, upsertCall } from "@/lib/store";
import { runTool } from "@/lib/tools";
import type { CallRecord, Outcome } from "@/lib/types";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any -- Vapi webhook payloads are loosely typed JSON */

function authorized(req: Request): boolean {
  const got = Buffer.from(req.headers.get("x-avr-secret") ?? "");
  const expected = Buffer.from(webhookSecret());
  return got.length === expected.length && timingSafeEqual(got, expected);
}

function customerIdOf(msg: any): string | undefined {
  const call = msg?.call ?? {};
  return (
    call.assistantOverrides?.variableValues?.customerId ??
    call.assistantOverrides?.metadata?.customerId ??
    msg?.assistant?.metadata?.customerId ??
    undefined
  );
}

function channelOf(msg: any): CallRecord["channel"] {
  const type = String(msg?.call?.type ?? "");
  return type.toLowerCase().includes("phone") ? "phone" : "web";
}

function parseArgs(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw as Record<string, unknown>;
}

async function handleToolCalls(msg: any, req: Request) {
  const calls: any[] = msg.toolCallList ?? (msg.toolWithToolCallList ?? []).map((t: any) => t.toolCall) ?? [];
  const ctx = { callId: msg.call?.id, customerId: customerIdOf(msg), baseUrl: baseUrlFrom(req) };

  const results = await Promise.all(
    calls.map(async (tc) => {
      const name = tc?.function?.name ?? tc?.name;
      const cacheKey = `avr:toolres:${tc.id}`;
      // Vapi can retry a webhook; replay the first answer instead of acting twice.
      const cached = await kv().get<string>(cacheKey);
      if (cached) return { toolCallId: tc.id, result: cached };
      let result: string;
      try {
        result = JSON.stringify(await runTool(name, parseArgs(tc?.function?.arguments ?? tc?.arguments), ctx));
      } catch (err) {
        console.error(`tool ${name} failed`, err);
        result = JSON.stringify({ error: "internal_error", instruction: "Apologise, say the system is having trouble, and offer a callback." });
      }
      await kv().set(cacheKey, result, 3600);
      return { toolCallId: tc.id, result };
    }),
  );
  return Response.json({ results });
}

async function handleStatusUpdate(msg: any) {
  const callId = msg.call?.id;
  const customerId = customerIdOf(msg);
  if (!callId || !customerId) return;
  const status = String(msg.status ?? "");
  const prev = await getCall(callId);
  if (prev?.status === "ended") return; // late/out-of-order event after the end-of-call report
  await upsertCall(callId, customerId, {
    status,
    channel: channelOf(msg),
    ...(status === "in-progress" && !prev?.startedAt ? { startedAt: new Date().toISOString() } : {}),
    ...(msg.endedReason ? { endedReason: msg.endedReason } : {}),
  });
  if (prev?.status !== status && (status === "ringing" || status === "in-progress")) {
    await logEvent({ customerId, callId, kind: "call", text: status === "ringing" ? "Phone ringing…" : "Call connected" });
  }
}

const NO_CONTACT_REASONS = ["customer-did-not-answer", "customer-busy", "voicemail", "no-answer"];

/** Maps the post-call AI analysis onto our outcomes, used only when no tool recorded one. */
const ANALYSIS_TO_OUTCOME: Record<string, Outcome> = {
  dispute: "dispute",
  cancellation_request: "cancellation_request",
  hardship: "hardship",
  escalated_to_human: "escalate_to_human",
  do_not_call: "do_not_call",
  wrong_person: "wrong_person",
  not_verified: "not_verified",
  voicemail_or_no_answer: "no_answer",
};

async function handleEndOfCall(msg: any) {
  const callId = msg.call?.id;
  const customerId = customerIdOf(msg);
  if (!callId || !customerId || !findCustomer(customerId)) return;

  const artifact = msg.artifact ?? {};
  const analysis = msg.analysis ?? msg.call?.analysis ?? {};
  const startedAt = msg.startedAt ?? msg.call?.startedAt;
  const endedAt = msg.endedAt ?? msg.call?.endedAt;
  const durationSec =
    msg.durationSeconds ?? (startedAt && endedAt ? Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000) : undefined);
  const endedReason: string | undefined = msg.endedReason ?? msg.call?.endedReason;

  await upsertCall(callId, customerId, {
    status: "ended",
    channel: channelOf(msg),
    startedAt,
    endedAt,
    endedReason,
    durationSec,
    cost: msg.cost ?? msg.call?.cost,
    summary: analysis.summary ?? msg.summary,
    transcript: artifact.transcript ?? msg.transcript,
    recordingUrl: artifact.recording?.mono?.combinedUrl ?? artifact.recordingUrl ?? msg.recordingUrl,
    analysis: analysis.structuredData ?? undefined,
  });

  const state = await getState(customerId);
  await patchState(customerId, { callCount: (state.callCount ?? 0) + 1 });

  // Tools record outcomes in real time. If none fired during this call, fall back to the
  // ended reason, then to the post-call AI analysis.
  if (state.outcomeCallId !== callId && !state.paid) {
    let outcome: Outcome | undefined;
    if (endedReason && NO_CONTACT_REASONS.some((r) => endedReason.includes(r))) outcome = "no_answer";
    else outcome = ANALYSIS_TO_OUTCOME[analysis.structuredData?.outcome] ?? (durationSec && durationSec > 5 ? "no_resolution" : undefined);
    if (outcome) await setOutcome(customerId, outcome, analysis.structuredData?.customer_reason, callId, outcome === "do_not_call" ? { doNotCall: true } : {});
  }

  const mins = durationSec ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s` : "";
  await logEvent({
    customerId,
    callId,
    kind: "call",
    text: `Call ended${mins ? ` after ${mins}` : ""}${endedReason ? ` (${endedReason.replace(/-/g, " ")})` : ""}`,
  });
  const flags: string[] = analysis.structuredData?.compliance_flags ?? [];
  if (flags.length) {
    await logEvent({ customerId, callId, kind: "system", text: `⚠ QA flagged: ${flags.join("; ")}` });
  }
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const msg = body?.message;
  if (!msg?.type) return Response.json({ ok: true });

  try {
    switch (msg.type) {
      case "tool-calls":
        return await handleToolCalls(msg, req);
      case "status-update":
        await handleStatusUpdate(msg);
        break;
      case "end-of-call-report":
        await handleEndOfCall(msg);
        break;
    }
  } catch (err) {
    console.error(`vapi webhook ${msg.type} failed`, err);
  }
  // Always 200 so Vapi doesn't retry informational events.
  return Response.json({ ok: true });
}
