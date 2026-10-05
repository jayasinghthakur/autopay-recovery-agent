import { createHash } from "node:crypto";
import { buildAssistant } from "@/lib/agent";
import { config } from "@/lib/config";
import { kv } from "@/lib/kv";

const API = "https://api.vapi.ai";
const ASSISTANT_CACHE_PREFIX = "avr:vapi:assistant";

async function vapi<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!config.vapi.privateKey) throw new Error("VAPI_PRIVATE_KEY is not configured.");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${config.vapi.privateKey}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      detail = Array.isArray(j.message) ? j.message.join("; ") : (j.message ?? text);
    } catch {}
    throw new Error(`Vapi ${init.method ?? "GET"} ${path} failed (${res.status}): ${detail}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * The assistant is kept as a saved Vapi assistant (not an inline one) so that the webhook
 * secret header never reaches the browser during web calls. It is created/updated
 * automatically whenever the config in code changes — no manual dashboard setup.
 */
export async function ensureAssistant(baseUrl: string): Promise<string> {
  const body = buildAssistant(baseUrl);
  const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 16);
  // Keyed by assistant name (i.e. deployment URL) so environments sharing one Redis don't collide.
  const cacheKey = `${ASSISTANT_CACHE_PREFIX}:${body.name}`;
  const cached = await kv().get<{ id: string; hash: string }>(cacheKey);
  if (cached?.hash === hash) return cached.id;

  let id = cached?.id;
  if (!id) {
    const existing = await vapi<{ id: string; name?: string }[]>("/assistant?limit=100");
    id = (Array.isArray(existing) ? existing : []).find((a) => a.name === body.name)?.id;
  }

  if (id) {
    try {
      await vapi(`/assistant/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    } catch (err) {
      if (!String(err).includes("(404)")) throw err;
      id = undefined; // deleted in the dashboard; recreate below
    }
  }
  if (!id) {
    id = (await vapi<{ id: string }>("/assistant", { method: "POST", body: JSON.stringify(body) })).id;
  }

  await kv().set(cacheKey, { id, hash });
  return id;
}

export async function createPhoneCall(opts: {
  assistantId: string;
  overrides: object;
  destination: string;
  customerName: string;
}): Promise<{ id: string; status: string }> {
  return vapi("/call", {
    method: "POST",
    body: JSON.stringify({
      assistantId: opts.assistantId,
      assistantOverrides: opts.overrides,
      phoneNumberId: config.vapi.phoneNumberId,
      customer: { number: opts.destination, name: opts.customerName },
    }),
  });
}
