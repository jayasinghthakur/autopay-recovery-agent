"use client";

import { BadgeCheck, IndianRupee, PhoneCall, ShieldCheck, Zap } from "lucide-react";
import type { ActivityEvent, Snapshot } from "@/lib/types";
import { fmtTime } from "./ui";

const ICON: Record<ActivityEvent["kind"], { icon: React.ReactNode; cls: string }> = {
  call: { icon: <PhoneCall className="h-3 w-3" />, cls: "bg-slate-100 text-slate-500" },
  tool: { icon: <Zap className="h-3 w-3" />, cls: "bg-blue-50 text-blue-600" },
  payment: { icon: <IndianRupee className="h-3 w-3" />, cls: "bg-emerald-50 text-emerald-600" },
  outcome: { icon: <BadgeCheck className="h-3 w-3" />, cls: "bg-violet-50 text-violet-600" },
  system: { icon: <ShieldCheck className="h-3 w-3" />, cls: "bg-amber-50 text-amber-600" },
};

/** Every tool call the agent makes, as it happens. */
export default function ActivityFeed({ snap }: { snap: Snapshot | null }) {
  const names = new Map(snap?.customers.map((c) => [c.id, c.firstName]));
  const events = snap?.events ?? [];

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-slate-900">Agent activity</h2>
      <div className="rounded-2xl bg-white ring-1 ring-slate-200">
        {events.length === 0 ? (
          <p className="p-4 text-center text-xs text-slate-400">Tool calls appear here live.</p>
        ) : (
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {events.map((e, i) => (
              <li key={i} className="flex items-start gap-2.5 px-3 py-2.5">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${ICON[e.kind].cls}`}>
                  {ICON[e.kind].icon}
                </span>
                <p className="min-w-0 flex-1 text-xs leading-snug text-slate-600">
                  <span className="font-medium text-slate-900">{names.get(e.customerId)}</span> {e.text}
                </p>
                <span className="shrink-0 text-[10px] tabular-nums text-slate-400">{fmtTime(e.ts)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
