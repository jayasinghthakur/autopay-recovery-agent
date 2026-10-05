import Link from "next/link";

const MESSAGES: Record<string, { title: string; body: string; ok: boolean }> = {
  paid: { title: "Payment successful", body: "Thank you! Your subscription continues without interruption.", ok: true },
  invalid_signature: { title: "Couldn't verify payment", body: "The payment response signature didn't verify, so it wasn't recorded.", ok: false },
};

export default async function PayDone({ searchParams }: PageProps<"/pay/done">) {
  const { status } = await searchParams;
  const key = typeof status === "string" ? status : "";
  const msg = MESSAGES[key] ?? { title: "Payment not completed", body: `Status: ${key || "unknown"}. You can retry from the same link.`, ok: false };

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-lg ring-1 ring-slate-200">
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-2xl ${msg.ok ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}
        >
          {msg.ok ? "✓" : "!"}
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">{msg.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{msg.body}</p>
        <Link href="/" className="mt-5 inline-block text-sm font-medium text-blue-600 hover:underline">
          ← Back to the recovery dashboard
        </Link>
      </div>
    </main>
  );
}
