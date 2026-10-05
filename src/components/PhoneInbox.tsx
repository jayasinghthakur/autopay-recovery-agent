"use client";

import { Link2, Lock, Smartphone } from "lucide-react";
import type { Snapshot } from "@/lib/types";
import { fmtTime } from "./ui";

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Simulated SMS delivery, drawn as the customer's phone. */
export default function PhoneInbox({ snap }: { snap: Snapshot | null }) {
  const names = new Map(snap?.customers.map((c) => [c.id, c.firstName]));
  const sms = snap?.sms ?? [];

  return (
    <section>
      <h2 className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-900">
        Customer&apos;s phone
        <span className="text-[11px] font-normal text-slate-400">SMS simulated</span>
      </h2>
      <div className="mx-auto max-w-[320px] rounded-[2.2rem] bg-slate-900 p-2 shadow-xl">
        <div className="overflow-hidden rounded-[1.7rem] bg-slate-50">
          <div className="flex items-center justify-between px-5 pt-2.5 text-[10px] font-semibold text-slate-900">
            <span>9:41</span>
            <span className="h-4 w-20 rounded-full bg-slate-900" />
            <span>5G</span>
          </div>
          <p className="border-b border-slate-200 py-2 text-center text-[11px] font-semibold text-slate-700">Messages</p>
          <div className="flex h-64 flex-col-reverse gap-2 overflow-y-auto p-3">
            {sms.length === 0 && (
              <div className="m-auto flex flex-col items-center gap-2 text-center text-[11px] text-slate-400">
                <Smartphone className="h-6 w-6" />
                Payment links the agent sends land here.
              </div>
            )}
            {sms.map((m, i) => {
              const text = m.url ? m.body.replace(m.url, "").replace(/[:\s]+$/, "") : m.body;
              return (
                <div key={i} className="max-w-[88%]">
                  <p className="mb-0.5 px-1 text-[9px] text-slate-400">
                    To {names.get(m.customerId)} · {fmtTime(m.ts)}
                  </p>
                  <div className="rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-[12px] leading-snug text-slate-800 shadow-sm ring-1 ring-slate-200/60">
                    {text}
                    {m.url && (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 flex items-center gap-2 rounded-xl bg-blue-50 px-2.5 py-2 text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100"
                      >
                        <Lock className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-[11px] font-semibold">Pay securely</span>
                          <span className="block truncate text-[10px] text-blue-500">{hostOf(m.url)}</span>
                        </span>
                        <Link2 className="ml-auto h-3.5 w-3.5 shrink-0" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
