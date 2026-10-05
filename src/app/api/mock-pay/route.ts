import { randomBytes } from "node:crypto";
import { markPaid } from "@/lib/payments";
import { getLink } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Completes a payment on a MOCK link (used only when Razorpay test keys aren't configured). */
export async function POST(req: Request) {
  const { linkId } = (await req.json().catch(() => ({}))) as { linkId?: string };
  const link = linkId ? await getLink(linkId) : null;
  if (!link || link.provider !== "mock") return Response.json({ error: "Unknown link" }, { status: 404 });
  await markPaid(link.id, { via: "mock", paymentId: `pay_mock_${randomBytes(5).toString("hex")}` });
  return Response.json({ ok: true });
}
