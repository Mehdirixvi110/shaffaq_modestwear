import { describe, expect, it } from "vitest";
import { calculateCouponDiscount, normalizeCouponCode, validateCouponAvailability, type CouponRule } from "../src/lib/coupons";
import { calculateCommerceTotals } from "../src/lib/pricing";

const base: CouponRule = { code: "SAVE10", type: "PERCENT", value: 10, minimumSubtotalPkr: 0, startsAt: null, endsAt: null, usageLimit: null, perContactLimit: null, productIds: [], collectionIds: [] };
const lines = [{ productId: 1, collectionId: 2, unitPricePkr: 6_455, quantity: 1 }];

describe("coupon pricing and limits", () => {
  it("normalizes codes and rounds percentage discounts down in integer PKR", () => {
    expect(normalizeCouponCode(" save10 ")).toBe("SAVE10");
    expect(calculateCouponDiscount(base, lines, 6_455)).toBe(645);
    expect(calculateCommerceTotals(lines, 250, null, 645, false, false, 0)).toEqual({ subtotalPkr: 6_455, discountPkr: 645, taxPkr: 0, shippingPkr: 250, totalPkr: 6_060 });
  });

  it("caps fixed discounts at the scoped eligible subtotal", () => {
    expect(calculateCouponDiscount({ ...base, type: "FIXED", value: 10_000, productIds: [1] }, lines, 6_455)).toBe(6_455);
  });

  it("rejects inapplicable collection scope", () => {
    expect(() => calculateCouponDiscount({ ...base, collectionIds: [99] }, lines, 6_455)).toThrow("COUPON_INAPPLICABLE");
  });

  it("makes shipping zero without changing merchandise discount", () => {
    expect(calculateCommerceTotals(lines, 250, null, 0, true, false, 0)).toEqual({ subtotalPkr: 6_455, discountPkr: 0, taxPkr: 0, shippingPkr: 0, totalPkr: 6_455 });
  });

  it("enforces global, contact, and date limits", () => {
    expect(() => validateCouponAvailability({ ...base, usageLimit: 2 }, 2, 0)).toThrow("COUPON_EXHAUSTED");
    expect(() => validateCouponAvailability({ ...base, perContactLimit: 1 }, 0, 1)).toThrow("COUPON_CONTACT_LIMIT");
    expect(() => validateCouponAvailability({ ...base, endsAt: 999 }, 0, 0, 1_000)).toThrow("COUPON_EXPIRED");
  });
});
