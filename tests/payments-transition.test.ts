import { describe, expect, it } from "vitest";
import { resolvePaymentTransition } from "../src/lib/payments/transition";

describe("resolvePaymentTransition — total decision (AC3d)", () => {
  it("APPLY for a new PAID/FAILED/CANCELLED capture on a PENDING row (rule 3)", () => {
    expect(resolvePaymentTransition("PENDING", "PAID", "e1", null)).toBe("APPLY");
    expect(resolvePaymentTransition("PENDING", "FAILED", "e1", null)).toBe("APPLY");
    expect(resolvePaymentTransition("PENDING", "CANCELLED", "e1", null)).toBe("APPLY");
  });

  it("DEDUPE when the stored event id equals the incoming id (rule 1)", () => {
    expect(resolvePaymentTransition("PAID", "PAID", "e1", "e1")).toBe("DEDUPE");
    // rule 1 wins even over the PENDING-with-stored-id REJECT (rule 2)
    expect(resolvePaymentTransition("PENDING", "PAID", "e1", "e1")).toBe("DEDUPE");
  });

  it("IGNORE for a REFUNDED target on a still-PENDING row (rule 4)", () => {
    expect(resolvePaymentTransition("PENDING", "REFUNDED", "e2", null)).toBe("IGNORE");
  });

  it("IGNORE for any event on an already-terminal row (rule 5)", () => {
    expect(resolvePaymentTransition("PAID", "FAILED", "e2", "e1")).toBe("IGNORE");
    expect(resolvePaymentTransition("CANCELLED", "PAID", "e2", "e1")).toBe("IGNORE");
    expect(resolvePaymentTransition("REFUNDED", "PAID", "e2", null)).toBe("IGNORE");
  });

  it("REJECT a PENDING row carrying a non-null stored event id (rule 2)", () => {
    expect(resolvePaymentTransition("PENDING", "PAID", "e2", "e1")).toBe("REJECT");
  });

  it("REJECT the catch-all (rule 6): a PENDING target on a PENDING row", () => {
    expect(resolvePaymentTransition("PENDING", "PENDING", "e1", null)).toBe("REJECT");
  });
});
