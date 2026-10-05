import { kv } from "@/lib/kv";
import { markPaid } from "@/lib/payments";
import { verifyWebhookSignature } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

/**
 * Optional server-to-server confirmation (configure in Razorpay Dashboard → Webhooks with
 * the `payment_link.paid` event). Covers customers who close the tab before the redirect.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"))) {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  const eventId = req.headers.get("x-razorpay-event-id");
  if (eventId && !(await kv().setnx(`avr:rzp-event:${eventId}`, 1, 60 * 60 * 24))) {
    return Response.json({ ok: true, duplicate: true });
  }

  const event = JSON.parse(raw) as {
    event: string;
    payload?: { payment_link?: { entity?: { id?: string } }; payment?: { entity?: { id?: string } } };
  };
  const linkId = event.payload?.payment_link?.entity?.id;
  if (event.event === "payment_link.paid" && linkId) {
    await markPaid(linkId, { paymentId: event.payload?.payment?.entity?.id, via: "razorpay" });
  }
  return Response.json({ ok: true });
}
