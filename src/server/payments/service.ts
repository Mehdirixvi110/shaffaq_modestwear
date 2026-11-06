import { randomUUID } from "node:crypto";
import { database, type DatabaseConnection } from "@/db";
import { normalizeCouponCode } from "@/lib/coupons";
import { reconcilePaymentAmount } from "@/lib/payments/amount";
import { resolvePaymentTransition } from "@/lib/payments/transition";
import type { PaymentProvider, PaymentStatus, VerifiedEvent } from "@/lib/payments/types";
import { canonicalHash, hashToken } from "@/lib/security";
import type { CheckoutInput } from "@/lib/validation";
import { findCart } from "../cart";
import { createUniqueReference, getReplay, loadCheckoutContext, persistOrderFromCart, type CheckoutResult } from "../checkout";
import { ApiError } from "../http";
import { adjustStock } from "../inventory";
import { getSettings } from "../store";

// Conservative hold lifetime, chosen strictly ABOVE the gateway's hosted-checkout
// validity window so the sweep can never cancel a still-capturable session (A-7).
export const ONLINE_PENDING_TTL_MS = 30 * 60 * 1000;

export type ApplyPaymentOutcome = "APPLIED" | "DEDUPE" | "IGNORED" | "UNMATCHED" | "REJECTED" | "AMOUNT_MISMATCH";

type PaymentRow = { id: string; orderId: string; status: PaymentStatus; eventId: string | null; amount: number };

// Shared terminal reclaim: release reserved stock (idempotent ORDER_CANCEL
// sourceKey, mirroring admin CANCEL) AND delete the coupon redemption so a
// retried checkout can re-apply a limited coupon. Runs ONLY when the order was
// genuinely cancelled from its pre-fulfilment state.
async function releaseOrderStockAndCoupon(connection: DatabaseConnection, orderId: string, reason: string): Promise<void> {
  const order = await connection.prepare("SELECT stock_allocated AS allocated, stock_released AS released FROM orders WHERE id = ?").get<{ allocated: number; released: number }>(orderId);
  if (order?.allocated && !order.released) {
    const items = await connection.prepare("SELECT variant_id AS variantId, quantity FROM order_items WHERE order_id = ?").all<{ variantId: number | null; quantity: number }>(orderId);
    for (const item of items) {
      if (!item.variantId) continue;
      const variant = await connection.prepare("SELECT version FROM variants WHERE id = ?").get<{ version: number }>(item.variantId);
      if (variant) {
        await adjustStock(connection, {
          variantId: item.variantId,
          delta: item.quantity,
          expectedVersion: variant.version,
          reason,
          source: "ORDER_CANCEL",
          sourceKey: `${orderId}:${item.variantId}:ORDER_CANCEL`,
          orderId,
        });
      }
    }
    await connection.prepare("UPDATE orders SET stock_released = 1 WHERE id = ?").run(orderId);
  }
  // Idempotent single-row delete (coupon_redemptions.order_id is UNIQUE).
  await connection.prepare("DELETE FROM coupon_redemptions WHERE order_id = ?").run(orderId);
}

// Provider-first begin (DESIGN §5.4): compute the server-authoritative total and
// the shared order identity, call the provider OUTSIDE any transaction, then
// persist order + PENDING payment + replay row in one transaction. The cart is
// intentionally retained so a failed/cancelled/expired payment can be retried.
export async function beginOnlineCheckout(
  input: CheckoutInput,
  rawCartToken: string | undefined,
  rawSubjectToken: string | undefined,
  provider: PaymentProvider,
): Promise<{ result: CheckoutResult; accessToken: string }> {
  if (!rawSubjectToken) throw new ApiError(400, "CHECKOUT_SUBJECT_REQUIRED", "Refresh checkout before submitting your order.");
  const subjectHash = hashToken(rawSubjectToken);
  const requestHash = canonicalHash({ source: "STOREFRONT_ONLINE", input });
  const replay = await getReplay(database, subjectHash, input.idempotencyKey, requestHash);
  if (replay) return replay;
  const cart = await findCart(rawCartToken);
  if (!cart) throw new ApiError(409, "CART_EMPTY", "Your cart is empty.");
  const submittedCoupon = input.couponCode ? normalizeCouponCode(input.couponCode) : null;
  const persistedCoupon = cart.couponCode ? normalizeCouponCode(cart.couponCode) : null;
  if (submittedCoupon !== persistedCoupon) throw new ApiError(409, "COUPON_CHANGED", "The cart coupon changed. Reload checkout and try again.");

  const settings = await getSettings();
  if (settings.maintenanceMode) throw new ApiError(503, "MAINTENANCE", settings.maintenanceMessage ?? "Checkout is temporarily unavailable for maintenance.");

  // Opportunistic, bounded reclamation of abandoned online holds — best-effort,
  // must never fail a customer's checkout.
  try {
    await releaseExpiredOnlinePayments(database, { now: Date.now(), ttlMs: ONLINE_PENDING_TTL_MS, limit: 10 });
  } catch (error) {
    console.warn(`[payments] opportunistic sweep skipped: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  const pre = await loadCheckoutContext(database, { input, settings, cart, persistedCoupon });
  const orderId = randomUUID();
  const reference = await createUniqueReference(database);

  const appOrigin = process.env.APP_ORIGIN ?? "";
  const handoff = await provider.createCheckout({
    order: { id: orderId, reference, totalPkr: pre.totals.totalPkr, currency: "PKR" },
    customer: { name: input.customerName, email: input.email, phone: input.phone },
    returnUrl: `${appOrigin}/orders/${reference}?payment=return`,
    cancelUrl: `${appOrigin}/orders/${reference}?payment=cancelled`,
  });
  if (handoff.kind !== "REDIRECT" || !handoff.url || !handoff.providerReference) {
    throw new ApiError(502, "PAYMENT_PROVIDER_ERROR", "The payment provider did not return a valid checkout handoff.");
  }

  return database.transaction(async () => {
    if (database.provider === "postgres") {
      await database.prepare("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))").get(`${subjectHash}:${input.idempotencyKey}`);
    }
    const concurrentReplay = await getReplay(database, subjectHash, input.idempotencyKey, requestHash);
    if (concurrentReplay) return concurrentReplay;
    const context = await loadCheckoutContext(database, { input, settings, cart, persistedCoupon });
    // The total handed to the provider is authoritative; a price/stock change
    // before commit aborts, persisting nothing (the orphan tracker just expires).
    if (context.totals.totalPkr !== pre.totals.totalPkr) throw new ApiError(409, "PRICE_CHANGED", "Pricing changed before payment could start. Reload checkout and try again.");
    const { accessToken } = await persistOrderFromCart(database, { source: "STOREFRONT_ONLINE", input, context, orderId, reference });
    await database.prepare("INSERT INTO payments (id, order_id, provider, status, amount, currency, provider_reference, event_id) VALUES (?, ?, ?, 'PENDING', ?, 'PKR', ?, NULL)")
      .run(randomUUID(), orderId, provider.name, context.totals.totalPkr, handoff.providerReference);
    await database.prepare("INSERT INTO order_history (order_id, event, note) VALUES (?, ?, ?)").run(orderId, "PAYMENT_PENDING", `Online payment initiated via ${provider.name}.`);
    const notice = "Your order is reserved and awaiting online payment. It stays unpaid until payment is verified by our server.";
    const result: CheckoutResult = {
      reference,
      redirectTo: handoff.url,
      source: "STOREFRONT_ONLINE",
      orderStatus: "PENDING_CONFIRMATION",
      totalPkr: context.totals.totalPkr,
      whatsappUrl: null,
      notice,
    };
    await database.prepare("INSERT INTO checkout_requests (subject_hash, idempotency_key, request_hash, order_id, response_json) VALUES (?, ?, ?, ?, ?)")
      .run(subjectHash, input.idempotencyKey, requestHash, orderId, JSON.stringify(result));
    return { result, accessToken };
  }).immediate();
}

// Apply one verified, recognized webhook event to the payments row and derive the
// order side effects. Runs inside the caller's transaction. Correlates by tracker
// first, then by the echoed merchant reference. Returns a semantic outcome the
// route maps to an HTTP status; never sets PAID from anything but a capture.
export async function applyPaymentEvent(
  connection: DatabaseConnection,
  args: { provider: PaymentProvider; event: VerifiedEvent; target: PaymentStatus },
): Promise<ApplyPaymentOutcome> {
  const { provider, event, target } = args;

  let row: PaymentRow | undefined;
  if (event.providerReference) {
    row = await connection.prepare("SELECT id, order_id AS orderId, status, event_id AS eventId, amount FROM payments WHERE provider = ? AND provider_reference = ?")
      .get<PaymentRow>(provider.name, event.providerReference);
  }
  if (!row && event.merchantReference) {
    row = await connection.prepare("SELECT p.id, p.order_id AS orderId, p.status, p.event_id AS eventId, p.amount FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.provider = ? AND o.reference = ?")
      .get<PaymentRow>(provider.name, event.merchantReference);
  }
  // Valid signature + enabled provider but no matching row: authentic but
  // unmatched → signal retry (503), never a silent 200 that could drop a capture.
  if (!row) {
    console.warn(`[payments] unmatched ${provider.name} event ${event.eventId}; signalling retry`);
    return "UNMATCHED";
  }

  const outcome = resolvePaymentTransition(row.status, target, event.eventId, row.eventId ?? null);
  if (outcome === "DEDUPE") return "DEDUPE";
  if (outcome === "IGNORE") {
    console.info(`[payments] ignored ${provider.name} event ${event.eventId} (${event.rawType}) on ${row.status} payment`);
    return "IGNORED";
  }
  if (outcome === "REJECT") {
    console.warn(`[payments] rejected inconsistent ${provider.name} event ${event.eventId} on ${row.status} payment`);
    return "REJECTED";
  }

  // outcome === APPLY → target is necessarily one of {PAID, FAILED, CANCELLED}.
  // Reconcile money ONLY for a capture; failure/cancel events are not reconciled.
  if (target === "PAID") {
    try {
      reconcilePaymentAmount(row.amount, event.amount, event.currency);
    } catch {
      console.error(`[payments] amount_mismatch on order ${row.orderId}; no capture applied`);
      return "AMOUNT_MISMATCH";
    }
  }

  const update = await connection.prepare("UPDATE payments SET status = ?, event_id = ?, last_event = ?, provider_reference = COALESCE(?, provider_reference), version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND status = 'PENDING' AND event_id IS NULL")
    .run(target, event.eventId, `${event.rawType}:${event.eventId}`, event.providerReference, row.id);
  if (update.changes !== 1) return "DEDUPE"; // a concurrent delivery already claimed it

  if (target === "PAID") {
    await connection.prepare("UPDATE orders SET payment_status = 'PAID', version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND payment_status = 'UNPAID'").run(row.orderId);
    await connection.prepare("INSERT INTO order_history (order_id, event, note) VALUES (?, ?, ?)").run(row.orderId, "PAYMENT_CAPTURED", `Online payment captured via ${provider.name}.`);
  } else if (target === "FAILED" || target === "CANCELLED") {
    const cancel = await connection.prepare("UPDATE orders SET order_status = 'CANCELLED', cancellation_reason = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND order_status = 'PENDING_CONFIRMATION' AND fulfillment_status = 'UNFULFILLED'")
      .run(`Online payment ${target}`, row.orderId);
    if (cancel.changes === 1) {
      await releaseOrderStockAndCoupon(connection, row.orderId, `Released after online payment ${target}.`);
    } else {
      console.warn(`[payments] late ${target} on a non-pending order ${row.orderId}; left for manual reconciliation`);
    }
    await connection.prepare("INSERT INTO order_history (order_id, event, note) VALUES (?, ?, ?)").run(row.orderId, target === "FAILED" ? "PAYMENT_FAILED" : "PAYMENT_CANCELLED", `Online payment ${target} via ${provider.name}.`);
  } else {
    // Unreachable given resolvePaymentTransition's APPLY set; defence-in-depth so
    // no future mapped status silently strands stock/coupon reservations.
    console.error(`[payments] unexpected APPLY target ${target} on order ${row.orderId}`);
  }
  return "APPLIED";
}

// INV-4 "expire" leg: reclaim abandoned PENDING SAFEPAY holds older than the TTL,
// each in its own short transaction, applying the SAME guarded CANCELLED release +
// coupon reclaim a FAILED/CANCELLED webhook uses. Leaves event_id NULL so a late
// terminal webhook is still blocked by the status guard (never a double release).
export async function releaseExpiredOnlinePayments(
  connection: DatabaseConnection,
  args: { now: number; ttlMs: number; limit: number },
): Promise<number> {
  const cutoff = args.now - args.ttlMs;
  const stale = await connection.prepare("SELECT id, order_id AS orderId FROM payments WHERE provider = 'SAFEPAY' AND status = 'PENDING' AND created_at < ? ORDER BY created_at LIMIT ?")
    .all<{ id: string; orderId: string }>(cutoff, args.limit);
  let released = 0;
  for (const row of stale) {
    try {
      const applied = await connection.transaction(async () => {
        const update = await connection.prepare("UPDATE payments SET status = 'CANCELLED', last_event = 'EXPIRED_SWEEP', version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND status = 'PENDING' AND event_id IS NULL").run(row.id);
        if (update.changes !== 1) return false;
        const cancel = await connection.prepare("UPDATE orders SET order_status = 'CANCELLED', cancellation_reason = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND order_status = 'PENDING_CONFIRMATION' AND fulfillment_status = 'UNFULFILLED'")
          .run("Online payment expired", row.orderId);
        if (cancel.changes === 1) {
          await releaseOrderStockAndCoupon(connection, row.orderId, "Released after online payment expired.");
        } else {
          console.warn(`[payments] expired sweep on a non-pending order ${row.orderId}; left for manual reconciliation`);
        }
        await connection.prepare("INSERT INTO order_history (order_id, event, note) VALUES (?, ?, ?)").run(row.orderId, "PAYMENT_EXPIRED", "Online payment hold expired; reservation reclaimed.");
        return true;
      }).immediate();
      if (applied) released += 1;
    } catch (error) {
      console.warn(`[payments] stale-pending sweep failed for payment ${row.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
  return released;
}
