import { markPaid } from "@/lib/payments";
import { verifyCallbackSignature } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

/** Razorpay redirects the customer here after checkout. We trust it only if the signature verifies. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = url.searchParams;
  const params = {
    paymentId: p.get("razorpay_payment_id") ?? "",
    paymentLinkId: p.get("razorpay_payment_link_id") ?? "",
    referenceId: p.get("razorpay_payment_link_reference_id") ?? "",
    status: p.get("razorpay_payment_link_status") ?? "",
    signature: p.get("razorpay_signature") ?? "",
  };

  let result = "failed";
  if (params.paymentLinkId && verifyCallbackSignature(params)) {
    if (params.status === "paid") {
      await markPaid(params.paymentLinkId, { paymentId: params.paymentId, via: "razorpay" });
      result = "paid";
    } else {
      result = params.status || "failed";
    }
  } else {
    result = "invalid_signature";
  }
  return Response.redirect(new URL(`/pay/done?status=${encodeURIComponent(result)}`, url.origin), 303);
}
