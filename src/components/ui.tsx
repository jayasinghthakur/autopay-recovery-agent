import type { CustomerView, DisplayStatus } from "@/lib/types";

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

export function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

const STATUS: Record<DisplayStatus, { label: string; cls: string }> = {
  pending: { label: "Not contacted", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  in_call: { label: "In call", cls: "bg-blue-100 text-blue-700 ring-blue-200 animate-pulse" },
  recovered: { label: "Recovered", cls: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
  awaiting_payment: { label: "Link sent", cls: "bg-sky-100 text-sky-700 ring-sky-200" },
  retry_scheduled: { label: "Retry scheduled", cls: "bg-amber-100 text-amber-800 ring-amber-200" },
  callback: { label: "Callback", cls: "bg-violet-100 text-violet-700 ring-violet-200" },
  escalated: { label: "Escalated", cls: "bg-orange-100 text-orange-700 ring-orange-200" },
  do_not_call: { label: "Do not call", cls: "bg-zinc-200 text-zinc-700 ring-zinc-300" },
  follow_up: { label: "Needs follow-up", cls: "bg-rose-100 text-rose-700 ring-rose-200" },
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.cls}`}>
      {s.label}
    </span>
  );
}

const OUTCOME_LABEL: Record<string, string> = {
  link_sent: "Payment link sent",
  retry_scheduled: "Retry scheduled",
  callback_scheduled: "Callback scheduled",
  dispute: "Dispute raised",
  cancellation_request: "Wants to cancel",
  hardship: "Financial hardship",
  escalate_to_human: "Asked for a human",
  do_not_call: "Asked not to be called",
  wrong_person: "Wrong person answered",
  not_verified: "Failed verification",
  refused: "Declined to pay",
  no_answer: "No answer",
  no_resolution: "No resolution",
};

export const outcomeLabel = (o?: string) => (o ? (OUTCOME_LABEL[o] ?? o.replace(/_/g, " ")) : "");

/** One-line context under the status badge. */
export function statusDetail(c: CustomerView): string {
  const s = c.state;
  switch (c.status) {
    case "recovered":
      return s.paid ? `Paid ${fmtDateTime(s.paid.at)}` : "";
    case "awaiting_payment":
      return s.paymentLink?.type === "update_mandate" ? "Pay + re-authorise autopay" : "Awaiting payment";
    case "retry_scheduled":
      return s.retryDate ? `Auto-debit on ${fmtDate(s.retryDate)}` : "";
    case "callback":
      return s.callbackAt ? fmtDateTime(s.callbackAt) : "";
    case "in_call":
      return c.lastCall?.channel === "phone" ? "Phone call" : "Browser call";
    case "pending":
      return "";
    default:
      return outcomeLabel(s.outcome);
  }
}

export function Pill({ ok, children, title }: { ok: boolean | "warn"; children: React.ReactNode; title?: string }) {
  const cls =
    ok === true
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : ok === "warn"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-slate-50 text-slate-500 ring-slate-200";
  const dot = ok === true ? "bg-emerald-500" : ok === "warn" ? "bg-amber-500" : "bg-slate-300";
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}
