import { findCustomer } from "@/data/customers";
import { callOverrides } from "@/lib/agent";
import { baseUrlFrom, checkPasscode, config } from "@/lib/config";
import { maskPhone } from "@/lib/format";
import { phoneCallChecks, preCallChecks } from "@/lib/guards";
import { logEvent, upsertCall } from "@/lib/store";
import { createPhoneCall, ensureAssistant } from "@/lib/vapi";

export const dynamic = "force-dynamic";

/**
 * Places a REAL outbound phone call. Safety: the dialled number is always the operator's own
 * DEMO_DESTINATION_NUMBER. The fictional customer's number is never used for dialling.
 */
export async function POST(req: Request) {
  const auth = checkPasscode(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: 401 });

  const { customerId } = (await req.json().catch(() => ({}))) as { customerId?: string };
  const customer = findCustomer(customerId);
  if (!customer) return Response.json({ error: "Unknown customer" }, { status: 404 });

  for (const check of [phoneCallChecks(), await preCallChecks(customer)]) {
    if (!check.ok) return Response.json({ error: check.error }, { status: check.status });
  }

  const destination = config.demo.destinationNumber!;
  try {
    const assistantId = await ensureAssistant(baseUrlFrom(req));
    const call = await createPhoneCall({ assistantId, overrides: callOverrides(customer), destination, customerName: customer.name });
    await upsertCall(call.id, customer.id, { channel: "phone", status: call.status ?? "queued" });
    await logEvent({
      customerId: customer.id,
      callId: call.id,
      kind: "call",
      text: `Outbound call placed to operator demo phone ${maskPhone(destination)} (role-playing ${customer.firstName})`,
    });
    return Response.json({ callId: call.id });
  } catch (err) {
    console.error("outbound call failed", err);
    return Response.json({ error: err instanceof Error ? err.message : "Call failed" }, { status: 502 });
  }
}
