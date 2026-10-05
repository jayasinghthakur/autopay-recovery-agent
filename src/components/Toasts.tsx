"use client";

import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";

export interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  title: string;
  body?: string;
}

const STYLE = {
  success: { icon: <CircleCheck className="h-5 w-5 text-emerald-500" />, ring: "ring-emerald-200" },
  error: { icon: <TriangleAlert className="h-5 w-5 text-rose-500" />, ring: "ring-rose-200" },
  info: { icon: <Info className="h-5 w-5 text-blue-500" />, ring: "ring-slate-200" },
};

export default function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:top-auto sm:items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-white p-3 shadow-lg ring-1 ${STYLE[t.kind].ring}`}
        >
          {STYLE[t.kind].icon}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">{t.title}</p>
            {t.body && <p className="mt-0.5 text-xs text-slate-600">{t.body}</p>}
          </div>
          <button onClick={() => onDismiss(t.id)} className="text-slate-400 hover:text-slate-700" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
