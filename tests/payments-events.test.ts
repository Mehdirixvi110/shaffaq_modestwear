import { describe, expect, it } from "vitest";
import { fromProviderAmount, reconcilePaymentAmount, toProviderAmount } from "../src/lib/payments/amount";
import { mapSafepayEventToStatus, parseSafepayEvent } from "../src/lib/payments/safepay-events";
import type { VerifiedEvent } from "../src/lib/payments/types";

function event(rawType: string): VerifiedEvent {
  return { eventId: "evt", providerReference: "trk", merchantReference: "SHQ-1", rawType, amount: null, currency: null };
}

describe("Safepay event -> status mapping (AC3b)", () => {
  it("maps completed -> PAID", () => expect(mapSafepayEventToStatus(event("payment.completed"))).toBe("PAID"));
  it("maps failed and rejected -> FAILED", () => {
    expect(mapSafepayEventToStatus(event("payment.failed"))).toBe("FAILED");
    expect(mapSafepayEventToStatus(event("payment.rejected"))).toBe("FAILED");
  });
  it("maps voided -> CANCELLED", () => expect(mapSafepayEventToStatus(event("payment.voided"))).toBe("CANCELLED"));
  it("maps refunded and reversed -> REFUNDED", () => {
    expect(mapSafepayEventToStatus(event("payment.refunded"))).toBe("REFUNDED");
    expect(mapSafepayEventToStatus(event("payment.reversed"))).toBe("REFUNDED");
  });
  it("maps unknown/unhandled -> IGNORE", () => {
    expect(mapSafepayEventToStatus(event("payment.created"))).toBe("IGNORE");
    expect(mapSafepayEventToStatus(event("payment.authorized"))).toBe("IGNORE");
    expect(mapSafepayEventToStatus(event("settlement.completed"))).toBe("IGNORE");
    expect(mapSafepayEventToStatus(event("totally.unknown"))).toBe("IGNORE");
  });
});

describe("amount normalisation — both representations (AC3a)", () => {
  it("minor-unit (x100) round-trips PKR", () => {
    expect(toProviderAmount(2500)).toBe(250000);
    expect(fromProviderAmount(250000)).toBe(2500);
  });
  it("major-unit (identity) branch round-trips PKR", () => {
    expect(toProviderAmount(2500, 1)).toBe(2500);
    expect(fromProviderAmount(2500, 1)).toBe(2500);
  });
  it("rejects a provider amount that is not an exact integer number of rupees", () => {
    expect(() => fromProviderAmount(250050)).toThrow("PAYMENT_AMOUNT_NOT_INTEGER"); // 2500.5 PKR
  });
  it("rejects a negative or non-integer input to toProviderAmount", () => {
    expect(() => toProviderAmount(-1)).toThrow("PAYMENT_AMOUNT_NEGATIVE");
    expect(() => toProviderAmount(10.5)).toThrow("PAYMENT_AMOUNT_NOT_INTEGER");
  });
});

describe("reconcilePaymentAmount (NFR-2, AC18)", () => {
  it("accepts an exact minor-unit match in PKR", () => {
    expect(() => reconcilePaymentAmount(2500, 250000, "PKR")).not.toThrow();
  });
  it("rejects a currency other than PKR", () => {
    expect(() => reconcilePaymentAmount(2500, 250000, "USD")).toThrow("PAYMENT_CURRENCY_MISMATCH");
  });
  it("rejects an amount that does not equal the order total", () => {
    expect(() => reconcilePaymentAmount(2500, 240000, "PKR")).toThrow("PAYMENT_AMOUNT_MISMATCH");
  });
  it("rejects a missing amount", () => {
    expect(() => reconcilePaymentAmount(2500, null, "PKR")).toThrow("PAYMENT_AMOUNT_MISSING");
  });
});

describe("parseSafepayEvent", () => {
  it("extracts ids, type, references, amount, and currency from the envelope", () => {
    const body = JSON.stringify({
      identifier: "evt_123",
      webhook_event_type: "payment.completed",
      subject: { payment: { tracker: "track_9", reference: "SHQ-202611-ABC", amount: 250000, currency: "PKR" } },
    });
    expect(parseSafepayEvent(body)).toMatchObject({
      eventId: "evt_123",
      rawType: "payment.completed",
      providerReference: "track_9",
      merchantReference: "SHQ-202611-ABC",
      amount: 250000,
      currency: "PKR",
    });
  });
  it("throws on a body missing the event id", () => {
    expect(() => parseSafepayEvent(JSON.stringify({ webhook_event_type: "payment.completed" }))).toThrow("PAYMENT_EVENT_ID_MISSING");
  });
  it("throws on unparseable JSON", () => {
    expect(() => parseSafepayEvent("not json")).toThrow("PAYMENT_EVENT_UNPARSEABLE");
  });
});
