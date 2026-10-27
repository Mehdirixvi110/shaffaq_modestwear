import { randomUUID } from "node:crypto";
import { sqlite } from "@/db";
import { calculateCommerceTotals, calculateTotals } from "@/lib/pricing";
import { normalizeCouponCode } from "@/lib/coupons";
import { hashToken, randomToken } from "@/lib/security";
import { ApiError } from "./http";
import { getCouponEvaluation } from "./coupons";
import { getSettings } from "./store";

export type CartLine = {
  id: number;
  productId: number;
  collectionId: number | null;
  variantId: number;
  quantity: number;
  title: string;
  slug: string;
  variantTitle: string;
  sku: string;
  pricePkr: number;
  stock: number;
  imagePath: string | null;
  imageAlt: string | null;
  options: string;
};

export type CartState = {
  id: string | null;
  lines: CartLine[];
  subtotalPkr: number;
  discountPkr: number;
  taxPkr: number;
  shippingPkr: number;
  totalPkr: number;
  couponCode: string | null;
  couponError: string | null;
  couponSavingsPkr: number;
};

export function findCart(rawToken: string | undefined) {
  if (!rawToken) return null;
  return sqlite.prepare("SELECT id, coupon_code AS couponCode FROM carts WHERE token_hash = ?").get(hashToken(rawToken)) as { id: string; couponCode: string | null } | undefined;
}

export function readCart(rawToken: string | undefined): CartState {
  const cart = findCart(rawToken);
  if (!cart) return { id: null, lines: [], subtotalPkr: 0, discountPkr: 0, taxPkr: 0, shippingPkr: 0, totalPkr: 0, couponCode: null, couponError: null, couponSavingsPkr: 0 };
  const lines = sqlite.prepare(`SELECT ci.id, p.id AS productId, p.collection_id AS collectionId, ci.variant_id AS variantId, ci.quantity,
    p.title, p.slug, v.title AS variantTitle, v.sku, v.price_pkr AS pricePkr, v.stock,
    (SELECT path FROM product_images WHERE product_id = p.id ORDER BY position, id LIMIT 1) AS imagePath,
    (SELECT alt FROM product_images WHERE product_id = p.id ORDER BY position, id LIMIT 1) AS imageAlt,
    COALESCE((SELECT GROUP_CONCAT(po.name || ': ' || ov.value, ', ') FROM variant_option_values vov
      JOIN option_values ov ON ov.id = vov.option_value_id JOIN product_options po ON po.id = ov.option_id
      WHERE vov.variant_id = v.id), v.title) AS options
    FROM cart_items ci JOIN variants v ON v.id = ci.variant_id JOIN products p ON p.id = v.product_id
    WHERE ci.cart_id = ? AND p.status = 'PUBLISHED' AND v.active = 1 ORDER BY ci.id`).all(cart.id) as CartLine[];
  const settings = getSettings();
  const base = calculateTotals(lines.map((line) => ({ unitPricePkr: line.pricePkr, quantity: line.quantity })), settings.shippingPkr, settings.freeShippingThresholdPkr);
  let coupon = null;
  let couponError: string | null = null;
  try {
    coupon = getCouponEvaluation(sqlite, cart.couponCode, lines.map((line) => ({ unitPricePkr: line.pricePkr, quantity: line.quantity, productId: line.productId, collectionId: line.collectionId })), base.subtotalPkr, null);
  } catch (error) {
    if (error instanceof ApiError) couponError = error.message;
    else throw error;
  }
  const totals = calculateCommerceTotals(
    lines.map((line) => ({ unitPricePkr: line.pricePkr, quantity: line.quantity })),
    settings.shippingPkr,
    settings.freeShippingThresholdPkr,
    coupon?.discountPkr ?? 0,
    coupon?.freeShipping ?? false,
    Boolean(settings.taxEnabled),
    settings.taxRateBps,
  );
  return { id: cart.id, lines, ...totals, couponCode: cart.couponCode, couponError, couponSavingsPkr: totals.discountPkr + Math.max(0, base.shippingPkr - totals.shippingPkr) };
}

export function addCartItem(rawToken: string | undefined, variantId: number, quantity: number) {
  const variant = sqlite.prepare(`SELECT v.id, v.stock FROM variants v JOIN products p ON p.id = v.product_id
    WHERE v.id = ? AND v.active = 1 AND p.status = 'PUBLISHED'`).get(variantId) as { id: number; stock: number } | undefined;
  if (!variant) throw new ApiError(404, "PRODUCT_UNAVAILABLE", "This selection is unavailable.");
  if (quantity > variant.stock) throw new ApiError(409, "STOCK_CHANGED", "The requested quantity is unavailable.");
  const existing = findCart(rawToken);
  const token = existing ? rawToken! : randomToken();
  const cartId = existing?.id ?? randomUUID();
  const transaction = sqlite.transaction(() => {
    if (!existing) sqlite.prepare("INSERT INTO carts (id, token_hash) VALUES (?, ?)").run(cartId, hashToken(token));
    const line = sqlite.prepare("SELECT id, quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?").get(cartId, variantId) as { id: number; quantity: number } | undefined;
    const nextQuantity = (line?.quantity ?? 0) + quantity;
    if (nextQuantity > 20 || nextQuantity > variant.stock) throw new ApiError(409, "STOCK_CHANGED", "The requested quantity is unavailable.");
    if (line) sqlite.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").run(nextQuantity, line.id);
    else sqlite.prepare("INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES (?, ?, ?)").run(cartId, variantId, quantity);
    sqlite.prepare("UPDATE carts SET updated_at = unixepoch() * 1000 WHERE id = ?").run(cartId);
  });
  transaction.immediate();
  return { token, state: readCart(token) };
}

export function updateCartItem(rawToken: string | undefined, itemId: number, quantity: number | null) {
  const cart = findCart(rawToken);
  if (!cart) throw new ApiError(404, "CART_ITEM_NOT_FOUND", "The cart item was not found.");
  const line = sqlite.prepare(`SELECT ci.id, v.stock FROM cart_items ci JOIN variants v ON v.id = ci.variant_id
    WHERE ci.id = ? AND ci.cart_id = ?`).get(itemId, cart.id) as { id: number; stock: number } | undefined;
  if (!line) throw new ApiError(404, "CART_ITEM_NOT_FOUND", "The cart item was not found.");
  if (quantity !== null && quantity > line.stock) throw new ApiError(409, "STOCK_CHANGED", "The requested quantity is unavailable.");
  const transaction = sqlite.transaction(() => {
    if (quantity === null) sqlite.prepare("DELETE FROM cart_items WHERE id = ? AND cart_id = ?").run(itemId, cart.id);
    else sqlite.prepare("UPDATE cart_items SET quantity = ? WHERE id = ? AND cart_id = ?").run(quantity, itemId, cart.id);
    sqlite.prepare("UPDATE carts SET updated_at = unixepoch() * 1000 WHERE id = ?").run(cart.id);
  });
  transaction.immediate();
  return readCart(rawToken);
}

export function setCartCoupon(rawToken: string | undefined, rawCode: string | null) {
  const cart = findCart(rawToken);
  if (!cart) throw new ApiError(409, "CART_EMPTY", "Your cart is empty.");
  const code = rawCode?.trim() ? normalizeCouponCode(rawCode) : null;
  if (code && !/^[A-Z0-9_-]{2,40}$/.test(code)) throw new ApiError(422, "COUPON_INVALID", "Enter a valid coupon code.");
  const transaction = sqlite.transaction(() => {
    sqlite.prepare("UPDATE carts SET coupon_code = ?, updated_at = unixepoch() * 1000 WHERE id = ?").run(code, cart.id);
    const state = readCart(rawToken);
    if (state.couponError) throw new ApiError(422, "COUPON_INVALID", state.couponError);
    return state;
  });
  return transaction.immediate();
}
