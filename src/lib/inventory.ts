export function applyStockAdjustment(stock: number, delta: number, expectedVersion: number, actualVersion: number) {
  if (!Number.isInteger(stock) || stock < 0) throw new Error("INVALID_STOCK");
  if (!Number.isInteger(delta) || delta === 0) throw new Error("INVALID_ADJUSTMENT");
  if (!Number.isInteger(expectedVersion) || expectedVersion !== actualVersion) throw new Error("VERSION_CONFLICT");
  const next = stock + delta;
  if (!Number.isInteger(next) || next < 0) throw new Error("STOCK_NEGATIVE");
  if (next > 1_000_000) throw new Error("STOCK_LIMIT");
  return { stockBefore: stock, stockAfter: next, version: actualVersion + 1 };
}
