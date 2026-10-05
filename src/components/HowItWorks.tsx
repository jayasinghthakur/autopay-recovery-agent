import { BadgeCheck, Ban, CircleCheck, Code, Lock, PhoneCall, PhoneOff, Route, Scale, ShieldCheck, UserCheck } from "lucide-react";
import { GitHubMark, REPO_URL } from "./ui";

const FLOW = [
  { icon: PhoneOff, title: "Autopay fails", sub: "Low balance, expired card, limit…" },
  { icon: PhoneCall, title: "Agent calls", sub: "Discloses it's an AI" },
  { icon: ShieldCheck, title: "Verifies", sub: "Checked on the server" },
  { icon: Route, title: "Picks the fix", sub: "Link · retry · callback · human" },
  { icon: CircleCheck, title: "Recovered", sub: "Razorpay test payment" },
];

const GUARDRAILS = [
  { icon: Lock, title: "Only my number", sub: "Calls dial one allow-listed phone" },
  { icon: UserCheck, title: "Verify first", sub: "No details before identity check" },
  { icon: Code, title: "Rules in code", sub: "Retry window & hours enforced by API" },
  { icon: Scale, title: "Fair collections", sub: "No threats, no OTPs, 8am–7pm IST" },
  { icon: Ban, title: "Do-not-call", sub: "Honoured instantly, blocks redials" },
  { icon: BadgeCheck, title: "Post-call QA", sub: "Summary + compliance check" },
];

const STACK = ["Vapi", "GPT-4.1", "Deepgram", "Razorpay Test Mode", "Next.js", "Upstash Redis"];

export default function HowItWorks() {
  return (
    <section id="how" className="mt-16 scroll-mt-20">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">How it works</h2>

      <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {FLOW.map(({ icon: Icon, title, sub }, i) => (
          <li key={title} className="relative rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="text-[11px] font-semibold text-slate-300">0{i + 1}</span>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
            <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
          </li>
        ))}
      </ol>

      <h3 className="mt-8 text-sm font-semibold text-slate-900">Guardrails</h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {GUARDRAILS.map(({ icon: Icon, title, sub }) => (
          <li key={title} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
            <Icon className="h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-sm">
              <span className="font-medium text-slate-900">{title}</span>
              <span className="text-slate-500"> — {sub}</span>
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium text-slate-500">Built with</span>
        {STACK.map((s) => (
          <span key={s} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
            {s}
          </span>
        ))}
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
        >
          <GitHubMark className="h-3.5 w-3.5" /> Source code
        </a>
      </div>
    </section>
  );
}
