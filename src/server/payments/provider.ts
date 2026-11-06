import { onlinePaymentsEnabled } from "@/lib/payments/config";
import type { PaymentProvider } from "@/lib/payments/types";
import { ApiError } from "../http";
import { createSafepayProvider } from "./safepay";

export type { PaymentProvider } from "@/lib/payments/types";

// ApiError-like signature failure → HTTP 400 (no state change, abuse log at the route).
export class PaymentSignatureError extends ApiError {
  constructor(message = "The webhook signature could not be verified.") {
    super(400, "PAYMENT_SIGNATURE_INVALID", message);
  }
}

type Env = Record<string, string | undefined>;

// Registry of online/webhook providers. Returns null for an unknown name or a
// provider whose env is not READY (fail-closed → the route answers 404). Adding a
// future gateway is one new case here plus its adapter file.
export function resolveProvider(name: string, env: Env): PaymentProvider | null {
  if (name === "safepay") return onlinePaymentsEnabled(env) ? createSafepayProvider(env) : null;
  return null;
}
