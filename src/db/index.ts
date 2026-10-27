import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

const databasePath = resolve(process.cwd(), process.env.SQLITE_PATH ?? ".data/db/shaffaq.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

type DatabaseGlobal = typeof globalThis & {
  __shaffaqSqlite?: Database.Database;
};

const globalDatabase = globalThis as DatabaseGlobal;
export const sqlite = globalDatabase.__shaffaqSqlite ?? new Database(databasePath);

sqlite.pragma("foreign_keys = ON");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("synchronous = NORMAL");
sqlite.defaultSafeIntegers(false);

if (process.env.NODE_ENV !== "production") {
  globalDatabase.__shaffaqSqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });
export type ShaffaqDatabase = typeof db;
