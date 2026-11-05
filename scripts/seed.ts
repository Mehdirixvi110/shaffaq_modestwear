import { createDatabaseConnection } from "../src/db/provider";
import { seedDatabase, verifySeedAssets } from "./seed-shared";

verifySeedAssets(true);
const database = createDatabaseConnection({ provider: "sqlite" });
try {
  const result = await seedDatabase(database, { enforceBusinessSettings: false });
  // Local-only demo reviews for rendering checks. These are deliberately NOT added to
  // scripts/seed-shared.ts and are never seeded to Postgres. Fixed UUID literals keep the
  // INSERT OR IGNORE idempotent across repeated local seeds.
  const sampleProduct = await database.prepare("SELECT id FROM products WHERE slug = ?").get<{ id: number }>("sample-look-01-espresso");
  await database.prepare(`INSERT OR IGNORE INTO reviews (id, product_id, customer_name, source, city, rating, title, body, status, featured)
    VALUES (?, ?, ?, 'ADMIN', ?, ?, ?, ?, 'APPROVED', 1)`)
    .run("00000000-0000-4000-8000-0000000d0001", sampleProduct?.id ?? null, "Demo Reviewer (local sample)", "Lahore", 5, "Local sample review", "Local-only curated sample linked to a product, used to verify homepage and product-page rendering.");
  await database.prepare(`INSERT OR IGNORE INTO reviews (id, product_id, customer_name, source, city, rating, title, body, status, featured)
    VALUES (?, NULL, ?, 'ADMIN', ?, ?, ?, ?, 'APPROVED', 1)`)
    .run("00000000-0000-4000-8000-0000000d0002", "Demo Reviewer (local sample)", "Karachi", 5, "Local sample review", "Local-only curated sample with no linked product, used to verify the homepage featured-reviews block.");
  // Local-only demo leads (never seeded to Postgres). Fixed UUID literals keep INSERT OR IGNORE idempotent.
  const sampleVariant = await database.prepare("SELECT sku FROM variants WHERE product_id = ? ORDER BY position, id LIMIT 1").get<{ sku: string }>(sampleProduct?.id ?? 0);
  await database.prepare(`INSERT OR IGNORE INTO leads (id, source, status, customer_name, phone, city, product_id, product_name_snapshot, selected_options, variant_sku, message)
    VALUES (?, 'PRODUCT_INQUIRY', 'NEW', ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run("00000000-0000-4000-8000-0000000e0001", "Ayesha (local sample)", "+923001234567", "Lahore", sampleProduct?.id ?? null, "Espresso Abaya (local sample)", JSON.stringify({ Size: "M", Colour: "Espresso" }), sampleVariant?.sku ?? "SAMPLE-SKU", "Local-only sample product inquiry, used to verify the leads capture path.");
  await database.prepare(`INSERT OR IGNORE INTO leads (id, source, status, customer_name, phone, city, product_id, product_name_snapshot, selected_options, variant_sku, message)
    VALUES (?, 'CONTACT', 'NEW', ?, ?, ?, NULL, NULL, NULL, NULL, ?)`)
    .run("00000000-0000-4000-8000-0000000e0002", "Hira (local sample)", "+923009876543", "Karachi", "Local-only sample contact request with no linked product.");
  console.log(`SQLite seed complete. ${result.assets} supplied assets were verified and copied without modifying originals.`);
} finally {
  await database.close();
}
