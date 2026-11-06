// Provider-independent payment types shared by the pure core (src/lib/payments/*)
// and the env-wired server adapters (src/server/payments/*). No runtime behaviour
// lives here — only the contract that keeps adding a future gateway a thin change.

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
export type ProviderName = "COD" | "SAFEPAY";

export type CreateCheckoutInput = {
  order: { id: string; reference: string; totalPkr: number; currency: "PKR" };
  customer: { name: string; email: string; phone: string };
  returnUrl: string;
  cancelUrl: string;
};

export type CreateCheckoutResult =
  | { kind: "REDIRECT"; url: string; providerReference: string }
  | { kind: "NONE" };

export type VerifiedEvent = {
  eventId: string; // provider's unique event/delivery id — the dedupe key
  providerReference: string | null; // tracker/charge id, primary correlation to payments.provider_reference
  merchantReference: string | null; // echoed orders.reference, fallback correlation
  rawType: string; // provider event type string
  amount: number | null; // provider-reported amount, in provider units
  currency: string | null;
};

// The pure webhook decision outcome (see transition.ts).
export type EventOutcome = "APPLY" | "DEDUPE" | "IGNORE" | "REJECT";

export interface PaymentProvider {
  readonly name: ProviderName;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  // Verifies the signature over the EXACT raw body bytes; throws on a missing /
  // malformed / invalid signature. Never re-serialises the body.
  verifyWebhook(headers: Headers, rawBody: string): VerifiedEvent;
  // "IGNORE" => an event type we do not act on.
  mapEventToStatus(event: VerifiedEvent): PaymentStatus | "IGNORE";
}
