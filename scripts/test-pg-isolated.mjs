import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import postgres from "postgres";

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
const runtimeUrl = process.env.DATABASE_URL;
if (!migrationUrl || !runtimeUrl) throw new Error("MIGRATION_DATABASE_URL and DATABASE_URL are required for isolated PostgreSQL verification.");
const schema = `shaffaq_verify_${randomBytes(8).toString("hex")}`;
const env = {
  ...process.env,
  DATABASE_PROVIDER: "postgres",
  MEDIA_PROVIDER: "supabase",
  DATABASE_SCHEMA: schema,
  PG_CREATE_SCHEMA: "1",
  NODE_ENV: "development",
};

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", script], { cwd: process.cwd(), env, stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${script} exited with ${code}.`)));
  });
}

try {
  await run("scripts/migrate-pg.ts");
  await run("scripts/seed-pg.ts");
  await run("scripts/verify-pg.ts");
} finally {
  const sql = postgres(migrationUrl, { ssl: "require", prepare: false, max: 1, connect_timeout: 15, onnotice: () => undefined });
  try {
    if (!/^shaffaq_verify_[a-f0-9]{16}$/.test(schema)) throw new Error("Refusing to drop an unexpected schema name.");
    await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    console.log("Isolated PostgreSQL verification schema dropped.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}
