"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MockPayButton({ linkId, amount }: { linkId: string; amount: string }) {
  const router = useRouter();
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
    <div className="space-y-2">
      <button
        onClick={pay}
        disabled={busy}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {busy ? "Processing…" : `Pay ${amount} with UPI (simulated)`}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
