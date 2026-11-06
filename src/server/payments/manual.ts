import { randomUUID } from "node:crypto";
import { database, type DatabaseConnection } from "@/db";
import { normalizeCouponCode } from "@/lib/coupons";
import { buildManualAccountSnapshot, manualPaymentAvailable } from "@/lib/payments/manual";
import { canonicalHash, hashToken } from "@/lib/security";
import type { CheckoutInput } from "@/lib/validation";
import { findCart } from "../cart";
import { createUniqueReference, getReplay, loadCheckoutContext, persistOrderFromCart, type CheckoutResult } from "../checkout";
import { ApiError } from "../http";
import { getSettings } from "../store";

export type ManualPaymentRow = { id: string; status: string; amount: number; currency: string; accountSnapshot: string | null };
export type ManualProof = { id: number; publicPath: string; mime: string; width: number | null; height: number | null; createdAt: number };
export type ManualPaymentView = { payment: ManualPaymentRow | null; proofs: ManualProof[] };

// Fully synchronous bank-transfer begin — mirrors beginOnlineCheckout's
// idempotency/transaction structure but has NO gateway/network seam and NO
// stale-pending sweep (there is no hosted-page abandonment loop). Stock is
// allocated at placement by persistOrderFromCart (STOREFRONT_MANUAL allocates like
// COD) and released on cancel by the existing admin CANCEL action. Unlike the
// online path, the cart IS consumed and the order-access cookie stays strict.
// A MANUAL payments row is created PENDING; it becomes PAID only via an audited
// admin action (never a client path) — the PAID-authority invariant holds.
export async function beginManualCheckout(
  input: CheckoutInput,
  rawCartToken: string | undefined,
  rawSubjectToken: string | undefined,
): Promise<{ result: CheckoutResult; accessToken: string }> {
  if (!rawSubjectToken) throw new ApiError(400, "CHECKOUT_SUBJECT_REQUIRED", "Refresh checkout before submitting your order.");
  const subjectHash = hashToken(rawSubjectToken);
  const requestHash = canonicalHash({ source: "STOREFRONT_MANUAL", input });
  const replay = await getReplay(database, subjectHash, input.idempotencyKey, requestHash);
  if (replay) return replay;
  const cart = await findCart(rawCartToken);
  if (!cart) throw new ApiError(409, "CART_EMPTY", "Your cart is empty.");
  const submittedCoupon = input.couponCode ? normalizeCouponCode(input.couponCode) : null;
  const persistedCoupon = cart.couponCode ? normalizeCouponCode(cart.couponCode) : null;
  if (submittedCoupon !== persistedCoupon) throw new ApiError(409, "COUPON_CHANGED", "The cart coupon changed. Reload checkout and try again.");

  const settings = await getSettings();
  if (settings.maintenanceMode) throw new ApiError(503, "MAINTENANCE", settings.maintenanceMessage ?? "Checkout is temporarily unavailable for maintenance.");
  // Fail-closed server gate (the UI only mirrors this): refuse a forged request
  // when manual payment is disabled or has no configured payable account.
  if (!manualPaymentAvailable(settings)) throw new ApiError(404, "PAYMENT_PROVIDER_UNAVAILABLE", "Bank-transfer payment is not available.");
  const snapshot = JSON.stringify(buildManualAccountSnapshot(settings));

  return database.transaction(async () => {
    if (database.provider === "postgres") {
      await database.prepare("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))").get(`${subjectHash}:${input.idempotencyKey}`);
    }
    const concurrentReplay = await getReplay(database, subjectHash, input.idempotencyKey, requestHash);
    if (concurrentReplay) return concurrentReplay;
    const context = await loadCheckoutContext(database, { input, settings, cart, persistedCoupon });
    const orderId = randomUUID();
    const reference = await createUniqueReference(database);
    const { accessToken } = await persistOrderFromCart(database, { source: "STOREFRONT_MANUAL", input, context, orderId, reference });
    await database.prepare("INSERT INTO payments (id, order_id, provider, status, amount, currency, account_snapshot) VALUES (?, ?, 'MANUAL', 'PENDING', ?, 'PKR', ?)")
      .run(randomUUID(), orderId, context.totals.totalPkr, snapshot);
    await database.prepare("INSERT INTO order_history (order_id, event, note) VALUES (?, ?, ?)").run(orderId, "PAYMENT_PENDING", "Bank-transfer payment pending; awaiting proof upload and admin verification.");
    const notice = "Your order is reserved. Transfer the total to the account shown, then upload your payment screenshot. The order stays unpaid until an administrator verifies your transfer.";
    const result: CheckoutResult = {
      reference,
      redirectTo: `/orders/${reference}?payment=manual`,
      source: "STOREFRONT_MANUAL",
      orderStatus: "PENDING_CONFIRMATION",
      totalPkr: context.totals.totalPkr,
      whatsappUrl: null,
      notice,
    };
    await database.prepare("INSERT INTO checkout_requests (subject_hash, idempotency_key, request_hash, order_id, response_json) VALUES (?, ?, ?, ?, ?)")
      .run(subjectHash, input.idempotencyKey, requestHash, orderId, JSON.stringify(result));
    await database.prepare("DELETE FROM carts WHERE id = ?").run(cart.id);
    return { result, accessToken };
  }).immediate();
}

// The MANUAL payment row (with its account snapshot) plus every uploaded proof,
// newest first. Read-only; used by the customer order page and admin order detail.
export async function getManualPaymentView(orderId: string): Promise<ManualPaymentView> {
  const payment = await database.prepare("SELECT id, status, amount, currency, account_snapshot AS accountSnapshot FROM payments WHERE order_id = ? AND provider = 'MANUAL'")
    .get<ManualPaymentRow>(orderId);
  const proofs = await database.prepare(`SELECT pp.id, mf.public_path AS publicPath, mf.mime, mf.width, mf.height, pp.created_at AS createdAt
    FROM payment_proofs pp JOIN media_files mf ON mf.id = pp.media_file_id WHERE pp.order_id = ? ORDER BY pp.id DESC`)
    .all<ManualProof>(orderId);
  return { payment: payment ?? null, proofs };
}

// Link an uploaded, already-stored proof image to the order and record the event.
// Runs inside the caller's transaction. NEVER touches payment_status — uploading a
// proof keeps the order PENDING for admin review.
export async function recordPaymentProof(connection: DatabaseConnection, args: { orderId: string; mediaFileId: number }): Promise<number> {
  const inserted = await connection.prepare("INSERT INTO payment_proofs (order_id, media_file_id) VALUES (?, ?)").run(args.orderId, args.mediaFileId);
  await connection.prepare("INSERT INTO order_history (order_id, event, note) VALUES (?, ?, ?)").run(args.orderId, "PAYMENT_PROOF_UPLOADED", "Customer uploaded a bank-transfer payment proof; awaiting admin verification.");
  return Number(inserted.lastInsertRowid);
}

export type ProofForViewer = { storageKey: string; mime: string; sha256: string };

// Access-gated lookup backing GET /orders/[reference]/payment-proof/[id]. Payment
// proofs are customer financial data, so the media descriptor is returned ONLY to an
// authenticated admin OR the order owner proven by the order-access capability token
// (its hash must equal the order's stored order_access_hash — the exact check
// getOrderForCustomer uses). An unknown proof, a reference that does not own the
// proof, or any unauthorized caller yields null so the route 404s without signalling
// existence (no IDOR), matching the sibling upload route's convention.
export async function getProofForViewer(reference: string, proofId: number, viewer: { isAdmin: boolean; rawAccessToken: string | undefined }): Promise<ProofForViewer | null> {
  if (!Number.isInteger(proofId) || proofId <= 0) return null;
  const row = await database.prepare(`SELECT mf.storage_key AS storageKey, mf.mime, mf.sha256, o.order_access_hash AS orderAccessHash
    FROM payment_proofs pp JOIN media_files mf ON mf.id = pp.media_file_id JOIN orders o ON o.id = pp.order_id
    WHERE pp.id = ? AND o.reference = ?`).get<{ storageKey: string; mime: string; sha256: string; orderAccessHash: string }>(proofId, reference);
  if (!row) return null;
  const isOwner = Boolean(viewer.rawAccessToken) && hashToken(viewer.rawAccessToken!) === row.orderAccessHash;
  if (!viewer.isAdmin && !isOwner) return null;
  return { storageKey: row.storageKey, mime: row.mime, sha256: row.sha256 };
}

// Write-once guarded PENDING -> PAID transition for the MANUAL payment row. Returns
// the number of rows changed so the admin route throws ILLEGAL_TRANSITION on 0
// (already paid / not a pending MANUAL payment). Unit-testable in isolation.
export async function markManualPaymentPaid(connection: DatabaseConnection, orderId: string): Promise<number> {
  const update = await connection.prepare("UPDATE payments SET status = 'PAID', version = version + 1, updated_at = unixepoch() * 1000 WHERE order_id = ? AND provider = 'MANUAL' AND status = 'PENDING'").run(orderId);
  return update.changes;
}
