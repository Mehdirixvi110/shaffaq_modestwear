import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db, sqlite } from "../src/db";

migrate(db, { migrationsFolder: "drizzle" });
const result = sqlite.pragma("integrity_check", { simple: true });
if (result !== "ok") {
  throw new Error("SQLite integrity check failed after migration.");
}
console.log("Database migrations applied; integrity check passed.");
