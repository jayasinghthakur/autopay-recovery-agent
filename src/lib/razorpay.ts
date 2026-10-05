import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { CustomerRecord } from "@/data/customers";
import { config } from "@/lib/config";
import type { PaymentLink } from "@/lib/types";

const API = "https://api.razorpay.com/v1";

export function razorpayEnabled(): boolean {
  return Boolean(config.razorpay.keyId && config.razorpay.keySecret);
}

function authHeader() {
  return `Basic ${Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString("base64")}`;
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Creates a Razorpay Payment Link (test mode keys) or, without keys, a local mock link.
 * Razorpay's own SMS/email notifications are disabled: the fictional contact details
 * must never receive anything. The dashboard shows a simulated SMS instead.
 */
export async function createPaymentLink(opts: {
  customer: CustomerRecord;
  type: PaymentLink["type"];
  baseUrl: string;
  callId?: string;
}): Promise<PaymentLink> {
  const { customer, type, baseUrl, callId } = opts;
  const createdAt = new Date().toISOString();

  if (!razorpayEnabled()) {
    const id = `mock_${randomBytes(6).toString("hex")}`;
    return { id, url: `${baseUrl}/pay/${id}`, type, provider: "mock", amount: customer.amount, status: "created", createdAt, callId };
  }

  const purpose = type === "update_mandate" ? "pay & re-authorise autopay" : "pay failed autopay";
  const res = await fetch(`${API}/payment_links`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: customer.amount * 100, // paise
      currency: "INR",
      accept_partial: false,
      description: `${customer.merchant} – ${customer.plan} (${purpose})`,
      customer: { name: customer.name, email: customer.email },
      notify: { sms: false, email: false },
      reminder_enable: false,
      reference_id: `${customer.id}-${Date.now().toString(36)}`.slice(0, 40),
      notes: { customer_id: customer.id, link_type: type, call_id: callId ?? "" },
      callback_url: `${baseUrl}/api/razorpay/callback`,
      callback_method: "get",
      expire_by: Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60,
    }),
  });
  const body = (await res.json()) as { id?: string; short_url?: string; error?: { description?: string } };
  if (!res.ok || !body.id || !body.short_url) {
    throw new Error(`Razorpay payment link failed: ${body.error?.description ?? res.status}`);
  }
  return { id: body.id, url: body.short_url, type, provider: "razorpay", amount: customer.amount, status: "created", createdAt, callId };
}

export async function fetchLinkStatus(linkId: string): Promise<{ status: string; paymentId?: string }> {
  const res = await fetch(`${API}/payment_links/${linkId}`, { headers: { Authorization: authHeader() }, cache: "no-store" });
  if (!res.ok) throw new Error(`Razorpay fetch failed: ${res.status}`);
  const body = (await res.json()) as { status: string; payments?: { payment_id: string; status: string }[] };
  const captured = body.payments?.find((p) => p.status === "captured");
  return { status: body.status, paymentId: captured?.payment_id };
}

/** Signature on the redirect back to callback_url, keyed with the API key secret. */
export function verifyCallbackSignature(p: {
  paymentLinkId: string;
  referenceId: string;
  status: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!config.razorpay.keySecret) return false;
  const expected = createHmac("sha256", config.razorpay.keySecret)
    .update(`${p.paymentLinkId}|${p.referenceId}|${p.status}|${p.paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, p.signature);
}

/** Webhook signature: HMAC-SHA256 of the raw body, keyed with the webhook secret. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!config.razorpay.webhookSecret || !signature) return false;
  const expected = createHmac("sha256", config.razorpay.webhookSecret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
