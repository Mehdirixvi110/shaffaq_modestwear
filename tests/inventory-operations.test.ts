import { describe, expect, it } from "vitest";
import { applyStockAdjustment } from "../src/lib/inventory";

describe("inventory adjustments", () => {
  it("rejects a stale expected version during a race", () => {
    expect(() => applyStockAdjustment(8, -2, 3, 4)).toThrow("VERSION_CONFLICT");
  });

  it("prevents a stale double adjustment", () => {
    const first = applyStockAdjustment(8, -2, 3, 3);
    expect(first).toEqual({ stockBefore: 8, stockAfter: 6, version: 4 });
    expect(() => applyStockAdjustment(first.stockAfter, -2, 3, first.version)).toThrow("VERSION_CONFLICT");
  });

  it("rejects an adjustment that would make stock negative", () => {
    expect(() => applyStockAdjustment(1, -2, 7, 7)).toThrow("STOCK_NEGATIVE");
  });
});
