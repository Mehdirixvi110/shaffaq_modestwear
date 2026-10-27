import type Database from "better-sqlite3";
import { calculateCouponDiscount, normalizeCouponCode, validateCouponAvailability, type CouponLine, type CouponRule, type CouponType } from "@/lib/coupons";
import { ApiError } from "./http";

type CouponRow = {
  id: number;
  code: string;
  type: CouponType;
  value: number;
  minimumSubtotalPkr: number;
  startsAt: number | null;
  endsAt: number | null;
  usageLimit: number | null;
  perContactLimit: number | null;
};

function publicCouponError(error: unknown): never {
  if (!(error instanceof Error)) throw error;
  const messages: Record<string, string> = {
    COUPON_NOT_STARTED: "This coupon is not active yet.",
    COUPON_EXPIRED: "This coupon has expired.",
    COUPON_EXHAUSTED: "This coupon has reached its usage limit.",
    COUPON_CONTACT_LIMIT: "This coupon has already reached its limit for these contact details.",
    COUPON_MINIMUM: "The cart subtotal does not meet this coupon's minimum.",
    COUPON_INAPPLICABLE: "This coupon does not apply to the products in the cart.",
    INVALID_COUPON: "This coupon is misconfigured and cannot be applied.",
  };
  if (messages[error.message]) throw new ApiError(422, error.message, messages[error.message]);
  throw error;
}

export function getCouponEvaluation(
  connection: Database.Database,
  rawCode: string | null | undefined,
  lines: CouponLine[],
  subtotalPkr: number,
  contactHash: string | null,
  now = Date.now(),
) {
  if (!rawCode?.trim()) return null;
  const code = normalizeCouponCode(rawCode);
  const coupon = connection.prepare(`SELECT id, code, type, value, minimum_subtotal_pkr AS minimumSubtotalPkr,
    starts_at AS startsAt, ends_at AS endsAt, usage_limit AS usageLimit, per_contact_limit AS perContactLimit
    FROM coupons WHERE code = ? AND enabled = 1 AND archived = 0`).get(code) as CouponRow | undefined;
  if (!coupon) throw new ApiError(422, "COUPON_INVALID", "This coupon is invalid or disabled.");
  const productIds = (connection.prepare("SELECT product_id AS id FROM coupon_products WHERE coupon_id = ?").all(coupon.id) as Array<{ id: number }>).map((row) => row.id);
  const collectionIds = (connection.prepare("SELECT collection_id AS id FROM coupon_collections WHERE coupon_id = ?").all(coupon.id) as Array<{ id: number }>).map((row) => row.id);
  const rule: CouponRule = { ...coupon, productIds, collectionIds };
  const usageCount = (connection.prepare("SELECT COUNT(*) AS count FROM coupon_redemptions WHERE coupon_id = ?").get(coupon.id) as { count: number }).count;
  const contactUsageCount = contactHash ? (connection.prepare("SELECT COUNT(*) AS count FROM coupon_redemptions WHERE coupon_id = ? AND contact_hash = ?").get(coupon.id, contactHash) as { count: number }).count : 0;
  try {
    validateCouponAvailability(rule, usageCount, contactUsageCount, now);
    const discountPkr = calculateCouponDiscount(rule, lines, subtotalPkr);
    return { id: coupon.id, code, type: coupon.type, value: coupon.value, discountPkr, freeShipping: coupon.type === "FREE_SHIPPING" };
  } catch (error) { publicCouponError(error); }
}
