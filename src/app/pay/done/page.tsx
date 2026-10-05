import { ArrowLeft, CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";

const MESSAGES: Record<string, { title: string; body: string; ok: boolean }> = {
  paid: { title: "Payment successful", body: "Your autopay is back on track. You can return to the call.", ok: true },
  invalid_signature: { title: "Couldn't verify payment", body: "The payment signature didn't match, so it wasn't recorded.", ok: false },
};

export default async function PayDone({ searchParams }: PageProps<"/pay/done">) {
  const { status } = await searchParams;
  const key = typeof status === "string" ? status : "";
  const msg = MESSAGES[key] ?? { title: "Payment not completed", body: "You can retry from the same link.", ok: false };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl ring-1 ring-slate-200">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${msg.ok ? "bg-emerald-50 text-emerald-500" : "bg-amber-50 text-amber-500"}`}
        >
          {msg.ok ? <CircleCheck className="h-8 w-8" /> : <TriangleAlert className="h-7 w-7" />}
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">{msg.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{msg.body}</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <LogoMark size={14} /> Autopay Recovery demo
        </p>
      </div>
    </main>
  );
}
