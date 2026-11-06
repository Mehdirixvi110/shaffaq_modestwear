import { createHmac, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CheckoutInput } from "../src/lib/validation";
import type { PaymentProvider } from "../src/lib/payments/types";

// Set a LOCAL temp SQLite path + required env BEFORE any app module loads, so the
// @/db singleton (dynamically imported in beforeAll) binds to the throwaway db —
// never the dev database. No live gateway or live DB is touched.
const tempDir = mkdtempSync(join(tmpdir(), "shaffaq-pay-"));
const dbPath = join(tempDir, "test.sqlite");
const WEBHOOK_SECRET_B64 = Buffer.from("local-fake-webhook-secret").toString("base64");
Object.assign(process.env, {
  DATABASE_PROVIDER: "sqlite",
  MEDIA_PROVIDER: "local",
  APP_ORIGIN: "http://localhost:3000",
  NEXT_PUBLIC_APP_ORIGIN: "http://localhost:3000",
  SQLITE_PATH: dbPath,
  MEDIA_ROOT: join(tempDir, "media"),
  SESSION_SECRET: "s".repeat(48),
  CSRF_SECRET: "c".repeat(48),
  SAFEPAY_ENVIRONMENT: "sandbox",
  SAFEPAY_API_KEY: "local-fake-key",
  SAFEPAY_WEBHOOK_SECRET: WEBHOOK_SECRET_B64,
});

{
  const sqlite = new Database(dbPath);
  sqlite.pragma("foreign_keys = ON");
  migrate(drizzle(sqlite), { migrationsFolder: "drizzle" });
  sqlite.close();
}

let database: (typeof import("../src/db"))["database"];
let hashToken: (typeof import("../src/lib/security"))["hashToken"];
let service: typeof import("../src/server/payments/service");
let createSafepayProvider: (typeof import("../src/server/payments/safepay"))["createSafepayProvider"];

function makeInput(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    idempotencyKey: randomUUID(),
    customerName: "Test Buyer",
    email: "buyer@example.com",
    phone: "+923001234567",
    addressLine1: "123 Street",
    addressLine2: "",
    city: "Lahore",
    region: "",
    postalCode: "",
    country: "PK",
    notes: "",
    couponCode: null,
    ...overrides,
  };
}

// A begin-side provider stub: returns a redirect without any network call, named
// SAFEPAY so its payments row correlates with the real webhook adapter.
function beginProvider(tracker: string): PaymentProvider {
  return {
    name: "SAFEPAY",
    createCheckout: () => Promise.resolve({ kind: "REDIRECT", url: `https://pay.test/${tracker}`, providerReference: tracker }),
    verifyWebhook: () => { throw new Error("unused in begin"); },
    mapEventToStatus: () => "IGNORE",
  };
}

function signedWebhook(body: Record<string, unknown>, opts: { secretB64?: string; timestamp?: string } = {}): { headers: Headers; rawBody: string } {
  const rawBody = JSON.stringify(body);
  const timestamp = opts.timestamp ?? "2026-11-02T10:00:00Z";
  const key = Buffer.from(opts.secretB64 ?? WEBHOOK_SECRET_B64, "base64");
  const signature = createHmac("sha256", key).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  return { headers: new Headers({ "x-sfpy-signature": `sha256=${signature}`, "x-sfpy-timestamp": timestamp }), rawBody };
}

async function applyWebhook(provider: PaymentProvider, wh: { headers: Headers; rawBody: string }) {
  const event = provider.verifyWebhook(wh.headers, wh.rawBody);
  const target = provider.mapEventToStatus(event);
  if (target === "IGNORE") return "IGNORED_TYPE" as const;
  return database.transaction(() => service.applyPaymentEvent(database, { provider, event, target })).immediate();
}

async function seedCart(couponCode: string | null): Promise<string> {
  const token = randomUUID();
  const cartId = randomUUID();
  await database.prepare("INSERT INTO carts (id, token_hash, coupon_code) VALUES (?, ?, ?)").run(cartId, hashToken(token), couponCode);
  await database.prepare("INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES (?, 1, 1)").run(cartId);
  return token;
}

async function beginOne(opts: { couponCode?: string | null; email?: string } = {}): Promise<{ reference: string; tracker: string; orderId: string }> {
  const couponCode = opts.couponCode ?? null;
  const email = opts.email ?? `buyer-${randomUUID()}@example.com`;
  const cartToken = await seedCart(couponCode);
  const tracker = `trk-${randomUUID()}`;
  const { result } = await service.beginOnlineCheckout(makeInput({ couponCode, email }), cartToken, randomUUID(), beginProvider(tracker));
  const row = await database.prepare("SELECT id FROM orders WHERE reference = ?").get<{ id: string }>(result.reference);
  return { reference: result.reference, tracker, orderId: row?.id ?? "" };
}

const variantStock = () => database.prepare("SELECT stock FROM variants WHERE id = 1").get<{ stock: number }>();

beforeAll(async () => {
  ({ database } = await import("../src/db"));
  ({ hashToken } = await import("../src/lib/security"));
  service = await import("../src/server/payments/service");
  ({ createSafepayProvider } = await import("../src/server/payments/safepay"));
  await database.prepare("INSERT INTO settings (id, hero_title) VALUES (1, 'Hero')").run();
  await database.prepare("INSERT INTO products (slug, title, description, status) VALUES ('p1', 'Product 1', 'Desc', 'PUBLISHED')").run();
  await database.prepare("INSERT INTO variants (product_id, title, sku, price_pkr, stock) VALUES (1, 'V1', 'SKU1', 2500, 200)").run();
  await database.prepare("INSERT INTO coupons (code, type, value, per_contact_limit) VALUES ('SAVE10', 'PERCENT', 10, 1)").run();
});

afterAll(async () => {
  try {
    await database.close();
  } catch {
    // ignore
  }
  try {
    rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    // ignore
  }
});

describe("beginOnlineCheckout + applyPaymentEvent (local SQLite)", () => {
  it("persists an UNPAID order and a PENDING payment at the server total in PKR (AC12)", async () => {
    const tracker = `trk-${randomUUID()}`;
    const { result } = await service.beginOnlineCheckout(makeInput(), await seedCart(null), randomUUID(), beginProvider(tracker));
    expect(result.source).toBe("STOREFRONT_ONLINE");
    expect(result.totalPkr).toBe(2500);
    expect(result.redirectTo).toContain(tracker);
    const order = await database.prepare("SELECT payment_status AS paymentStatus, source, order_status AS orderStatus, stock_allocated AS allocated FROM orders WHERE reference = ?").get<{ paymentStatus: string; source: string; orderStatus: string; allocated: number }>(result.reference);
    expect(order).toMatchObject({ paymentStatus: "UNPAID", source: "STOREFRONT_ONLINE", orderStatus: "PENDING_CONFIRMATION", allocated: 1 });
    const payment = await database.prepare("SELECT status, amount, currency, provider_reference AS providerReference, event_id AS eventId FROM payments WHERE provider_reference = ?").get<{ status: string; amount: number; currency: string; providerReference: string; eventId: string | null }>(tracker);
    expect(payment).toMatchObject({ status: "PENDING", amount: 2500, currency: "PKR", providerReference: tracker, eventId: null });
  });

  it("a valid signed success webhook moves PENDING->PAID with history (AC14) and replays idempotently (AC15)", async () => {
    const { reference, tracker } = await beginOne();
    const provider = createSafepayProvider(process.env);
    const wh = signedWebhook({ identifier: "evt-success-1", webhook_event_type: "payment.completed", subject: { payment: { tracker, amount: 250000, currency: "PKR" } } });
    expect(await applyWebhook(provider, wh)).toBe("APPLIED");
    const order = await database.prepare("SELECT payment_status AS paymentStatus FROM orders WHERE reference = ?").get<{ paymentStatus: string }>(reference);
    expect(order?.paymentStatus).toBe("PAID");
    const payment = await database.prepare("SELECT status, event_id AS eventId FROM payments WHERE provider_reference = ?").get<{ status: string; eventId: string }>(tracker);
    expect(payment).toMatchObject({ status: "PAID", eventId: "evt-success-1" });
    const captured = await database.prepare("SELECT COUNT(*) AS count FROM order_history oh JOIN orders o ON o.id = oh.order_id WHERE o.reference = ? AND oh.event = 'PAYMENT_CAPTURED'").get<{ count: number }>(reference);
    expect(captured?.count).toBe(1);
    // Replay the identical event id → no-op, still success.
    expect(await applyWebhook(provider, wh)).toBe("DEDUPE");
    const capturedAfter = await database.prepare("SELECT COUNT(*) AS count FROM order_history oh JOIN orders o ON o.id = oh.order_id WHERE o.reference = ? AND oh.event = 'PAYMENT_CAPTURED'").get<{ count: number }>(reference);
    expect(capturedAfter?.count).toBe(1);
  });

  it("an invalid signature is rejected and makes no state change (AC13)", async () => {
    const { tracker } = await beginOne();
    const provider = createSafepayProvider(process.env);
    const wh = signedWebhook({ identifier: "evt-badsig", webhook_event_type: "payment.completed", subject: { payment: { tracker, amount: 250000, currency: "PKR" } } }, { secretB64: Buffer.from("WRONG-SECRET").toString("base64") });
    expect(() => provider.verifyWebhook(wh.headers, wh.rawBody)).toThrow();
    const payment = await database.prepare("SELECT status FROM payments WHERE provider_reference = ?").get<{ status: string }>(tracker);
    expect(payment?.status).toBe("PENDING");
  });

  it("a failed webhook releases stock and reclaims the coupon (AC16), and the coupon re-applies on retry", async () => {
    const before = await variantStock();
    const first = await beginOne({ couponCode: "SAVE10", email: "reclaim@example.com" });
    expect((await database.prepare("SELECT COUNT(*) AS count FROM coupon_redemptions WHERE order_id = ?").get<{ count: number }>(first.orderId))?.count).toBe(1);
    expect((await variantStock())?.stock).toBe((before?.stock ?? 0) - 1);
    const provider = createSafepayProvider(process.env);
    const wh = signedWebhook({ identifier: "evt-fail-1", webhook_event_type: "payment.failed", subject: { payment: { tracker: first.tracker } } });
    expect(await applyWebhook(provider, wh)).toBe("APPLIED");
    const payment = await database.prepare("SELECT status FROM payments WHERE provider_reference = ?").get<{ status: string }>(first.tracker);
    expect(payment?.status).toBe("FAILED");
    const order = await database.prepare("SELECT payment_status AS paymentStatus, order_status AS orderStatus FROM orders WHERE reference = ?").get<{ paymentStatus: string; orderStatus: string }>(first.reference);
    expect(order).toMatchObject({ paymentStatus: "UNPAID", orderStatus: "CANCELLED" });
    expect((await variantStock())?.stock).toBe(before?.stock ?? 0); // reservation released
    expect((await database.prepare("SELECT COUNT(*) AS count FROM coupon_redemptions WHERE order_id = ?").get<{ count: number }>(first.orderId))?.count).toBe(0);
    // A fresh checkout with the SAME limited coupon + contact now succeeds.
    const retry = await beginOne({ couponCode: "SAVE10", email: "reclaim@example.com" });
    expect((await database.prepare("SELECT COUNT(*) AS count FROM coupon_redemptions WHERE order_id = ?").get<{ count: number }>(retry.orderId))?.count).toBe(1);
  });

  it("rejects a capture whose amount does not reconcile and does not mark PAID (AC18)", async () => {
    const { reference, tracker } = await beginOne();
    const provider = createSafepayProvider(process.env);
    const wh = signedWebhook({ identifier: "evt-mismatch-1", webhook_event_type: "payment.completed", subject: { payment: { tracker, amount: 999999, currency: "PKR" } } });
    expect(await applyWebhook(provider, wh)).toBe("AMOUNT_MISMATCH");
    expect((await database.prepare("SELECT payment_status AS paymentStatus FROM orders WHERE reference = ?").get<{ paymentStatus: string }>(reference))?.paymentStatus).toBe("UNPAID");
    expect((await database.prepare("SELECT status FROM payments WHERE provider_reference = ?").get<{ status: string }>(tracker))?.status).toBe("PENDING");
  });

  it("correlates by merchant reference when the tracker is absent, and signals retry when unmatched", async () => {
    const { reference } = await beginOne();
    const provider = createSafepayProvider(process.env);
    const matched = await applyWebhook(provider, signedWebhook({ identifier: "evt-merch-1", webhook_event_type: "payment.completed", subject: { payment: { reference, amount: 250000, currency: "PKR" } } }));
    expect(matched).toBe("APPLIED");
    expect((await database.prepare("SELECT payment_status AS paymentStatus FROM orders WHERE reference = ?").get<{ paymentStatus: string }>(reference))?.paymentStatus).toBe("PAID");
    const unmatched = await applyWebhook(provider, signedWebhook({ identifier: "evt-unmatched", webhook_event_type: "payment.completed", subject: { payment: { tracker: "does-not-exist", amount: 250000, currency: "PKR" } } }));
    expect(unmatched).toBe("UNMATCHED");
  });
});

describe("releaseExpiredOnlinePayments — stale-pending sweep (§6.1)", () => {
  it("reclaims an expired hold (payment + order + coupon) and leaves a fresh hold untouched", async () => {
    const before = await variantStock();
    const stale = await beginOne({ couponCode: "SAVE10", email: "stale@example.com" });
    const fresh = await beginOne();
    // Age only the stale hold past the TTL.
    await database.prepare("UPDATE payments SET created_at = ? WHERE provider_reference = ?").run(Date.now() - service.ONLINE_PENDING_TTL_MS - 60_000, stale.tracker);
    const released = await service.releaseExpiredOnlinePayments(database, { now: Date.now(), ttlMs: service.ONLINE_PENDING_TTL_MS, limit: 10 });
    expect(released).toBe(1);
    expect((await database.prepare("SELECT status FROM payments WHERE provider_reference = ?").get<{ status: string }>(stale.tracker))?.status).toBe("CANCELLED");
    expect(await database.prepare("SELECT order_status AS orderStatus, payment_status AS paymentStatus FROM orders WHERE reference = ?").get<{ orderStatus: string; paymentStatus: string }>(stale.reference)).toMatchObject({ orderStatus: "CANCELLED", paymentStatus: "UNPAID" });
    expect((await database.prepare("SELECT COUNT(*) AS count FROM coupon_redemptions WHERE order_id = ?").get<{ count: number }>(stale.orderId))?.count).toBe(0);
    expect((await database.prepare("SELECT status FROM payments WHERE provider_reference = ?").get<{ status: string }>(fresh.tracker))?.status).toBe("PENDING");
    // stale stock released, fresh still reserved → net: before - 1 (fresh only).
    expect((await variantStock())?.stock).toBe((before?.stock ?? 0) - 1);
  });

  it("does not clobber an order an admin already advanced past PENDING_CONFIRMATION (MEDIUM 4)", async () => {
    const adv = await beginOne();
    await database.prepare("UPDATE orders SET order_status = 'CONFIRMED' WHERE reference = ?").run(adv.reference);
    await database.prepare("UPDATE payments SET created_at = ? WHERE provider_reference = ?").run(Date.now() - service.ONLINE_PENDING_TTL_MS - 60_000, adv.tracker);
    const released = await service.releaseExpiredOnlinePayments(database, { now: Date.now(), ttlMs: service.ONLINE_PENDING_TTL_MS, limit: 10 });
    expect(released).toBe(1); // the payment row is terminalised...
    expect((await database.prepare("SELECT status FROM payments WHERE provider_reference = ?").get<{ status: string }>(adv.tracker))?.status).toBe("CANCELLED");
    // ...but the advanced order and its committed stock are left intact.
    expect((await database.prepare("SELECT order_status AS orderStatus FROM orders WHERE reference = ?").get<{ orderStatus: string }>(adv.reference))?.orderStatus).toBe("CONFIRMED");
    expect((await database.prepare("SELECT stock_released AS released FROM orders WHERE reference = ?").get<{ released: number }>(adv.reference))?.released).toBe(0);
  });
});
