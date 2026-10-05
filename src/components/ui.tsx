import type { CustomerView, DisplayStatus } from "@/lib/types";

export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/jayasinghthakur/autopay-recovery-agent";

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00Z`));
}

export function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).format(
    new Date(iso),
  );
}

export function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function fmtDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

const STATUS: Record<DisplayStatus, { label: string; cls: string; dot: string }> = {
  pending: { label: "Not called", cls: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  in_call: { label: "On call", cls: "bg-blue-50 text-blue-700", dot: "bg-blue-500 animate-pulse" },
  recovered: { label: "Recovered", cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  awaiting_payment: { label: "Link sent", cls: "bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  retry_scheduled: { label: "Retry set", cls: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  callback: { label: "Callback", cls: "bg-violet-50 text-violet-700", dot: "bg-violet-500" },
  escalated: { label: "Escalated", cls: "bg-orange-50 text-orange-700", dot: "bg-orange-500" },
  do_not_call: { label: "Do not call", cls: "bg-zinc-100 text-zinc-600", dot: "bg-zinc-500" },
  follow_up: { label: "Follow up", cls: "bg-rose-50 text-rose-700", dot: "bg-rose-500" },
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

const OUTCOME_LABEL: Record<string, string> = {
  link_sent: "Payment link sent",
  retry_scheduled: "Retry scheduled",
  callback_scheduled: "Callback booked",
  dispute: "Dispute raised",
  cancellation_request: "Wants to cancel",
  hardship: "Hardship",
  escalate_to_human: "Needs a human",
  do_not_call: "Do not call",
  wrong_person: "Wrong person",
  not_verified: "Not verified",
  refused: "Declined",
  no_answer: "No answer",
  no_resolution: "No resolution",
};

export const outcomeLabel = (o?: string) => (o ? (OUTCOME_LABEL[o] ?? o.replace(/_/g, " ")) : "");

/** Short context under the status badge. */
export function statusDetail(c: CustomerView): string {
  const s = c.state;
  switch (c.status) {
    case "recovered":
      return s.paid ? fmtDateTime(s.paid.at) : "";
    case "awaiting_payment":
      return s.paymentLink?.type === "update_mandate" ? "Pay + re-authorise" : "Awaiting payment";
    case "retry_scheduled":
      return s.retryDate ? `on ${fmtDate(s.retryDate)}` : "";
    case "callback":
      return s.callbackAt ? fmtDateTime(s.callbackAt) : "";
    case "in_call":
      return c.lastCall?.channel === "phone" ? "Phone" : "Browser";
    case "pending":
      return "";
    default:
      return outcomeLabel(s.outcome);
  }
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

export function Avatar({ name, id, size = "md" }: { name: string; id: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  const color = AVATAR_COLORS[Number(id.replace(/\D/g, "")) % AVATAR_COLORS.length];
  const dim = size === "lg" ? "h-12 w-12 text-base" : size === "sm" ? "h-7 w-7 text-[11px]" : "h-10 w-10 text-sm";
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${dim} ${color}`}>{initials}</span>;
}

export function GitHubMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
