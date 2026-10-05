"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const METHODS = ["UPI", "Card", "Netbanking"];

export default function MockPayButton({ linkId, amount }: { linkId: string; amount: string }) {
  const router = useRouter();
  const [method, setMethod] = useState("UPI");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/mock-pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkId }),
    });
    if (res.ok) router.push("/pay/done?status=paid");
    else {
      setError("Payment failed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {METHODS.map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={`rounded-xl py-2 text-xs font-medium ring-1 transition ${
              method === m ? "bg-blue-50 text-blue-700 ring-blue-300" : "text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <button
        onClick={pay}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-60"
      >
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {busy ? "Processing…" : `Pay ${amount}`}
      </button>
      {error && <p className="text-center text-sm text-rose-600">{error}</p>}
    </div>
  );
}
