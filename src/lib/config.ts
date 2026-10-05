import { createHash } from "node:crypto";

const env = (k: string) => process.env[k]?.trim() || undefined;

export const config = {
  vapi: {
    privateKey: env("VAPI_PRIVATE_KEY"),
    publicKey: env("VAPI_PUBLIC_KEY") ?? env("NEXT_PUBLIC_VAPI_PUBLIC_KEY"),
    phoneNumberId: env("VAPI_PHONE_NUMBER_ID"),
    modelProvider: env("VAPI_MODEL_PROVIDER") ?? "openai",
    model: env("VAPI_MODEL") ?? "gpt-4.1",
    voiceProvider: env("VAPI_VOICE_PROVIDER") ?? "vapi",
    voiceId: env("VAPI_VOICE_ID") ?? "Elliot",
    voiceVersion: env("VAPI_VOICE_VERSION"),
  },
  razorpay: {
    keyId: env("RAZORPAY_KEY_ID"),
    keySecret: env("RAZORPAY_KEY_SECRET"),
    webhookSecret: env("RAZORPAY_WEBHOOK_SECRET"),
  },
  demo: {
    /** The ONLY number this app will ever dial. Must be a number you own or have permission to call. */
    destinationNumber: env("DEMO_DESTINATION_NUMBER"),
    adminPasscode: env("ADMIN_PASSCODE"),
    ignoreCallingHours: env("IGNORE_CALLING_HOURS") === "true",
    webCallDailyLimit: Number(env("WEB_CALL_DAILY_LIMIT") ?? 40),
  },
  publicBaseUrl: env("PUBLIC_BASE_URL"),
};

/**
 * Shared secret Vapi sends back to our webhook in a header. Derived from the private
 * key when not set explicitly so a fresh deploy is secure without extra setup.
 */
export function webhookSecret(): string {
  const explicit = env("VAPI_WEBHOOK_SECRET");
  if (explicit) return explicit;
  return createHash("sha256").update(`avr-webhook:${config.vapi.privateKey ?? "dev"}`).digest("hex").slice(0, 40);
}

/** Public URL Vapi/Razorpay can reach. Prefer explicit config, then the URL the request came in on. */
export function baseUrlFrom(req: Request): string {
  if (config.publicBaseUrl) return config.publicBaseUrl.replace(/\/$/, "");
  const prod = env("VERCEL_PROJECT_PRODUCTION_URL");
  if (prod) return `https://${prod}`;
  return new URL(req.url).origin;
}

export const E164 = /^\+[1-9]\d{7,14}$/;

export function phoneCallsReady(): boolean {
  return Boolean(
    config.vapi.privateKey &&
      config.vapi.phoneNumberId &&
      config.demo.destinationNumber &&
      E164.test(config.demo.destinationNumber),
  );
}

export function checkPasscode(req: Request): { ok: true } | { ok: false; error: string } {
  const expected = config.demo.adminPasscode;
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "ADMIN_PASSCODE is not configured on the server, so operator actions are disabled." };
    }
    return { ok: true }; // local development convenience
  }
  const got = req.headers.get("x-operator-passcode");
  return got === expected ? { ok: true } : { ok: false, error: "Wrong or missing operator passcode." };
}
