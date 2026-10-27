export type CouponType = "PERCENT" | "FIXED" | "FREE_SHIPPING";

export type CouponRule = {
  code: string;
  type: CouponType;
  value: number;
  minimumSubtotalPkr: number;
  startsAt: number | null;
  endsAt: number | null;
  usageLimit: number | null;
  perContactLimit: number | null;
  productIds: number[];
  collectionIds: number[];
};

export type CouponLine = {
  unitPricePkr: number;
  quantity: number;
  productId: number;
  collectionId: number | null;
};

export function normalizeCouponCode(value: string) {
  return value.trim().toUpperCase();
}

export function validateCouponAvailability(rule: CouponRule, usageCount: number, contactUsageCount: number, now = Date.now()) {
  if (rule.startsAt !== null && now < rule.startsAt) throw new Error("COUPON_NOT_STARTED");
  if (rule.endsAt !== null && now > rule.endsAt) throw new Error("COUPON_EXPIRED");
  if (rule.usageLimit !== null && usageCount >= rule.usageLimit) throw new Error("COUPON_EXHAUSTED");
  if (rule.perContactLimit !== null && contactUsageCount >= rule.perContactLimit) throw new Error("COUPON_CONTACT_LIMIT");
}

export function calculateCouponDiscount(rule: CouponRule, lines: CouponLine[], subtotalPkr: number) {
  if (!Number.isSafeInteger(subtotalPkr) || subtotalPkr < 0) throw new Error("INVALID_PRICE");
  if (subtotalPkr < rule.minimumSubtotalPkr) throw new Error("COUPON_MINIMUM");
  const scoped = rule.productIds.length > 0 || rule.collectionIds.length > 0;
  const eligibleSubtotalPkr = lines.reduce((total, line) => {
    const matches = !scoped || rule.productIds.includes(line.productId) || (line.collectionId !== null && rule.collectionIds.includes(line.collectionId));
    return matches ? total + line.unitPricePkr * line.quantity : total;
  }, 0);
  if (eligibleSubtotalPkr <= 0) throw new Error("COUPON_INAPPLICABLE");
  if (rule.type === "FREE_SHIPPING") return 0;
  if (rule.type === "PERCENT") {
    if (!Number.isInteger(rule.value) || rule.value < 1 || rule.value > 100) throw new Error("INVALID_COUPON");
    return Math.floor(eligibleSubtotalPkr * rule.value / 100);
  }
  if (!Number.isSafeInteger(rule.value) || rule.value < 1) throw new Error("INVALID_COUPON");
  return Math.min(rule.value, eligibleSubtotalPkr);
}
