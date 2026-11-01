import { createDatabaseConnection } from "../src/db/provider";
import { seedDatabase, verifySeedAssets } from "./seed-shared";

verifySeedAssets(true);
const database = createDatabaseConnection({ provider: "sqlite" });
try {
  const result = await seedDatabase(database, { enforceBusinessSettings: false });
  console.log(`SQLite seed complete. ${result.assets} supplied assets were verified and copied without modifying originals.`);
} finally {
  await database.close();
}
