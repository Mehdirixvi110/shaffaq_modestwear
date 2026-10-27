import { describe, expect, it } from "vitest";
import { resolveIdempotency } from "../src/lib/commerce-rules";
import { canonicalHash } from "../src/lib/security";

describe("checkout idempotency", () => {
  it("replays an identical canonical request", () => {
    const hash = canonicalHash({ source: "COD", quantity: 1 });
    expect(resolveIdempotency(hash, hash)).toBe("REPLAY");
  });
  it("rejects reuse when coupon details change", () => {
    expect(() => resolveIdempotency(canonicalHash({ quantity: 1, couponCode: "SAVE10" }), canonicalHash({ quantity: 1, couponCode: "SAVE20" }))).toThrow("IDEMPOTENCY_CONFLICT");
  });
  it("rejects reuse for a changed payload", () => {
    expect(() => resolveIdempotency(canonicalHash({ quantity: 1 }), canonicalHash({ quantity: 2 }))).toThrow("IDEMPOTENCY_CONFLICT");
  });
});
