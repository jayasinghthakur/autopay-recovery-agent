import { findCustomer } from "@/data/customers";
import MockPayButton from "@/components/MockPayButton";
import { formatINR } from "@/lib/format";
import { getLink } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Stand-in checkout used only when Razorpay test keys are not configured. */
export default async function MockCheckout({ params }: PageProps<"/pay/[linkId]">) {
  const { linkId } = await params;
  const link = await getLink(linkId);
  const customer = findCustomer(link?.customerId);

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-lg ring-1 ring-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-5 py-4 text-white">
          <p className="text-xs uppercase tracking-wider text-slate-400">Mock checkout · no real money</p>
          <p className="mt-1 text-lg font-semibold">{customer?.merchant ?? "Payment link"}</p>
        </div>
        {!link || !customer ? (
          <p className="p-5 text-sm text-slate-600">This payment link doesn&apos;t exist or has expired.</p>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <p className="text-sm text-slate-500">{customer.plan}</p>
              <p className="text-3xl font-semibold text-slate-900">{formatINR(link.amount)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {link.type === "update_mandate" ? "Pay this bill and re-authorise autopay" : "Pay your failed autopay instalment"}
              </p>
            </div>
            {link.status === "paid" ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">Already paid. Thank you!</p>
            ) : (
              <MockPayButton linkId={link.id} amount={formatINR(link.amount)} />
            )}
            <p className="text-[11px] leading-relaxed text-slate-400">
              Razorpay test keys aren&apos;t configured on this deployment, so this simulated page stands in for Razorpay Checkout.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
