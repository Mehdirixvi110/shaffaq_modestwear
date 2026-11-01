import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { database } from "../src/db";
import { createCsrfToken, hashToken, randomToken } from "../src/lib/security";
import { checkoutSchema } from "../src/lib/validation";
import { addCartItem, setCartCoupon } from "../src/server/cart";
import { checkout, getOrderForCustomer } from "../src/server/checkout";
import { getAdminHomepage } from "../src/server/admin-data";
import { withAdminAudit } from "../src/server/admin";
import { requireAdminRequest } from "../src/server/auth";
import { adjustStockImmediately } from "../src/server/inventory";
import { hashPassword } from "../src/server/password";
import { removeStoredMedia, storeImage, type StoredMedia } from "../src/server/media-storage";
import { getApprovedReviews, getHomepageSections, getNavigation, getProduct, getSettings, listCategoryTiles, listProducts } from "../src/server/store";
import { readWishlist, updateWishlist } from "../src/server/wishlist";
import { PATCH as transitionOrder } from "../src/app/api/admin/orders/[id]/route";
import { POST as submitReview } from "../src/app/orders/[reference]/reviews/route";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function within<T>(label: string, operation: Promise<T>) {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out.`)), 30_000); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const schema = process.env.DATABASE_SCHEMA;
if (!schema?.startsWith("shaffaq_verify_")) throw new Error("PostgreSQL integration verification requires an isolated shaffaq_verify_* schema.");
if (database.provider !== "postgres") throw new Error("PostgreSQL integration verification requires DATABASE_PROVIDER=postgres.");
if (process.env.MEDIA_PROVIDER !== "supabase") throw new Error("PostgreSQL integration verification requires MEDIA_PROVIDER=supabase.");

const marker = randomUUID();
const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
const adminEmail = `verify-${marker}@example.test`;
const adminPassword = `Verify-${randomBytes(24).toString("base64url")}Aa1!`;
const sessionToken = randomToken();
const csrf = createCsrfToken();
let storedMedia: StoredMedia | null = null;

function adminRequest(path: string, body: unknown) {
  return new NextRequest(new URL(path, origin), {
    method: "PATCH",
    headers: { "content-type": "application/json", origin, "x-csrf-token": csrf, cookie: `shaffaq_csrf=${csrf}; shaffaq_session=${sessionToken}` },
    body: JSON.stringify(body),
  });
}

function customerRequest(path: string, body: unknown, accessToken: string) {
  return new NextRequest(new URL(path, origin), {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-csrf-token": csrf, cookie: `shaffaq_csrf=${csrf}; shaffaq_order_access=${accessToken}` },
    body: JSON.stringify(body),
  });
}

async function transition(orderId: string, action: string, expectedVersion: number, extra: Record<string, unknown> = {}) {
  const response = await transitionOrder(adminRequest(`/api/admin/orders/${orderId}`, { action, reason: null, courierName: null, trackingNumber: null, expectedVersion, ...extra }), { params: Promise.resolve({ id: orderId }) });
  const body = await response.json() as Record<string, unknown>;
  assert(response.ok, `Order transition ${action} failed with ${String(body.code ?? response.status)}.`);
  return body;
}

try {
  const passwordHash = await hashPassword(adminPassword);
  const admin = await database.prepare("INSERT INTO users (email, display_name, password_hash, role) VALUES (?, ?, ?, 'ADMIN')").run(adminEmail, "Verification Admin", passwordHash);
  await database.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)").run(randomUUID(), admin.lastInsertRowid, hashToken(sessionToken), Date.now() + 60 * 60 * 1000);

  const validActor = await requireAdminRequest(new NextRequest(new URL("/api/admin/session", origin), { headers: { cookie: `shaffaq_session=${sessionToken}` } }));
  assert(validActor.email === adminEmail, "Valid administrator session did not resolve to its isolated actor.");
  let isolated = false;
  try { await requireAdminRequest(new NextRequest(new URL("/api/admin/session", origin), { headers: { cookie: `shaffaq_session=${randomToken()}` } })); } catch { isolated = true; }
  assert(isolated, "An unrelated administrator token was accepted.");

  const catalogue = await listProducts({ limit: 10 });
  await within("layout reads", Promise.all([getSettings(), getNavigation()]));
  await within("homepage reads", Promise.all([getSettings(), getHomepageSections(), listProducts({ limit: 8 })]));
  await within("homepage section reads", Promise.all([listCategoryTiles(), getApprovedReviews(undefined, 6)]));
  assert(catalogue.count === 6, "Seeded PostgreSQL catalogue count is incorrect.");
  const product = await getProduct("sample-look-01-espresso");
  assert(product?.variants.length === 3 && product.options.length === 1, "PostgreSQL product detail/options did not load.");
  const primaryVariant = product.variants[0];

  const cartOne = await addCartItem(undefined, primaryVariant.id, 1);
  const coupon = await database.prepare("INSERT INTO coupons (code, description, type, value, enabled, minimum_subtotal_pkr, usage_limit, per_contact_limit) VALUES (?, ?, 'PERCENT', 10, 1, 0, 10, 1)").run(`VERIFY_${marker.replaceAll("-", "").slice(0, 12).toUpperCase()}`, "Isolated integration coupon");
  const couponCode = `VERIFY_${marker.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  await database.prepare("INSERT INTO coupon_products (coupon_id, product_id) VALUES (?, ?)").run(coupon.lastInsertRowid, product.id);
  const discounted = await setCartCoupon(cartOne.token, couponCode);
  assert(discounted.discountPkr > 0, "Coupon was not evaluated against the PostgreSQL cart.");

  const checkoutInput = checkoutSchema.parse({ idempotencyKey: randomUUID(), customerName: "Verification Customer", email: `customer-${marker}@example.test`, phone: "03001234567", addressLine1: "1 Verification Street", addressLine2: "", city: "Karachi", region: "Sindh", postalCode: "", country: "PK", notes: "", couponCode });
  const subject = randomToken();
  const firstCheckout = await checkout(checkoutInput, "STOREFRONT_COD", cartOne.token, subject);
  const replay = await checkout(checkoutInput, "STOREFRONT_COD", cartOne.token, subject);
  assert(firstCheckout.result.reference === replay.result.reference, "Checkout idempotency did not replay the original PostgreSQL order.");
  const redemption = await database.prepare("SELECT COUNT(*) AS count FROM coupon_redemptions WHERE order_id = ?").get<{ count: number }>((await database.prepare("SELECT id FROM orders WHERE reference = ?").get<{ id: string }>(firstCheckout.result.reference))?.id);
  assert(redemption?.count === 1, "Coupon redemption was not recorded exactly once.");

  const oversellProduct = await getProduct("sample-look-02-ivory");
  assert(oversellProduct, "Oversell verification product is missing.");
  const oversellVariant = oversellProduct.variants[0];
  const [cartA, cartB] = await Promise.all([addCartItem(undefined, oversellVariant.id, 4), addCartItem(undefined, oversellVariant.id, 4)]);
  const makeOversellInput = (email: string) => checkoutSchema.parse({ idempotencyKey: randomUUID(), customerName: "Stock Race", email, phone: "03001234567", addressLine1: "2 Verification Street", addressLine2: "", city: "Karachi", region: "", postalCode: "", country: "PK", notes: "", couponCode: null });
  const raced = await Promise.allSettled([
    checkout(makeOversellInput(`race-a-${marker}@example.test`), "STOREFRONT_COD", cartA.token, randomToken()),
    checkout(makeOversellInput(`race-b-${marker}@example.test`), "STOREFRONT_COD", cartB.token, randomToken()),
  ]);
  assert(raced.filter((result) => result.status === "fulfilled").length === 1 && raced.filter((result) => result.status === "rejected").length === 1, "Concurrent PostgreSQL checkout did not deny one oversell attempt.");
  const stockAfterRace = await database.prepare("SELECT stock FROM variants WHERE id = ?").get<{ stock: number }>(oversellVariant.id);
  assert(stockAfterRace && stockAfterRace.stock >= 0, "Concurrent checkout produced negative stock.");

  const orderRow = await database.prepare("SELECT id, version FROM orders WHERE reference = ?").get<{ id: string; version: number }>(firstCheckout.result.reference);
  assert(orderRow, "Checkout order is missing before transition verification.");
  await transition(orderRow.id, "CONFIRM", orderRow.version);
  await transition(orderRow.id, "PROCESS", orderRow.version + 1);
  await transition(orderRow.id, "SHIP", orderRow.version + 2, { courierName: "Verification Courier", trackingNumber: `VERIFY-${marker.slice(0, 8)}` });
  await transition(orderRow.id, "DELIVER", orderRow.version + 3);
  const delivered = await getOrderForCustomer(firstCheckout.result.reference, firstCheckout.accessToken) as { id: string; orderStatus: string; fulfillmentStatus: string; items: Array<{ id: number }> } | null;
  assert(delivered?.orderStatus === "CONFIRMED" && delivered.fulfillmentStatus === "DELIVERED", "Legal order transition sequence did not reach delivered.");

  const reviewBody = { orderItemId: delivered.items[0].id, rating: 5, title: "Verification review", body: "Temporary integration review for constraint verification." };
  const reviewResponse = await submitReview(customerRequest(`/orders/${firstCheckout.result.reference}/reviews`, reviewBody, firstCheckout.accessToken), { params: Promise.resolve({ reference: firstCheckout.result.reference }) });
  assert(reviewResponse.status === 201, "Delivered-order review was not accepted.");
  const duplicateReview = await submitReview(customerRequest(`/orders/${firstCheckout.result.reference}/reviews`, reviewBody, firstCheckout.accessToken), { params: Promise.resolve({ reference: firstCheckout.result.reference }) });
  assert(duplicateReview.status === 409, "Duplicate delivered-item review was not rejected.");

  const wishlist = await updateWishlist(undefined, product.id, "ADD");
  await updateWishlist(wishlist.token, product.id, "ADD");
  assert((await readWishlist(wishlist.token)).items.length === 1, "Wishlist uniqueness was not preserved.");

  const newsletterEmail = `newsletter-${marker}@example.test`;
  await database.prepare("INSERT INTO newsletter_subscriptions (id, email, consented_at, consent_source, unsubscribe_token_hash) VALUES (?, ?, ?, 'VERIFY', ?)").run(randomUUID(), newsletterEmail, Date.now(), hashToken(randomToken()));
  let newsletterUnique = false;
  try { await database.prepare("INSERT INTO newsletter_subscriptions (id, email, consented_at, consent_source, unsubscribe_token_hash) VALUES (?, ?, ?, 'VERIFY', ?)").run(randomUUID(), newsletterEmail, Date.now(), hashToken(randomToken())); } catch (error) { newsletterUnique = error instanceof Error && error.message.includes("UNIQUE"); }
  assert(newsletterUnique, "Newsletter email uniqueness was not enforced.");

  const inventoryProduct = await getProduct("sample-look-03-olive");
  assert(inventoryProduct, "Inventory race verification product is missing.");
  const inventoryVariant = await database.prepare("SELECT id, version FROM variants WHERE id = ?").get<{ id: number; version: number }>(inventoryProduct.variants[0].id);
  assert(inventoryVariant, "Inventory race verification variant is missing.");
  const adjustments = await Promise.allSettled([
    adjustStockImmediately({ variantId: inventoryVariant.id, delta: 1, expectedVersion: inventoryVariant.version, reason: "Isolated race A", source: "MANUAL", sourceKey: `VERIFY:${marker}:A`, actorUserId: validActor.id }),
    adjustStockImmediately({ variantId: inventoryVariant.id, delta: 1, expectedVersion: inventoryVariant.version, reason: "Isolated race B", source: "MANUAL", sourceKey: `VERIFY:${marker}:B`, actorUserId: validActor.id }),
  ]);
  assert(adjustments.filter((result) => result.status === "fulfilled").length === 1, "Optimistic inventory race did not allow exactly one adjustment.");

  const settings = await getSettings();
  await withAdminAudit(validActor, "verify.settings", "settings", "1", {}, async (connection) => {
    const changed = await connection.prepare("UPDATE settings SET descriptor = ?, version = version + 1 WHERE id = 1 AND version = ?").run(`${settings.descriptor} verification`, settings.version);
    assert(changed.changes === 1, "Settings optimistic update failed.");
    const restored = await connection.prepare("UPDATE settings SET descriptor = ?, version = version + 1 WHERE id = 1 AND version = ?").run(settings.descriptor, settings.version + 1);
    assert(restored.changes === 1, "Settings restoration failed.");
  });
  const homepage = await getAdminHomepage();
  const firstSection = homepage.sections[0] as { id: number; title: string | null };
  await withAdminAudit(validActor, "verify.cms", "homepage_section", String(firstSection.id), {}, async (connection) => {
    await connection.prepare("UPDATE homepage_sections SET title = ? WHERE id = ?").run(`${firstSection.title ?? "Section"} verification`, firstSection.id);
    await connection.prepare("UPDATE homepage_sections SET title = ? WHERE id = ?").run(firstSection.title, firstSection.id);
  });
  const auditCount = await database.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE action LIKE 'verify.%'").get<{ count: number }>();
  assert((auditCount?.count ?? 0) >= 2, "Settings/CMS audit records were not written.");

  const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  storedMedia = await storeImage(tinyPng, "png", "image/png", `verify-${marker}`);
  const publicResponse = await fetch(storedMedia.publicPath, { cache: "no-store" });
  assert(publicResponse.ok && Buffer.from(await publicResponse.arrayBuffer()).equals(tinyPng), "Supabase Storage public retrieval did not match the uploaded test object.");
  await removeStoredMedia(storedMedia);
  storedMedia = null;

  console.log("PostgreSQL integration passed: auth isolation, catalogue, cart/coupon, checkout replay and oversell denial, order transitions, review/newsletter/wishlist constraints, inventory race, audited CMS/settings, and Supabase Storage upload/retrieval/cleanup.");
} finally {
  if (storedMedia) await removeStoredMedia(storedMedia).catch(() => undefined);
  await database.close();
}
