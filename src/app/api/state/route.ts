import { baseUrlFrom, config, phoneCallsReady } from "@/lib/config";
import { maskPhone } from "@/lib/format";
import { withinCallingHours } from "@/lib/guards";
import { kv } from "@/lib/kv";
import { razorpayEnabled } from "@/lib/razorpay";
import { buildCustomerViews, getActivity, getVersion } from "@/lib/store";
import type { Snapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Dashboard polling endpoint. Returns {unchanged:true} cheaply when nothing changed since ?v=. */
export async function GET(req: Request) {
  const version = await getVersion();
  const since = new URL(req.url).searchParams.get("v");
  if (since !== null && Number(since) === version) return Response.json({ unchanged: true, version });

  const [customers, activity] = await Promise.all([buildCustomerViews(), getActivity()]);
  const webhookUrl = `${baseUrlFrom(req)}/api/vapi/webhook`;
  const dest = config.demo.destinationNumber;

  const snapshot: Snapshot = {
    version,
    customers,
    ...activity,
    setup: {
      webCalls: Boolean(config.vapi.privateKey && config.vapi.publicKey),
      phoneCalls: phoneCallsReady(),
      destinationMasked: dest ? maskPhone(dest) : undefined,
      payments: razorpayEnabled() ? "razorpay-test" : "mock",
      storage: kv().kind,
      webhookUrl,
      webhookReachable: !/localhost|127\.0\.0\.1/.test(webhookUrl),
      callingHoursOpen: withinCallingHours(),
      callingHoursEnforced: !config.demo.ignoreCallingHours,
      passcodeRequired: Boolean(config.demo.adminPasscode) || process.env.NODE_ENV === "production",
    },
  };
  return Response.json(snapshot);
}
