import { findCustomer } from "@/data/customers";
import { formatINR } from "@/lib/format";
import { getLink, getState, logEvent, patchState, saveLink, sendSimulatedSms } from "@/lib/store";

/** Idempotently marks a payment link (and its customer) as paid. Returns false if the link is unknown. */
export async function markPaid(linkId: string, opts: { paymentId?: string; via: "razorpay" | "mock" }): Promise<boolean> {
  const link = await getLink(linkId);
  const customer = findCustomer(link?.customerId);
  if (!link || !customer) return false;

  const state = await getState(customer.id);
  if (state.paid) return true;

  const paidLink = { ...link, status: "paid" as const };
  await saveLink(customer.id, paidLink);
  await patchState(customer.id, {
    paid: { at: new Date().toISOString(), amount: link.amount, paymentId: opts.paymentId, via: opts.via },
    paymentLink: state.paymentLink?.id === link.id ? { ...state.paymentLink, status: "paid" } : state.paymentLink,
  });
  await logEvent({
    customerId: customer.id,
    callId: link.callId,
    kind: "payment",
    text: `Payment received: ${formatINR(link.amount)} via ${opts.via === "razorpay" ? "Razorpay (test mode)" : "mock checkout"}${opts.paymentId ? ` · ${opts.paymentId}` : ""}`,
  });
  await sendSimulatedSms(
    customer,
    `${customer.merchant}: Payment of ${formatINR(link.amount)} received. Thank you, ${customer.firstName}! Your ${customer.plan} continues without interruption.`,
  );
  return true;
}
