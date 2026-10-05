"use client";

import { ChevronRight, Mic, Phone, Sparkles } from "lucide-react";
import type { CustomerView } from "@/lib/types";
import { Avatar, inr, StatusBadge, statusDetail } from "./ui";

export default function CustomerCard(props: {
  c: CustomerView;
  recommended: boolean;
  live: boolean;
  talkDisabled: boolean;
  dialing: boolean;
  onOpen: () => void;
  onTalk: () => void;
  onPhone: () => void;
}) {
  const { c } = props;
  const blocked = c.status === "recovered" || c.status === "do_not_call" || c.status === "in_call";
  const detail = statusDetail(c);
  const ring = props.live
    ? "ring-2 ring-blue-500 shadow-lg shadow-blue-500/10"
    : c.status === "recovered"
      ? "ring-1 ring-emerald-200 bg-emerald-50/40"
      : "ring-1 ring-slate-200 hover:ring-slate-300 hover:shadow-md";

  return (
    <article
      onClick={props.onOpen}
      className={`group flex cursor-pointer flex-col rounded-2xl bg-white p-4 transition ${ring}`}
    >
      <div className="flex items-start gap-3">
        <Avatar name={c.name} id={c.id} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[15px] font-semibold text-slate-900">{c.name}</h3>
            {c.language === "hi" && <span className="rounded bg-slate-100 px-1.5 text-[10px] font-medium text-slate-600">Hindi</span>}
          </div>
          <p className="truncate text-xs text-slate-500">
            {c.merchant} · {c.category}
          </p>
        </div>
        <StatusBadge status={c.status} />
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-xl font-semibold tabular-nums tracking-tight text-slate-900">{inr(c.amount)}</p>
          <p className="text-xs text-slate-500">
            {c.failure.label} · {c.mandate.method}
          </p>
        </div>
        {detail && <p className="text-right text-[11px] text-slate-500">{detail}</p>}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
        <span className="font-medium">{c.scenario}</span>
        {props.recommended && (
          <span className="ml-auto rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">Start here</span>
        )}
      </p>

      <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={props.onTalk}
          disabled={props.talkDisabled || blocked}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          <Mic className="h-3.5 w-3.5" /> Talk
        </button>
        <button
          onClick={props.onPhone}
          disabled={blocked || props.dialing}
          title="Ring my own phone"
          className="flex items-center justify-center rounded-xl px-3 py-2 text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          <Phone className={`h-3.5 w-3.5 ${props.dialing ? "animate-pulse" : ""}`} />
        </button>
        <button
          onClick={props.onOpen}
          title="Details"
          className="flex items-center justify-center rounded-xl px-2 py-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
