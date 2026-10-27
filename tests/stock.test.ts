import { describe, expect, it } from "vitest";
import { remainingStock } from "../src/lib/commerce-rules";

describe("stock deduction", () => {
  it("allows the final unit without becoming negative", () => {
    expect(remainingStock(1, 1)).toBe(0);
  });
  it("rejects overselling", () => {
    expect(() => remainingStock(1, 2)).toThrow("STOCK_CHANGED");
  });
});
