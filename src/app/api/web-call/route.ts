import { findCustomer } from "@/data/customers";
import { callOverrides } from "@/lib/agent";
import { baseUrlFrom, config } from "@/lib/config";
import { istDate } from "@/lib/format";
import { preCallChecks } from "@/lib/guards";
import { kv } from "@/lib/kv";
import { ensureAssistant } from "@/lib/vapi";

export const dynamic = "force-dynamic";

/**
 * Returns what the browser needs to start a WebRTC call with the agent: the public key,
 * the saved assistant id, and per-customer overrides (non-sensitive context only).
 */
export async function POST(req: Request) {
  if (!config.vapi.privateKey || !config.vapi.publicKey) {
    return Response.json({ error: "Browser calls need VAPI_PRIVATE_KEY and VAPI_PUBLIC_KEY on the server." }, { status: 503 });
  }
  const { customerId } = (await req.json().catch(() => ({}))) as { customerId?: string };
  const customer = findCustomer(customerId);
  if (!customer) return Response.json({ error: "Unknown customer" }, { status: 404 });

  const check = await preCallChecks(customer);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  // A public demo link shouldn't be able to drain the Vapi credits.
  const used = await kv().incr(`avr:webcalls:${istDate()}`, 60 * 60 * 48);
  if (used > config.demo.webCallDailyLimit) {
    return Response.json({ error: "Daily browser-call limit reached for this demo. Please try again tomorrow." }, { status: 429 });
  }

  try {
    const assistantId = await ensureAssistant(baseUrlFrom(req));
    return Response.json({ publicKey: config.vapi.publicKey, assistantId, assistantOverrides: callOverrides(customer) });
  } catch (err) {
    console.error("web call setup failed", err);
    return Response.json({ error: err instanceof Error ? err.message : "Setup failed" }, { status: 502 });
  }
}
