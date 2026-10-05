"use client";

import { ChevronDown, Clock, CreditCard, Database, Headphones, Phone, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { Snapshot } from "@/lib/types";

type Level = "ok" | "warn" | "off";

const DOT: Record<Level, string> = { ok: "bg-emerald-500", warn: "bg-amber-500", off: "bg-slate-300" };

/** One compact "system status" control instead of a row of setup pills. */
export default function StatusMenu({ setup, onReset }: { setup: Snapshot["setup"]; onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const ready = setup.webCalls && setup.webhookReachable;

  const rows: { icon: React.ReactNode; label: string; value: string; level: Level }[] = [
    { icon: <Headphones className="h-4 w-4" />, label: "Browser calls", value: setup.webCalls ? "On" : "Add Vapi keys", level: setup.webCalls ? "ok" : "warn" },
    {
      icon: <Phone className="h-4 w-4" />,
      label: "Phone calls",
      value: setup.phoneCalls ? `→ ${setup.destinationMasked}` : "Not set up",
      level: setup.phoneCalls ? "ok" : "off",
    },
    {
      icon: <CreditCard className="h-4 w-4" />,
      label: "Payments",
      value: setup.payments === "razorpay-test" ? "Razorpay test mode" : "Mock checkout",
      level: setup.payments === "razorpay-test" ? "ok" : "warn",
    },
    {
      icon: <Database className="h-4 w-4" />,
      label: "Storage",
      value: setup.storage === "redis" ? "Redis" : "In-memory",
      level: setup.storage === "redis" ? "ok" : "warn",
    },
    {
      icon: <Clock className="h-4 w-4" />,
      label: "Calling hours",
      value: !setup.callingHoursEnforced ? "Overridden" : setup.callingHoursOpen ? "Open · 8am–7pm IST" : "Closed · 8am–7pm IST",
      level: !setup.callingHoursEnforced || setup.callingHoursOpen ? "ok" : "warn",
    },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        aria-expanded={open}
      >
        <span className={`h-2 w-2 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-500"}`} />
        <span className="hidden sm:inline">{ready ? "Live" : "Setup needed"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl bg-white p-2 shadow-xl ring-1 ring-slate-200">
            <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">System status</p>
            <ul>
              {rows.map((r) => (
                <li key={r.label} className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm">
                  <span className="text-slate-400">{r.icon}</span>
                  <span className="text-slate-700">{r.label}</span>
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
                    {r.value}
                    <span className={`h-1.5 w-1.5 rounded-full ${DOT[r.level]}`} />
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-1 border-t border-slate-100 pt-1">
              <button
                onClick={() => {
                  setOpen(false);
                  onReset();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4 text-slate-400" /> Reset demo data
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
