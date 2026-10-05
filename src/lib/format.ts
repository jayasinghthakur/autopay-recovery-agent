/** Date, time and currency helpers. Everything customer-facing runs on India Standard Time. */

export const IST = "Asia/Kolkata";

/** YYYY-MM-DD for a moment, as seen in IST. */
export function istDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(d);
}

export function istHour(d: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour: "numeric", hourCycle: "h23" }).format(d));
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Friday, 9 October" — how the agent should say a date out loud. */
export function spokenDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

/** "Monday, 5 October 2026, 3:42 pm IST" */
export function nowSpokenIST(d: Date = new Date()): string {
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return `${s} IST`;
}

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

const ONES = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} hundred` : "", r ? belowHundred(r) : ""].filter(Boolean).join(" and ");
}

/** Indian numbering in words, e.g. 8200 -> "eight thousand two hundred rupees". */
export function rupeesInWords(amount: number): string {
  let n = Math.round(amount);
  if (n === 0) return "zero rupees";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${belowThousand(crore)} crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} thousand`);
  if (n) parts.push(belowThousand(n));
  return `${parts.join(" ")} rupees`;
}

export function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  return `+${digits.slice(0, digits.length - 10)} ••••• •${digits.slice(-4)}`;
}

export function last4(e164: string): string {
  return e164.replace(/\D/g, "").slice(-4);
}
