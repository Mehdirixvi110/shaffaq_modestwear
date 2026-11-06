import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildManualAccountSnapshot, manualPaymentAvailable, parseManualAccountSnapshot } from "../src/lib/payments/manual";
import type { CheckoutInput } from "../src/lib/validation";

// Bind the @/db singleton to a throwaway local SQLite DB BEFORE any app module
// loads. No live DB and no network are touched.
const tempDir = mkdtempSync(join(tmpdir(), "shaffaq-manual-"));
const dbPath = join(tempDir, "test.sqlite");
Object.assign(process.env, {
  DATABASE_PROVIDER: "sqlite",
  MEDIA_PROVIDER: "local",
  APP_ORIGIN: "http://localhost:3000",
  NEXT_PUBLIC_APP_ORIGIN: "http://localhost:3000",
  SQLITE_PATH: dbPath,
  MEDIA_ROOT: join(tempDir, "media"),
  SESSION_SECRET: "s".repeat(48),
  CSRF_SECRET: "c".repeat(48),
});

{
  const sqlite = new Database(dbPath);
  sqlite.pragma("foreign_keys = ON");
  migrate(drizzle(sqlite), { migrationsFolder: "drizzle" });
  sqlite.close();
}

let database: (typeof import("../src/db"))["database"];
let hashToken: (typeof import("../src/lib/security"))["hashToken"];
let manual: typeof import("../src/server/payments/manual");

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

async function seedCart(couponCode: string | null = null): Promise<string> {
  const token = randomUUID();
  const cartId = randomUUID();
  await database.prepare("INSERT INTO carts (id, token_hash, coupon_code) VALUES (?, ?, ?)").run(cartId, hashToken(token), couponCode);
  await database.prepare("INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES (?, 1, 1)").run(cartId);
  return token;
}

async function beginOne(overrides: { email?: string } = {}): Promise<{ reference: string; orderId: string }> {
  const email = overrides.email ?? `buyer-${randomUUID()}@example.com`;
  const cartToken = await seedCart(null);
  const { result } = await manual.beginManualCheckout(makeInput({ email }), cartToken, randomUUID());
  const row = await database.prepare("SELECT id FROM orders WHERE reference = ?").get<{ id: string }>(result.reference);
  return { reference: result.reference, orderId: row?.id ?? "" };
}

const variantStock = () => database.prepare("SELECT stock FROM variants WHERE id = 1").get<{ stock: number }>();

beforeAll(async () => {
  ({ database } = await import("../src/db"));
  ({ hashToken } = await import("../src/lib/security"));
  manual = await import("../src/server/payments/manual");
  await database.prepare("INSERT INTO settings (id, hero_title, manual_payment_enabled, manual_bank_name, manual_account_title, manual_account_number, manual_iban, manual_payment_instructions) VALUES (1, 'Hero', 1, 'Test Bank', 'SHAFFAQ Modestwear', '1234567890', 'PK00TEST0000000000000000', 'Transfer the total then upload your screenshot.')").run();
  await database.prepare("INSERT INTO products (slug, title, description, status) VALUES ('p1', 'Product 1', 'Desc', 'PUBLISHED')").run();
  await database.prepare("INSERT INTO variants (product_id, title, sku, price_pkr, stock) VALUES (1, 'V1', 'SKU1', 2500, 200)").run();
});

afterAll(async () => {
  try { await database.close(); } catch { /* ignore */ }
  try { rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 }); } catch { /* ignore */ }
});

describe("manualPaymentAvailable / buildManualAccountSnapshot (pure)", () => {
  const base = { manualPaymentEnabled: 1, manualBankName: null, manualAccountTitle: null, manualAccountNumber: null, manualIban: null, manualEasypaisaNumber: null, manualJazzcashNumber: null, manualPaymentInstructions: null };

  it("is false when disabled even if account details exist", () => {
    expect(manualPaymentAvailable({ ...base, manualPaymentEnabled: 0, manualBankName: "Bank", manualAccountNumber: "123" })).toBe(false);
  });

  it("is false when enabled but only a title / instructions are set (no payable identifier)", () => {
    expect(manualPaymentAvailable({ ...base, manualAccountTitle: "Title only", manualPaymentInstructions: "Pay us" })).toBe(false);
  });

  it("is true when enabled with at least one payable identifier", () => {
    expect(manualPaymentAvailable({ ...base, manualEasypaisaNumber: "03001234567" })).toBe(true);
    expect(manualPaymentAvailable({ ...base, manualBankName: "Bank", manualAccountNumber: "123" })).toBe(true);
  });

  it("snapshots only configured fields, trimmed", () => {
    const snap = buildManualAccountSnapshot({ ...base, manualBankName: "  Test Bank  ", manualAccountNumber: "123", manualPaymentInstructions: "Upload proof" });
    expect(snap).toEqual({ bankName: "Test Bank", accountNumber: "123", instructions: "Upload proof" });
    expect(snap.iban).toBeUndefined();
  });

  it("round-trips through parseManualAccountSnapshot and tolerates bad input", () => {
    const snap = buildManualAccountSnapshot({ ...base, manualBankName: "Bank", manualIban: "PK00" });
    expect(parseManualAccountSnapshot(JSON.stringify(snap))).toEqual({ bankName: "Bank", iban: "PK00" });
    expect(parseManualAccountSnapshot(null)).toEqual({});
    expect(parseManualAccountSnapshot("not json")).toEqual({});
  });
});

describe("beginManualCheckout (local SQLite)", () => {
  it("persists a STOREFRONT_MANUAL / PENDING_CONFIRMATION / UNPAID order, allocates stock, and a PENDING MANUAL payment with a non-null account snapshot", async () => {
    const before = await variantStock();
    const cartToken = await seedCart(null);
    const { result } = await manual.beginManualCheckout(makeInput({ email: `a-${randomUUID()}@x.com` }), cartToken, randomUUID());
    expect(result.source).toBe("STOREFRONT_MANUAL");
    expect(result.totalPkr).toBe(2500);
    expect(result.redirectTo).toContain("payment=manual");
    const order = await database.prepare("SELECT id, payment_status AS paymentStatus, source, order_status AS orderStatus, stock_allocated AS allocated FROM orders WHERE reference = ?").get<{ id: string; paymentStatus: string; source: string; orderStatus: string; allocated: number }>(result.reference);
    expect(order).toMatchObject({ paymentStatus: "UNPAID", source: "STOREFRONT_MANUAL", orderStatus: "PENDING_CONFIRMATION", allocated: 1 });
    const payment = await database.prepare("SELECT status, provider, amount, currency, account_snapshot AS accountSnapshot FROM payments WHERE order_id = ?").get<{ status: string; provider: string; amount: number; currency: string; accountSnapshot: string | null }>(order!.id);
    expect(payment).toMatchObject({ status: "PENDING", provider: "MANUAL", amount: 2500, currency: "PKR" });
    expect(parseManualAccountSnapshot(payment!.accountSnapshot)).toMatchObject({ bankName: "Test Bank", accountNumber: "1234567890" });
    expect(await database.prepare("SELECT id FROM carts WHERE token_hash = ?").get(hashToken(cartToken))).toBeUndefined();
    expect((await variantStock())?.stock).toBe((before?.stock ?? 0) - 1);
  });

  it("replays a same-key resubmit without creating a duplicate order", async () => {
    const cartToken = await seedCart(null);
    const subject = randomUUID();
    const input = makeInput({ email: `replay-${randomUUID()}@x.com` });
    const first = await manual.beginManualCheckout(input, cartToken, subject);
    const second = await manual.beginManualCheckout(input, cartToken, subject);
    expect(second.result.reference).toBe(first.result.reference);
    expect((await database.prepare("SELECT COUNT(*) AS count FROM orders WHERE reference = ?").get<{ count: number }>(first.result.reference))?.count).toBe(1);
  });

  it("refuses a forged request server-side when manual payment is unavailable", async () => {
    await database.prepare("UPDATE settings SET manual_payment_enabled = 0 WHERE id = 1").run();
    const cartToken = await seedCart(null);
    await expect(manual.beginManualCheckout(makeInput({ email: `off-${randomUUID()}@x.com` }), cartToken, randomUUID())).rejects.toMatchObject({ status: 404, code: "PAYMENT_PROVIDER_UNAVAILABLE" });
    await database.prepare("UPDATE settings SET manual_payment_enabled = 1 WHERE id = 1").run();
  });
});

describe("recordPaymentProof + getManualPaymentView (local SQLite)", () => {
  it("links a proof and leaves the order UNPAID / payment PENDING; the view returns the snapshot and proofs", async () => {
    const { reference, orderId } = await beginOne();
    const mediaInsert = await database.prepare("INSERT INTO media_files (display_name, storage_key, public_path, mime, bytes, width, height, sha256, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)")
      .run(`Payment proof ${reference}`, `${randomUUID()}.jpg`, `/uploads/${randomUUID()}.jpg`, "image/jpeg", 50000, 800, 600, "a".repeat(64));
    const mediaFileId = Number(mediaInsert.lastInsertRowid);
    await database.transaction(async () => { await manual.recordPaymentProof(database, { orderId, mediaFileId }); }).immediate();

    expect((await database.prepare("SELECT COUNT(*) AS count FROM payment_proofs WHERE order_id = ? AND media_file_id = ?").get<{ count: number }>(orderId, mediaFileId))?.count).toBe(1);
    expect((await database.prepare("SELECT payment_status AS paymentStatus FROM orders WHERE id = ?").get<{ paymentStatus: string }>(orderId))?.paymentStatus).toBe("UNPAID");
    expect((await database.prepare("SELECT status FROM payments WHERE order_id = ? AND provider = 'MANUAL'").get<{ status: string }>(orderId))?.status).toBe("PENDING");
    expect((await database.prepare("SELECT COUNT(*) AS count FROM order_history WHERE order_id = ? AND event = 'PAYMENT_PROOF_UPLOADED'").get<{ count: number }>(orderId))?.count).toBe(1);

    const view = await manual.getManualPaymentView(orderId);
    expect(view.payment?.status).toBe("PENDING");
    expect(parseManualAccountSnapshot(view.payment?.accountSnapshot)).toMatchObject({ bankName: "Test Bank" });
    expect(view.proofs.length).toBe(1);
    expect(view.proofs[0]).toMatchObject({ mime: "image/jpeg", width: 800, height: 600 });
  });
});

describe("markManualPaymentPaid — admin verification (local SQLite)", () => {
  it("marks BOTH the MANUAL payment and the order PAID, and is write-once", async () => {
    const { orderId } = await beginOne();
    const version = (await database.prepare("SELECT version FROM orders WHERE id = ?").get<{ version: number }>(orderId))!.version;
    // Mirror the admin route: guarded payment transition + version-checked order update, one transaction.
    const changed = await database.transaction(async () => {
      const count = await manual.markManualPaymentPaid(database, orderId);
      await database.prepare("UPDATE orders SET payment_status = 'PAID', version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND version = ?").run(orderId, version);
      return count;
    }).immediate();
    expect(changed).toBe(1);
    expect((await database.prepare("SELECT status FROM payments WHERE order_id = ? AND provider = 'MANUAL'").get<{ status: string }>(orderId))?.status).toBe("PAID");
    expect((await database.prepare("SELECT payment_status AS paymentStatus, version FROM orders WHERE id = ?").get<{ paymentStatus: string; version: number }>(orderId))).toMatchObject({ paymentStatus: "PAID", version: version + 1 });
    // Write-once: a second verification changes nothing.
    expect(await manual.markManualPaymentPaid(database, orderId)).toBe(0);
  });

  it("a proof rejection leaves the payment PENDING and the order UNPAID", async () => {
    const { orderId } = await beginOne();
    await database.prepare("UPDATE payments SET last_event = 'PROOF_REJECTED', updated_at = unixepoch() * 1000 WHERE order_id = ? AND provider = 'MANUAL' AND status = 'PENDING'").run(orderId);
    expect(await database.prepare("SELECT status, last_event AS lastEvent FROM payments WHERE order_id = ? AND provider = 'MANUAL'").get<{ status: string; lastEvent: string }>(orderId)).toMatchObject({ status: "PENDING", lastEvent: "PROOF_REJECTED" });
    expect((await database.prepare("SELECT payment_status AS paymentStatus FROM orders WHERE id = ?").get<{ paymentStatus: string }>(orderId))?.paymentStatus).toBe("UNPAID");
  });
});
