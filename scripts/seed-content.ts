// Safe content-only sync for an EXISTING PostgreSQL (Supabase) database.
//
// Refreshes the information pages that still hold the seed placeholder and ensures the
// starter blog posts exist — WITHOUT running the full seed, which would reconcile store
// settings and re-insert sample products. Idempotent and safe to re-run; it never touches
// products, settings, orders, customers, coupons, or administrators.
import { createDatabaseConnection } from "../src/db/provider";
import { seedEditorialContent } from "./content-data";

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error("MIGRATION_DATABASE_URL is required for the content sync.");
const database = createDatabaseConnection({ provider: "postgres", postgresUrl: url });
try {
  await database.transaction(async () => {
    await seedEditorialContent(database);
  }).immediate();
  console.log("Editorial content synced to PostgreSQL: information pages refreshed where still templated, and starter blog posts ensured. Products, settings, orders, and customers were untouched.");
} finally {
  await database.close();
}
