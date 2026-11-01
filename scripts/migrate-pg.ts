import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error("MIGRATION_DATABASE_URL is required for PostgreSQL migrations.");
const parsedUrl = new URL(url);
if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol) || parsedUrl.port !== "5432") throw new Error("MIGRATION_DATABASE_URL must use the PostgreSQL session-pooler port 5432.");
const schema = process.env.DATABASE_SCHEMA?.trim() || "public";
if (!/^[a-z][a-z0-9_]{0,62}$/i.test(schema)) throw new Error("DATABASE_SCHEMA must be a simple PostgreSQL identifier.");

const sql = postgres(url, { ssl: "require", prepare: false, max: 1, connect_timeout: 15, idle_timeout: 10, onnotice: () => undefined });
const quotedSchema = `"${schema}"`;
try {
  if (schema !== "public") {
    if (process.env.PG_CREATE_SCHEMA !== "1") throw new Error("PG_CREATE_SCHEMA=1 is required to create a non-public migration schema.");
    await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS ${quotedSchema}`);
  }
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS ${quotedSchema}."__shaffaq_migrations" (name text PRIMARY KEY, sha256 text NOT NULL, applied_at bigint NOT NULL)`);
  await sql`SELECT pg_advisory_lock(hashtextextended(${`shaffaq:migrate:${schema}`}, 0))`;
  try {
    const directory = resolve(process.cwd(), "drizzle-pg");
    const files = (await readdir(directory)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
    for (const name of files) {
      const contents = await readFile(resolve(directory, name), "utf8");
      const sha256 = createHash("sha256").update(contents).digest("hex");
      const existing = await sql.unsafe(`SELECT sha256 FROM ${quotedSchema}."__shaffaq_migrations" WHERE name = $1`, [name]);
      if (existing.length) {
        if (existing[0].sha256 !== sha256) throw new Error(`Applied PostgreSQL migration was modified: ${name}`);
        continue;
      }
      const statements = contents.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
      await sql.begin(async (transaction) => {
        await transaction.unsafe(`SET LOCAL search_path TO ${quotedSchema}, public`);
        for (const statement of statements) await transaction.unsafe(statement);
        await transaction.unsafe(`INSERT INTO ${quotedSchema}."__shaffaq_migrations" (name, sha256, applied_at) VALUES ($1, $2, $3)`, [name, sha256, Date.now()]);
      });
    }
    console.log(`PostgreSQL migrations applied to schema ${schema}; ${files.length} forward migration files verified.`);
  } finally {
    await sql`SELECT pg_advisory_unlock(hashtextextended(${`shaffaq:migrate:${schema}`}, 0))`;
  }
} finally {
  await sql.end({ timeout: 5 });
}
