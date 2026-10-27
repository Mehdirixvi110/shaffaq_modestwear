import { describe, expect, it } from "vitest";
import { calculateTotals } from "../src/lib/pricing";

describe("server pricing", () => {
  it("uses integer PKR and configured shipping", () => {
    expect(calculateTotals([{ unitPricePkr: 6450, quantity: 2 }], 250, 20000)).toEqual({ subtotalPkr: 12900, shippingPkr: 250, totalPkr: 13150 });
  });
  it("applies the persisted free-shipping threshold", () => {
    expect(calculateTotals([{ unitPricePkr: 6000, quantity: 2 }], 250, 10000).shippingPkr).toBe(0);
  });
  it("rejects unsafe values", () => {
    expect(() => calculateTotals([{ unitPricePkr: -1, quantity: 1 }], 0, null)).toThrow("INVALID_PRICE");
  });
});
