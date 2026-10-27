export function remainingStock(currentStock: number, requested: number) {
  if (!Number.isInteger(currentStock) || currentStock < 0) throw new Error("INVALID_STOCK");
  if (!Number.isInteger(requested) || requested < 1) throw new Error("INVALID_QUANTITY");
  if (requested > currentStock) throw new Error("STOCK_CHANGED");
  return currentStock - requested;
}

export function resolveIdempotency(existingHash: string | null, incomingHash: string) {
  if (existingHash === null) return "NEW" as const;
  if (existingHash === incomingHash) return "REPLAY" as const;
  throw new Error("IDEMPOTENCY_CONFLICT");
}
