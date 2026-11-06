import {
  buildSafepayCheckoutRequest,
  mapSafepayEventToStatus,
  parseSafepayCheckoutResponse,
  parseSafepayEvent,
  type SafepayAdapterConfig,
} from "@/lib/payments/safepay-events";
import { verifySafepaySignature } from "@/lib/payments/safepay-signature";
import type { CreateCheckoutInput, CreateCheckoutResult, PaymentProvider, PaymentStatus, VerifiedEvent } from "@/lib/payments/types";
import { ApiError } from "../http";
import { PaymentSignatureError } from "./provider";

type Env = Record<string, string | undefined>;

function readConfig(env: Env): SafepayAdapterConfig {
  return {
    environment: env.SAFEPAY_ENVIRONMENT?.trim() ?? "",
    apiKey: env.SAFEPAY_API_KEY?.trim() ?? "",
    webhookSecret: env.SAFEPAY_WEBHOOK_SECRET?.trim() ?? "",
  };
}

// Structural-only adapter (C-3): wires the env secrets onto the pure core. The
// single fetch in createCheckout is the one untested seam; request building,
// signature verification, parsing, and event mapping are all pure-tested.
export function createSafepayProvider(env: Env): PaymentProvider {
  const config = readConfig(env);
  return {
    name: "SAFEPAY",
    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
      const request = buildSafepayCheckoutRequest(input, config);
      let response: Response;
      try {
        response = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body });
      } catch {
        throw new ApiError(502, "PAYMENT_PROVIDER_ERROR", "The payment provider could not be reached.");
      }
      if (!response.ok) throw new ApiError(502, "PAYMENT_PROVIDER_ERROR", "The payment provider rejected the checkout request.");
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new ApiError(502, "PAYMENT_PROVIDER_ERROR", "The payment provider returned an unreadable response.");
      }
      const { providerReference, url } = parseSafepayCheckoutResponse(payload);
      // A non-empty tracker is REQUIRED: never persist a payment row with a null
      // correlation key. Abort (502) so beginOnlineCheckout persists nothing.
      if (!providerReference || !url) throw new ApiError(502, "PAYMENT_PROVIDER_ERROR", "The payment provider response was incomplete.");
      return { kind: "REDIRECT", url, providerReference };
    },
    verifyWebhook(headers: Headers, rawBody: string): VerifiedEvent {
      const signature = headers.get("x-sfpy-signature");
      const timestamp = headers.get("x-sfpy-timestamp");
      if (!verifySafepaySignature(rawBody, signature, config.webhookSecret, timestamp)) {
        throw new PaymentSignatureError();
      }
      return parseSafepayEvent(rawBody);
    },
    mapEventToStatus(event: VerifiedEvent): PaymentStatus | "IGNORE" {
      return mapSafepayEventToStatus(event);
    },
  };
}
