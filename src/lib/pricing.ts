export type PricedLine = { unitPricePkr: number; quantity: number };

export type CommerceTotals = {
  subtotalPkr: number;
  discountPkr: number;
  taxPkr: number;
  shippingPkr: number;
  totalPkr: number;
};

export function calculateTotals(lines: PricedLine[], shippingPkr: number, freeShippingThresholdPkr: number | null) {
  if (!Number.isSafeInteger(shippingPkr) || shippingPkr < 0) throw new Error("INVALID_SHIPPING");
  const subtotalPkr = lines.reduce((total, line) => {
    if (!Number.isSafeInteger(line.unitPricePkr) || line.unitPricePkr < 0) throw new Error("INVALID_PRICE");
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) throw new Error("INVALID_QUANTITY");
    const next = total + line.unitPricePkr * line.quantity;
    if (!Number.isSafeInteger(next)) throw new Error("MONEY_RANGE_EXCEEDED");
    return next;
  }, 0);
  const shippingChargedPkr = freeShippingThresholdPkr !== null && subtotalPkr >= freeShippingThresholdPkr ? 0 : shippingPkr;
  return { subtotalPkr, shippingPkr: shippingChargedPkr, totalPkr: subtotalPkr + shippingChargedPkr };
}

export function calculateCommerceTotals(
  lines: PricedLine[],
  shippingPkr: number,
  freeShippingThresholdPkr: number | null,
  discountPkr: number,
  freeShipping: boolean,
  taxEnabled: boolean,
  taxRateBps: number,
): CommerceTotals {
  const base = calculateTotals(lines, shippingPkr, freeShippingThresholdPkr);
  if (!Number.isSafeInteger(discountPkr) || discountPkr < 0 || discountPkr > base.subtotalPkr) throw new Error("INVALID_DISCOUNT");
  if (!Number.isInteger(taxRateBps) || taxRateBps < 0 || taxRateBps > 10_000) throw new Error("INVALID_TAX");
  const taxablePkr = base.subtotalPkr - discountPkr;
  const taxPkr = taxEnabled ? Math.floor(taxablePkr * taxRateBps / 10_000) : 0;
  const shippingChargedPkr = freeShipping ? 0 : base.shippingPkr;
  const totalPkr = taxablePkr + taxPkr + shippingChargedPkr;
  if (!Number.isSafeInteger(totalPkr)) throw new Error("MONEY_RANGE_EXCEEDED");
  return { subtotalPkr: base.subtotalPkr, discountPkr, taxPkr, shippingPkr: shippingChargedPkr, totalPkr };
}
