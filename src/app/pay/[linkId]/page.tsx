import { Lock } from "lucide-react";
import { findCustomer } from "@/data/customers";
import { LogoMark } from "@/components/Logo";
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
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200">
        {!link || !customer ? (
          <p className="p-6 text-sm text-slate-600">This payment link doesn&apos;t exist or has expired.</p>
        ) : (
          <>
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-6 pb-6 pt-5 text-white">
              <p className="text-xs font-medium text-blue-100">{customer.merchant}</p>
              <p className="mt-4 text-4xl font-semibold tabular-nums tracking-tight">{formatINR(link.amount)}</p>
              <p className="mt-1 text-sm text-blue-100">
                {link.type === "update_mandate" ? "Pay & re-authorise autopay" : customer.plan}
              </p>
            </div>
            <div className="space-y-4 p-6">
              {link.status === "paid" ? (
                <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">Already paid — thank you!</p>
              ) : (
                <MockPayButton linkId={link.id} amount={formatINR(link.amount)} />
              )}
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <Lock className="h-3 w-3" /> Simulated checkout · no real money
              </p>
            </div>
          </>
        )}
        <div className="flex items-center justify-center gap-1.5 border-t border-slate-100 py-3 text-[11px] text-slate-400">
          <LogoMark size={14} /> Autopay Recovery demo
        </div>
      </div>
    </main>
  );
}
