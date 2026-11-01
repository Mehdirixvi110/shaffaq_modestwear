import { createDatabaseConnection } from "../src/db/provider";
import { seedDatabase, verifySeedAssets } from "./seed-shared";

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error("MIGRATION_DATABASE_URL is required for PostgreSQL seed.");
verifySeedAssets(false);
const database = createDatabaseConnection({ provider: "postgres", postgresUrl: url });
try {
  const result = await seedDatabase(database, { enforceBusinessSettings: true });
  console.log(`PostgreSQL seed complete: ${result.sampleProducts} labelled sample products and required store settings reconciled; no customers, orders, reviews, coupons, or administrators were created.`);
} finally {
  await database.close();
}
