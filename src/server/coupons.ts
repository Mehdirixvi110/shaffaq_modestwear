import type { DatabaseConnection } from "@/db";
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

export async function getCouponEvaluation(
  connection: DatabaseConnection,
  rawCode: string | null | undefined,
  lines: CouponLine[],
  subtotalPkr: number,
  contactHash: string | null,
  now = Date.now(),
  lock = false,
) {
  if (!rawCode?.trim()) return null;
  const code = normalizeCouponCode(rawCode);
  const lockClause = lock && connection.provider === "postgres" ? " FOR UPDATE" : "";
  const coupon = await connection.prepare(`SELECT id, code, type, value, minimum_subtotal_pkr AS minimumSubtotalPkr,
    starts_at AS startsAt, ends_at AS endsAt, usage_limit AS usageLimit, per_contact_limit AS perContactLimit
    FROM coupons WHERE code = ? AND enabled = 1 AND archived = 0${lockClause}`).get<CouponRow>(code);
  if (!coupon) throw new ApiError(422, "COUPON_INVALID", "This coupon is invalid or disabled.");
  const [productRows, collectionRows, usage, contactUsage] = await Promise.all([
    connection.prepare("SELECT product_id AS id FROM coupon_products WHERE coupon_id = ?").all<{ id: number }>(coupon.id),
    connection.prepare("SELECT collection_id AS id FROM coupon_collections WHERE coupon_id = ?").all<{ id: number }>(coupon.id),
    connection.prepare("SELECT COUNT(*) AS count FROM coupon_redemptions WHERE coupon_id = ?").get<{ count: number }>(coupon.id),
    contactHash ? connection.prepare("SELECT COUNT(*) AS count FROM coupon_redemptions WHERE coupon_id = ? AND contact_hash = ?").get<{ count: number }>(coupon.id, contactHash) : Promise.resolve({ count: 0 }),
  ]);
  const rule: CouponRule = { ...coupon, productIds: productRows.map((row) => row.id), collectionIds: collectionRows.map((row) => row.id) };
  try {
    validateCouponAvailability(rule, usage?.count ?? 0, contactUsage?.count ?? 0, now);
    const discountPkr = calculateCouponDiscount(rule, lines, subtotalPkr);
    return { id: coupon.id, code, type: coupon.type, value: coupon.value, discountPkr, freeShipping: coupon.type === "FREE_SHIPPING" };
  } catch (error) { publicCouponError(error); }
}
