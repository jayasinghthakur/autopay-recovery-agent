import type { CustomerRecord } from "@/data/customers";
import { config, E164 } from "@/lib/config";
import { istHour } from "@/lib/format";
import { getLastCall, getState, isCallActive } from "@/lib/store";

/** RBI fair-practice guidance for recovery calls: 8:00 AM – 7:00 PM in the customer's time zone. */
export function withinCallingHours(now = new Date()): boolean {
  const h = istHour(now);
  return h >= 8 && h < 19;
}

export type GuardResult = { ok: true } | { ok: false; error: string; status: number };

/** Checks that apply to every call, browser or phone. */
export async function preCallChecks(c: CustomerRecord): Promise<GuardResult> {
  const state = await getState(c.id);
  if (state.doNotCall) return { ok: false, status: 409, error: `${c.name} asked not to be called (do-not-call). Calls are blocked.` };
  if (state.paid) return { ok: false, status: 409, error: `${c.name} has already paid — nothing to recover.` };
  if (isCallActive(await getLastCall(c.id))) return { ok: false, status: 409, error: `A call with ${c.name} is already in progress.` };
  return { ok: true };
}

/** Extra checks for real outbound phone calls. */
export function phoneCallChecks(): GuardResult {
  const dest = config.demo.destinationNumber;
  if (!config.vapi.privateKey || !config.vapi.phoneNumberId) {
    return { ok: false, status: 503, error: "Phone calls need VAPI_PRIVATE_KEY and VAPI_PHONE_NUMBER_ID (an imported Twilio/Vonage/Telnyx number)." };
  }
  if (!dest || !E164.test(dest)) {
    return { ok: false, status: 503, error: "Set DEMO_DESTINATION_NUMBER to your own phone number in E.164 format, e.g. +919812345678." };
  }
  if (!config.demo.ignoreCallingHours && !withinCallingHours()) {
    return { ok: false, status: 403, error: "Outside permitted calling hours (8 AM – 7 PM IST). Set IGNORE_CALLING_HOURS=true to override for a demo." };
  }
  return { ok: true };
}
