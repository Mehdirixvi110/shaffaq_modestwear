import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { sqlite } from "../src/db/sqlite-native";

const directory = resolve(process.cwd(), ".data/backups");
mkdirSync(directory, { recursive: true });
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const destination = resolve(directory, `shaffaq-${stamp}.sqlite`);

await sqlite.backup(destination);
sqlite.close();
const backup = new Database(destination, { readonly: true });
const result = backup.pragma("integrity_check", { simple: true });
backup.close();
if (result !== "ok") throw new Error("Backup integrity check failed.");
console.log(`SQLite backup created and verified at ${destination}`);
