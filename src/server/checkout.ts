import { randomBytes, randomUUID } from "node:crypto";
import { database, type DatabaseConnection } from "@/db";
import { normalizeCouponCode } from "@/lib/coupons";
import { calculateCommerceTotals, calculateTotals } from "@/lib/pricing";
import { canonicalHash, hashToken, orderAccessToken } from "@/lib/security";
import type { CheckoutInput } from "@/lib/validation";
import { adjustStock } from "./inventory";
import { getCouponEvaluation } from "./coupons";
import { ApiError } from "./http";
import { findCart } from "./cart";
import { getSettings } from "./store";

export type CheckoutSource = "STOREFRONT_COD" | "WHATSAPP_INQUIRY";
export type CheckoutResult = {
  reference: string;
  redirectTo: string;
  source: CheckoutSource;
  orderStatus: "PENDING_CONFIRMATION" | "INQUIRY";
  totalPkr: number;
  whatsappUrl: string | null;
  notice: string;
};

type CheckoutLine = {
  cartItemId: number;
  productId: number;
  collectionId: number | null;
  variantId: number;
  quantity: number;
  productTitle: string;
  productSlug: string;
  variantTitle: string;
  sku: string;
  pricePkr: number;
  stock: number;
  version: number;
  options: string;
};

function createReference() {
  const month = new Date().toISOString().slice(0, 7).replace("-", "");
  const code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
  return `SHQ-${month}-${code}`;
}

function normalizePhone(phone: string) {
  const digits = phone.replaceAll(/\D/g, "");
  if (digits.startsWith("92")) return `+${digits}`;
  if (digits.startsWith("0")) return `+92${digits.slice(1)}`;
  return `+92${digits}`;
}

async function getReplay(connection: DatabaseConnection, subjectHash: string, idempotencyKey: string, requestHash: string) {
  const existing = await connection.prepare("SELECT order_id AS orderId, request_hash AS requestHash, response_json AS responseJson FROM checkout_requests WHERE subject_hash = ? AND idempotency_key = ?")
    .get<{ orderId: string; requestHash: string; responseJson: string }>(subjectHash, idempotencyKey);
  if (!existing) return null;
  if (existing.requestHash !== requestHash) throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "This submission key was already used for different checkout details.");
  return { result: JSON.parse(existing.responseJson) as CheckoutResult, accessToken: orderAccessToken(existing.orderId) };
}

export async function checkout(input: CheckoutInput, source: CheckoutSource, rawCartToken: string | undefined, rawSubjectToken: string | undefined) {
  if (!rawSubjectToken) throw new ApiError(400, "CHECKOUT_SUBJECT_REQUIRED", "Refresh checkout before submitting your order.");
  const subjectHash = hashToken(rawSubjectToken);
  const requestHash = canonicalHash({ source, input });
  const replay = await getReplay(database, subjectHash, input.idempotencyKey, requestHash);
  if (replay) return replay;
  const cart = await findCart(rawCartToken);
  if (!cart) throw new ApiError(409, "CART_EMPTY", "Your cart is empty.");
  const submittedCoupon = input.couponCode ? normalizeCouponCode(input.couponCode) : null;
  const persistedCoupon = cart.couponCode ? normalizeCouponCode(cart.couponCode) : null;
  if (submittedCoupon !== persistedCoupon) throw new ApiError(409, "COUPON_CHANGED", "The cart coupon changed. Reload checkout and try again.");

  return database.transaction(async () => {
    if (database.provider === "postgres") {
      await database.prepare("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))").get(`${subjectHash}:${input.idempotencyKey}`);
    }
    const concurrentReplay = await getReplay(database, subjectHash, input.idempotencyKey, requestHash);
    if (concurrentReplay) return concurrentReplay;
    const settings = await getSettings();
    if (settings.maintenanceMode) throw new ApiError(503, "MAINTENANCE", settings.maintenanceMessage ?? "Checkout is temporarily unavailable for maintenance.");
    if (source === "STOREFRONT_COD" && !settings.codEnabled) throw new ApiError(422, "COD_DISABLED", "Cash on delivery is currently disabled.");
    const whatsappDigits = settings.whatsappNumber?.replaceAll(/\D/g, "") ?? "";
    if (source === "WHATSAPP_INQUIRY" && !/^\d{10,15}$/.test(whatsappDigits)) {
      throw new ApiError(503, "WHATSAPP_NOT_CONFIGURED", "WhatsApp inquiry checkout is not configured.");
    }
    const currentCart = await database.prepare(`SELECT coupon_code AS couponCode FROM carts WHERE id = ?${database.provider === "postgres" ? " FOR UPDATE" : ""}`).get<{ couponCode: string | null }>(cart.id);
    const currentCoupon = currentCart?.couponCode ? normalizeCouponCode(currentCart.couponCode) : null;
    if (!currentCart || currentCoupon !== persistedCoupon) throw new ApiError(409, "COUPON_CHANGED", "The cart coupon changed. Reload checkout and try again.");
    const lines = await database.prepare(`SELECT ci.id AS cartItemId, ci.quantity, p.id AS productId, p.collection_id AS collectionId,
      p.title AS productTitle, p.slug AS productSlug, v.id AS variantId, v.title AS variantTitle, v.sku,
      v.price_pkr AS pricePkr, v.stock, v.version,
      COALESCE((SELECT GROUP_CONCAT(po.name || ': ' || ov.value, ', ') FROM variant_option_values vov
        JOIN option_values ov ON ov.id = vov.option_value_id JOIN product_options po ON po.id = ov.option_id
        WHERE vov.variant_id = v.id), v.title) AS options
      FROM cart_items ci JOIN variants v ON v.id = ci.variant_id JOIN products p ON p.id = v.product_id
      WHERE ci.cart_id = ? AND p.status = 'PUBLISHED' AND v.active = 1 ORDER BY ci.id${database.provider === "postgres" ? " FOR UPDATE OF ci, v" : ""}`).all<CheckoutLine>(cart.id);
    if (lines.length === 0) throw new ApiError(409, "CART_EMPTY", "Your cart is empty.");
    for (const line of lines) {
      if (line.quantity > line.stock) throw new ApiError(409, "STOCK_CHANGED", `${line.productTitle} no longer has the requested quantity.`);
    }
    const base = calculateTotals(lines.map((line) => ({ unitPricePkr: line.pricePkr, quantity: line.quantity })), settings.shippingPkr, settings.freeShippingThresholdPkr);
    const normalizedPhone = normalizePhone(input.phone);
    const normalizedEmail = input.email.toLowerCase();
    const contactHash = canonicalHash({ email: normalizedEmail });
    const coupon = await getCouponEvaluation(database, persistedCoupon, lines.map((line) => ({ unitPricePkr: line.pricePkr, quantity: line.quantity, productId: line.productId, collectionId: line.collectionId })), base.subtotalPkr, contactHash, Date.now(), true);
    const totals = calculateCommerceTotals(
      lines.map((line) => ({ unitPricePkr: line.pricePkr, quantity: line.quantity })),
      settings.shippingPkr,
      settings.freeShippingThresholdPkr,
      coupon?.discountPkr ?? 0,
      coupon?.freeShipping ?? false,
      Boolean(settings.taxEnabled),
      settings.taxRateBps,
    );
    const orderId = randomUUID();
    let reference = createReference();
    while (await database.prepare("SELECT 1 FROM orders WHERE reference = ?").get(reference)) reference = createReference();
    const accessToken = orderAccessToken(orderId);
    const orderStatus = source === "STOREFRONT_COD" ? "PENDING_CONFIRMATION" : "INQUIRY";
    const allocated = source === "STOREFRONT_COD";
    await database.prepare(`INSERT INTO orders (
      id, reference, source, order_status, fulfillment_status, payment_status,
      customer_name, email, phone, address_line1, address_line2, city, region, postal_code, country, notes,
      subtotal_pkr, discount_pkr, tax_pkr, shipping_pkr, total_pkr, coupon_code, coupon_type, coupon_value,
      stock_allocated, stock_released, order_access_hash
    ) VALUES (?, ?, ?, ?, 'UNFULFILLED', 'UNPAID', ?, ?, ?, ?, ?, ?, ?, ?, 'PK', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`)
      .run(orderId, reference, source, orderStatus, input.customerName, normalizedEmail, normalizedPhone,
        input.addressLine1, input.addressLine2 || null, input.city, input.region || null, input.postalCode || null,
        input.notes || null, totals.subtotalPkr, totals.discountPkr, totals.taxPkr, totals.shippingPkr, totals.totalPkr,
        coupon?.code ?? null, coupon?.type ?? null, coupon?.value ?? null, allocated ? 1 : 0, hashToken(accessToken));

    const insertItem = database.prepare(`INSERT INTO order_items
      (order_id, product_id, variant_id, product_title, product_slug, variant_title, sku, options_json, unit_price_pkr, quantity, line_total_pkr)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const line of lines) {
      if (allocated) {
        await adjustStock(database, {
          variantId: line.variantId,
          delta: -line.quantity,
          expectedVersion: line.version,
          reason: `Allocated to checkout ${reference}.`,
          source: "CHECKOUT",
          sourceKey: `${orderId}:${line.variantId}:CHECKOUT`,
          orderId,
        });
      }
      await insertItem.run(orderId, line.productId, line.variantId, line.productTitle, line.productSlug, line.variantTitle,
        line.sku, JSON.stringify({ summary: line.options }), line.pricePkr, line.quantity, line.pricePkr * line.quantity);
    }
    if (coupon) {
      await database.prepare("INSERT INTO coupon_redemptions (coupon_id, order_id, contact_hash, discount_pkr) VALUES (?, ?, ?, ?)")
        .run(coupon.id, orderId, contactHash, totals.discountPkr + Math.max(0, base.shippingPkr - totals.shippingPkr));
    }
    await database.prepare("INSERT INTO order_history (order_id, event, note) VALUES (?, ?, ?)")
      .run(orderId, orderStatus, source === "WHATSAPP_INQUIRY" ? "Inquiry created; stock is not reserved." : "Cash-on-delivery order submitted.");

    const notice = source === "WHATSAPP_INQUIRY"
      ? "WhatsApp inquiry only — this does not confirm your order or payment. SHAFFAQ will confirm availability and next steps."
      : "Your cash-on-delivery order is pending confirmation. Payment has not been collected.";
    let whatsappUrl: string | null = null;
    if (source === "WHATSAPP_INQUIRY") {
      const itemText = lines.map((line) => `${line.productTitle} (${line.sku}; ${line.options}) × ${line.quantity}`).join("\n");
      const couponText = coupon ? `\nCoupon: ${coupon.code}` : "";
      const message = `SHAFFAQ inquiry ${reference}\n${itemText}${couponText}\nTotal: PKR ${totals.totalPkr.toLocaleString("en-PK")}\n\n${notice}`;
      whatsappUrl = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(message)}`;
      if ([...message].length > 4000 || whatsappUrl.length > 8192) throw new ApiError(422, "WHATSAPP_MESSAGE_TOO_LONG", "This inquiry is too large for a WhatsApp link.");
    }
    const result: CheckoutResult = {
      reference,
      redirectTo: `/orders/${reference}?confirmation=1`,
      source,
      orderStatus,
      totalPkr: totals.totalPkr,
      whatsappUrl,
      notice,
    };
    await database.prepare("INSERT INTO checkout_requests (subject_hash, idempotency_key, request_hash, order_id, response_json) VALUES (?, ?, ?, ?, ?)")
      .run(subjectHash, input.idempotencyKey, requestHash, orderId, JSON.stringify(result));
    await database.prepare("DELETE FROM carts WHERE id = ?").run(cart.id);
    return { result, accessToken };
  }).immediate();
}

export async function getOrderForCustomer(reference: string, rawAccessToken: string | undefined) {
  if (!rawAccessToken) return null;
  const order = await database.prepare(`SELECT id, reference, source, order_status AS orderStatus, fulfillment_status AS fulfillmentStatus,
    payment_status AS paymentStatus, customer_name AS customerName, email, phone, address_line1 AS addressLine1,
    address_line2 AS addressLine2, city, region, postal_code AS postalCode, country, notes,
    subtotal_pkr AS subtotalPkr, discount_pkr AS discountPkr, tax_pkr AS taxPkr, shipping_pkr AS shippingPkr,
    total_pkr AS totalPkr, coupon_code AS couponCode, courier_name AS courierName, tracking_number AS trackingNumber,
    cancellation_reason AS cancellationReason, created_at AS createdAt, order_access_hash AS orderAccessHash
    FROM orders WHERE reference = ?`).get<Record<string, unknown> & { id: string; orderAccessHash: string }>(reference);
  if (!order || order.orderAccessHash !== hashToken(rawAccessToken)) return null;
  const [items, history, requests] = await Promise.all([
    database.prepare(`SELECT oi.id, oi.product_id AS productId, oi.product_title AS productTitle, oi.product_slug AS productSlug,
      oi.variant_title AS variantTitle, oi.sku, oi.options_json AS optionsJson, oi.unit_price_pkr AS unitPricePkr,
      oi.quantity, oi.line_total_pkr AS lineTotalPkr, r.id AS reviewId, r.status AS reviewStatus
      FROM order_items oi LEFT JOIN reviews r ON r.order_item_id = oi.id WHERE oi.order_id = ? ORDER BY oi.id`).all(order.id),
    database.prepare("SELECT event, note, created_at AS createdAt FROM order_history WHERE order_id = ? ORDER BY id").all(order.id),
    database.prepare("SELECT id, kind, status, reason, resolution_note AS resolutionNote, created_at AS createdAt FROM return_requests WHERE order_id = ? ORDER BY created_at DESC").all(order.id),
  ]);
  const { orderAccessHash: _, ...safeOrder } = order;
  void _;
  return { ...safeOrder, items, history, requests };
}
