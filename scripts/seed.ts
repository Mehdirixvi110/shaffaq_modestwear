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
  console.log(`SQLite seed complete. ${result.assets} supplied assets were verified and copied without modifying originals.`);
} finally {
  await database.close();
}
