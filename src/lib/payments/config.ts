// Online-payment enablement, derived PURELY from the presence of a provider's
// environment variables (fail-closed). No new settings column, no admin toggle.
// Declared with a local env type so src/config/runtime.ts can import this module
// without an import cycle.

export type SafepayStatus = "ABSENT" | "PARTIAL" | "READY";
export type OnlinePaymentStatus = "DISABLED" | "MISCONFIGURED" | "ENABLED";
export type OnlinePaymentConfig = { safepay: SafepayStatus; status: OnlinePaymentStatus };

type Env = Record<string, string | undefined>;

// Required Safepay variables. The online option is shown and accepted ONLY when
// all three are present and non-empty; otherwise the storefront runs COD-only.
export const SAFEPAY_REQUIRED_VARS = ["SAFEPAY_ENVIRONMENT", "SAFEPAY_API_KEY", "SAFEPAY_WEBHOOK_SECRET"] as const;

function presenceStatus(env: Env, names: readonly string[]): SafepayStatus {
  const present = names.filter((name) => (env[name]?.trim() ?? "") !== "").length;
  if (present === 0) return "ABSENT";
  if (present === names.length) return "READY";
  return "PARTIAL";
}

export function readOnlinePaymentConfig(env: Env): OnlinePaymentConfig {
  const safepay = presenceStatus(env, SAFEPAY_REQUIRED_VARS);
  const status: OnlinePaymentStatus = safepay === "ABSENT" ? "DISABLED" : safepay === "READY" ? "ENABLED" : "MISCONFIGURED";
  return { safepay, status };
}

export function onlinePaymentsEnabled(env: Env): boolean {
  return readOnlinePaymentConfig(env).status === "ENABLED";
}
