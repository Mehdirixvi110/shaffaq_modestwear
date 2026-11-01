import { randomUUID } from "node:crypto";
import { database } from "@/db";
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

export async function findCart(rawToken: string | undefined) {
  if (!rawToken) return null;
  return database.prepare("SELECT id, coupon_code AS couponCode FROM carts WHERE token_hash = ?").get<{ id: string; couponCode: string | null }>(hashToken(rawToken));
}

export async function readCart(rawToken: string | undefined): Promise<CartState> {
  const cart = await findCart(rawToken);
  if (!cart) return { id: null, lines: [], subtotalPkr: 0, discountPkr: 0, taxPkr: 0, shippingPkr: 0, totalPkr: 0, couponCode: null, couponError: null, couponSavingsPkr: 0 };
  const lines = await database.prepare(`SELECT ci.id, p.id AS productId, p.collection_id AS collectionId, ci.variant_id AS variantId, ci.quantity,
    p.title, p.slug, v.title AS variantTitle, v.sku, v.price_pkr AS pricePkr, v.stock,
    (SELECT path FROM product_images WHERE product_id = p.id ORDER BY position, id LIMIT 1) AS imagePath,
    (SELECT alt FROM product_images WHERE product_id = p.id ORDER BY position, id LIMIT 1) AS imageAlt,
    COALESCE((SELECT GROUP_CONCAT(po.name || ': ' || ov.value, ', ') FROM variant_option_values vov
      JOIN option_values ov ON ov.id = vov.option_value_id JOIN product_options po ON po.id = ov.option_id
      WHERE vov.variant_id = v.id), v.title) AS options
    FROM cart_items ci JOIN variants v ON v.id = ci.variant_id JOIN products p ON p.id = v.product_id
    WHERE ci.cart_id = ? AND p.status = 'PUBLISHED' AND v.active = 1 ORDER BY ci.id`).all<CartLine>(cart.id);
  const settings = await getSettings();
  const base = calculateTotals(lines.map((line) => ({ unitPricePkr: line.pricePkr, quantity: line.quantity })), settings.shippingPkr, settings.freeShippingThresholdPkr);
  let coupon = null;
  let couponError: string | null = null;
  try {
    coupon = await getCouponEvaluation(database, cart.couponCode, lines.map((line) => ({ unitPricePkr: line.pricePkr, quantity: line.quantity, productId: line.productId, collectionId: line.collectionId })), base.subtotalPkr, null);
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

export async function addCartItem(rawToken: string | undefined, variantId: number, quantity: number) {
  const existing = await findCart(rawToken);
  const token = existing ? rawToken! : randomToken();
  const cartId = existing?.id ?? randomUUID();
  await database.transaction(async () => {
    const variant = await database.prepare(`SELECT v.id, v.stock FROM variants v JOIN products p ON p.id = v.product_id
      WHERE v.id = ? AND v.active = 1 AND p.status = 'PUBLISHED'${database.provider === "postgres" ? " FOR UPDATE OF v" : ""}`).get<{ id: number; stock: number }>(variantId);
    if (!variant) throw new ApiError(404, "PRODUCT_UNAVAILABLE", "This selection is unavailable.");
    if (quantity > variant.stock) throw new ApiError(409, "STOCK_CHANGED", "The requested quantity is unavailable.");
    if (!existing) await database.prepare("INSERT INTO carts (id, token_hash) VALUES (?, ?)").run(cartId, hashToken(token));
    const line = await database.prepare(`SELECT id, quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?${database.provider === "postgres" ? " FOR UPDATE" : ""}`).get<{ id: number; quantity: number }>(cartId, variantId);
    const nextQuantity = (line?.quantity ?? 0) + quantity;
    if (nextQuantity > 20 || nextQuantity > variant.stock) throw new ApiError(409, "STOCK_CHANGED", "The requested quantity is unavailable.");
    if (line) await database.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").run(nextQuantity, line.id);
    else await database.prepare("INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES (?, ?, ?)").run(cartId, variantId, quantity);
    await database.prepare("UPDATE carts SET updated_at = unixepoch() * 1000 WHERE id = ?").run(cartId);
  }).immediate();
  return { token, state: await readCart(token) };
}

export async function updateCartItem(rawToken: string | undefined, itemId: number, quantity: number | null) {
  const cart = await findCart(rawToken);
  if (!cart) throw new ApiError(404, "CART_ITEM_NOT_FOUND", "The cart item was not found.");
  await database.transaction(async () => {
    const line = await database.prepare(`SELECT ci.id, v.stock FROM cart_items ci JOIN variants v ON v.id = ci.variant_id
      WHERE ci.id = ? AND ci.cart_id = ?${database.provider === "postgres" ? " FOR UPDATE OF ci, v" : ""}`).get<{ id: number; stock: number }>(itemId, cart.id);
    if (!line) throw new ApiError(404, "CART_ITEM_NOT_FOUND", "The cart item was not found.");
    if (quantity !== null && quantity > line.stock) throw new ApiError(409, "STOCK_CHANGED", "The requested quantity is unavailable.");
    if (quantity === null) await database.prepare("DELETE FROM cart_items WHERE id = ? AND cart_id = ?").run(itemId, cart.id);
    else await database.prepare("UPDATE cart_items SET quantity = ? WHERE id = ? AND cart_id = ?").run(quantity, itemId, cart.id);
    await database.prepare("UPDATE carts SET updated_at = unixepoch() * 1000 WHERE id = ?").run(cart.id);
  }).immediate();
  return readCart(rawToken);
}

export async function setCartCoupon(rawToken: string | undefined, rawCode: string | null) {
  const cart = await findCart(rawToken);
  if (!cart) throw new ApiError(409, "CART_EMPTY", "Your cart is empty.");
  const code = rawCode?.trim() ? normalizeCouponCode(rawCode) : null;
  if (code && !/^[A-Z0-9_-]{2,40}$/.test(code)) throw new ApiError(422, "COUPON_INVALID", "Enter a valid coupon code.");
  return database.transaction(async () => {
    await database.prepare("UPDATE carts SET coupon_code = ?, updated_at = unixepoch() * 1000 WHERE id = ?").run(code, cart.id);
    const state = await readCart(rawToken);
    if (state.couponError) throw new ApiError(422, "COUPON_INVALID", state.couponError);
    return state;
  }).immediate();
}
