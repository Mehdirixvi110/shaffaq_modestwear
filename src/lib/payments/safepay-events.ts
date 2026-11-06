import { toProviderAmount } from "./amount";
import type { CreateCheckoutInput, PaymentStatus, VerifiedEvent } from "./types";

// A-7 (confirmed against Safepay "Webhooks" + "Webhooks delivery" docs): the event
// envelope carries `identifier` (mirrors the X-SFPY-EVENT-ID dedupe header),
// `webhook_event_type` (e.g. "payment.completed"), and a resource snapshot under
// `subject.payment`. The exact resource field names are the structural-only seam
// (C-3): parsing reads the documented envelope and the most likely resource keys,
// and the verifiable contract (dedupe key, event->status, amount == order total,
// currency PKR) is what the unit tests pin.

export type SafepayAdapterConfig = {
  environment: string;
  apiKey: string;
  webhookSecret: string;
};

const SAFEPAY_HOSTS: Record<string, string> = {
  sandbox: "https://sandbox.api.getsafepay.com",
  production: "https://api.getsafepay.com",
};

export function safepayBaseUrl(environment: string): string {
  return SAFEPAY_HOSTS[environment] ?? SAFEPAY_HOSTS.sandbox;
}

// payment.* event family -> internal status. Everything else (created,
// pending_authorization, authorized, settled, refund_partial, refund.*,
// settlement.*) is a no-op for our single-terminal-transition model.
const EVENT_STATUS: Record<string, PaymentStatus> = {
  "payment.completed": "PAID",
  "payment.failed": "FAILED",
  "payment.rejected": "FAILED",
  "payment.voided": "CANCELLED",
  "payment.refunded": "REFUNDED",
  "payment.reversed": "REFUNDED",
};

export function mapSafepayEventToStatus(event: VerifiedEvent): PaymentStatus | "IGNORE" {
  return EVENT_STATUS[event.rawType] ?? "IGNORE";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function parseSafepayEvent(rawBody: string): VerifiedEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error("PAYMENT_EVENT_UNPARSEABLE");
  }
  const body = asRecord(parsed);
  if (!body) throw new Error("PAYMENT_EVENT_UNPARSEABLE");
  const eventId = readString(body.identifier);
  const rawType = readString(body.webhook_event_type);
  if (!eventId) throw new Error("PAYMENT_EVENT_ID_MISSING");
  if (!rawType) throw new Error("PAYMENT_EVENT_TYPE_MISSING");
  const payment = asRecord(asRecord(body.subject)?.payment);
  return {
    eventId,
    rawType,
    providerReference: readString(payment?.tracker) ?? readString(payment?.token),
    merchantReference: readString(payment?.reference) ?? readString(payment?.order_id),
    amount: payment ? readNumber(payment.amount) : null,
    currency: payment ? readString(payment.currency) : null,
  };
}

export type SafepayCheckoutRequest = {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
};

// Pure request builder for the hosted-checkout handoff. The server amount is sent
// in provider (minor) units, currency fixed to PKR, and the merchant order
// reference is echoed so the gateway returns it on its webhook for fallback
// correlation. Return/cancel URLs are derived (by the caller) from APP_ORIGIN.
export function buildSafepayCheckoutRequest(input: CreateCheckoutInput, config: SafepayAdapterConfig): SafepayCheckoutRequest {
  return {
    url: `${safepayBaseUrl(config.environment)}/order/payments/v3/`,
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
    },
    body: JSON.stringify({
      environment: config.environment,
      amount: toProviderAmount(input.order.totalPkr),
      currency: input.order.currency,
      merchant_reference: input.order.reference,
      customer: { name: input.customer.name, email: input.customer.email, phone: input.customer.phone },
      redirect_url: input.returnUrl,
      cancel_url: input.cancelUrl,
    }),
  };
}

// Parse the tracker + hosted-checkout redirect URL out of the create-checkout
// response. Returns nulls when absent so the adapter can fail closed (502) rather
// than persist a payment row with a null correlation key.
export function parseSafepayCheckoutResponse(payload: unknown): { providerReference: string | null; url: string | null } {
  const body = asRecord(payload);
  const data = asRecord(body?.data) ?? body;
  return {
    providerReference: readString(data?.tracker) ?? readString(data?.token) ?? readString(data?.reference),
    url: readString(data?.checkout_url) ?? readString(data?.redirect_url) ?? readString(data?.url),
  };
}
