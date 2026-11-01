import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { sqlite, sqliteDb } from "../src/db/sqlite-native";

migrate(sqliteDb, { migrationsFolder: "drizzle" });
const result = sqlite.pragma("integrity_check", { simple: true });
if (result !== "ok") throw new Error("SQLite integrity check failed after migration.");
sqlite.close();
console.log("SQLite migrations applied; integrity check passed.");
