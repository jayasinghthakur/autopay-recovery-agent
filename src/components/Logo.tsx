"use client";

import { useId } from "react";

/** Brand mark: a voice waveform inside a "recover / retry" arrow. Mirrors src/app/icon.svg. */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#4338CA" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id})`} />
      <g fill="none" stroke="#fff" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M48.5 32a16.5 16.5 0 1 1-16.5-16.5c4.6 0 9 1.8 12.4 5L48.5 24.7" />
        <path d="M48.5 15.5v9.2h-9.2" />
      </g>
      <g fill="#fff">
        <rect x="23.5" y="28" width="4.2" height="8" rx="2.1" />
        <rect x="29.9" y="23.5" width="4.2" height="17" rx="2.1" />
        <rect x="36.3" y="26.5" width="4.2" height="11" rx="2.1" />
      </g>
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={30} />
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight text-slate-900">Autopay Recovery</span>
        <span className="block text-[11px] font-medium text-slate-500">AI voice agent · demo</span>
      </span>
    </span>
  );
}
