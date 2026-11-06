import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { manualProofActionable } from "../src/lib/payments/manual";

// Bind the @/db singleton to a throwaway local SQLite DB BEFORE any app module
// loads. No live DB and no network are touched (mirrors tests/payments-manual.test.ts).
const tempDir = mkdtempSync(join(tmpdir(), "shaffaq-proof-"));
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
let mediaStorage: typeof import("../src/server/media-storage");

// A minimal STOREFRONT_MANUAL order whose order_access_hash equals hashToken(token),
// so the capability check in getProofForViewer can be exercised with a known token.
async function seedManualOrder(accessToken: string): Promise<{ reference: string; orderId: string }> {
  const orderId = randomUUID();
  const reference = `SHQ-TEST-${randomUUID().slice(0, 6).toUpperCase()}`;
  await database.prepare(`INSERT INTO orders (id, reference, source, order_status, customer_name, email, phone, address_line1, city, subtotal_pkr, shipping_pkr, total_pkr, order_access_hash)
    VALUES (?, ?, 'STOREFRONT_MANUAL', 'PENDING_CONFIRMATION', 'Proof Buyer', 'proof@example.com', '+923001234567', '1 Test Street', 'Lahore', 2500, 0, 2500, ?)`)
    .run(orderId, reference, hashToken(accessToken));
  return { reference, orderId };
}

async function seedProof(orderId: string, reference: string): Promise<number> {
  const key = `proofs/${randomUUID()}.jpg`;
  const media = await database.prepare("INSERT INTO media_files (display_name, storage_key, public_path, mime, bytes, width, height, sha256, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)")
    .run(`Payment proof ${reference}`, key, `/private/${key}`, "image/jpeg", 50000, 800, 600, "b".repeat(64));
  const proof = await database.prepare("INSERT INTO payment_proofs (order_id, media_file_id) VALUES (?, ?)").run(orderId, Number(media.lastInsertRowid));
  return Number(proof.lastInsertRowid);
}

beforeAll(async () => {
  ({ database } = await import("../src/db"));
  ({ hashToken } = await import("../src/lib/security"));
  manual = await import("../src/server/payments/manual");
  mediaStorage = await import("../src/server/media-storage");
});

afterAll(async () => {
  try { await database.close(); } catch { /* ignore */ }
  try { rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 }); } catch { /* ignore */ }
});

describe("getProofForViewer — admin OR order-owner only (local SQLite)", () => {
  it("authorizes the order owner by capability token and an admin, and denies everyone else", async () => {
    const token = randomUUID();
    const { reference, orderId } = await seedManualOrder(token);
    const proofId = await seedProof(orderId, reference);

    // Owner: the capability token hashes to the stored order_access_hash.
    expect(await manual.getProofForViewer(reference, proofId, { isAdmin: false, rawAccessToken: token })).toMatchObject({ mime: "image/jpeg" });
    // Admin: authorized without any capability token.
    const asAdmin = await manual.getProofForViewer(reference, proofId, { isAdmin: true, rawAccessToken: undefined });
    expect(asAdmin).toMatchObject({ mime: "image/jpeg" });
    // The descriptor carries the private storage key, never a /uploads path.
    expect(asAdmin?.storageKey).toMatch(/^proofs\//);
    // A wrong token and no token are both denied.
    expect(await manual.getProofForViewer(reference, proofId, { isAdmin: false, rawAccessToken: "wrong-token" })).toBeNull();
    expect(await manual.getProofForViewer(reference, proofId, { isAdmin: false, rawAccessToken: undefined })).toBeNull();
  });

  it("returns null for an unknown proof id, a non-owning reference, or a non-positive id", async () => {
    const token = randomUUID();
    const { reference, orderId } = await seedManualOrder(token);
    const proofId = await seedProof(orderId, reference);
    const other = await seedManualOrder(randomUUID());

    expect(await manual.getProofForViewer(reference, proofId + 10_000, { isAdmin: true, rawAccessToken: undefined })).toBeNull();
    expect(await manual.getProofForViewer(other.reference, proofId, { isAdmin: true, rawAccessToken: undefined })).toBeNull();
    expect(await manual.getProofForViewer(reference, 0, { isAdmin: true, rawAccessToken: undefined })).toBeNull();
    expect(await manual.getProofForViewer(reference, -1, { isAdmin: true, rawAccessToken: undefined })).toBeNull();
    expect(await manual.getProofForViewer(reference, Number.NaN, { isAdmin: true, rawAccessToken: undefined })).toBeNull();
  });
});

describe("storeProofImage / readProofMedia — private, non-public local storage", () => {
  it("stores under a private proofs/ key (never /uploads), round-trips the bytes, and cleans up", async () => {
    const bytes = Buffer.from("fake-proof-image-bytes-\u0000\u0001\u0002");
    const stored = await mediaStorage.storeProofImage(bytes, "jpg", "image/jpeg");
    expect(stored.storageKey).toMatch(/^proofs\/[0-9a-f-]{36}\.jpg$/);
    expect(stored.publicPath.startsWith("/private/")).toBe(true);
    expect(stored.publicPath.startsWith("/uploads/")).toBe(false);
    expect(stored.provider).toBe("local");

    const read = await mediaStorage.readProofMedia(stored.storageKey);
    expect(read).not.toBeNull();
    expect(Buffer.compare(read!, bytes)).toBe(0);

    await mediaStorage.removeStoredMedia(stored);
    expect(await mediaStorage.readProofMedia(stored.storageKey)).toBeNull();
  });
});

describe("manualProofActionable — shared cancelled/eligibility guard (pure)", () => {
  it("is true only for an unpaid, non-cancelled storefront bank-transfer order", () => {
    expect(manualProofActionable({ source: "STOREFRONT_MANUAL", paymentStatus: "UNPAID", orderStatus: "PENDING_CONFIRMATION" })).toBe(true);
    expect(manualProofActionable({ source: "STOREFRONT_MANUAL", paymentStatus: "UNPAID", orderStatus: "CONFIRMED" })).toBe(true);
    expect(manualProofActionable({ source: "STOREFRONT_MANUAL", paymentStatus: "UNPAID", orderStatus: "CANCELLED" })).toBe(false);
    expect(manualProofActionable({ source: "STOREFRONT_MANUAL", paymentStatus: "PAID", orderStatus: "CONFIRMED" })).toBe(false);
    expect(manualProofActionable({ source: "STOREFRONT_COD", paymentStatus: "UNPAID", orderStatus: "PENDING_CONFIRMATION" })).toBe(false);
  });
});

describe("public /uploads lookup — never resolves a payment-proof media row", () => {
  // Mirrors the exact lookup in src/app/uploads/[filename]/route.ts: a media row that
  // backs a payment_proofs row is filtered out (so the route 404s) while ordinary
  // product media still resolves. Proof objects additionally use a proofs/ key prefix
  // the single-segment route regex cannot even address; this is defense-in-depth.
  const lookup = (storageKey: string) => database.prepare("SELECT storage_key AS storageKey, mime, sha256 FROM media_files WHERE storage_key = ? AND NOT EXISTS (SELECT 1 FROM payment_proofs pp WHERE pp.media_file_id = media_files.id)").get<{ storageKey: string }>(storageKey);

  it("filters a proof-linked media row but still resolves ordinary product media", async () => {
    const { orderId, reference } = await seedManualOrder(randomUUID());
    // A proof whose media row has a flat, publicly-shaped key — the guard must still hide it.
    const proofKey = `${randomUUID()}.jpg`;
    const proofMedia = await database.prepare("INSERT INTO media_files (display_name, storage_key, public_path, mime, bytes, width, height, sha256, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)")
      .run(`Payment proof ${reference}`, proofKey, `/uploads/${proofKey}`, "image/jpeg", 100, 10, 10, "c".repeat(64));
    await database.prepare("INSERT INTO payment_proofs (order_id, media_file_id) VALUES (?, ?)").run(orderId, Number(proofMedia.lastInsertRowid));

    const productKey = `${randomUUID()}.webp`;
    await database.prepare("INSERT INTO media_files (display_name, storage_key, public_path, mime, bytes, width, height, sha256, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)")
      .run("Product image", productKey, `/uploads/${productKey}`, "image/webp", 100, 10, 10, "d".repeat(64));

    expect(await lookup(proofKey)).toBeUndefined();
    expect((await lookup(productKey))?.storageKey).toBe(productKey);
  });
});
