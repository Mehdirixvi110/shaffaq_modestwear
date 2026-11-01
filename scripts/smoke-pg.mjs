import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import postgres from "postgres";

if (!existsSync(".next/BUILD_ID")) throw new Error("Build not found. Run npm run build before npm run smoke:pg.");
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
const runtimeUrl = process.env.DATABASE_URL;
if (!migrationUrl || !runtimeUrl) throw new Error("MIGRATION_DATABASE_URL and DATABASE_URL are required for hosted smoke.");
const suffix = randomBytes(8).toString("hex");
const schema = `shaffaq_smoke_${suffix}`;
const port = Number(process.env.PG_SMOKE_PORT ?? "3200");
const baseURL = `http://localhost:${port}`;
const adminEmail = `smoke-${suffix}@example.test`;
const adminPassword = `Smoke-${randomBytes(20).toString("base64url")}Aa1!`;
const env = {
  ...process.env,
  NODE_ENV: "production",
  VERCEL: "0",
  SHAFFAQ_ALLOW_HTTP_LOOPBACK: "1",
  APP_ORIGIN: baseURL,
  NEXT_PUBLIC_APP_ORIGIN: baseURL,
  DATABASE_PROVIDER: "postgres",
  MEDIA_PROVIDER: "supabase",
  DATABASE_SCHEMA: schema,
  PG_CREATE_SCHEMA: "1",
  DATABASE_POOL_MAX: "2",
  DATABASE_DEBUG: process.env.PG_SMOKE_DEBUG ?? "0",
  ADMIN_EMAIL: adminEmail,
  ADMIN_INITIAL_PASSWORD: adminPassword,
  SMOKE_BASE_URL: baseURL,
  SMOKE_ADMIN_EMAIL: adminEmail,
  SMOKE_ADMIN_PASSWORD: adminPassword,
  SMOKE_WHATSAPP_NUMBER: "923233367659",
  SMOKE_HOSTED: "1",
};

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env, stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${args.at(-1) ?? command} exited with ${code}.`)));
  });
}

async function waitForReady() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseURL}/api/health/ready`);
      if (response.ok) {
        const status = await response.json();
        if (status.database !== "postgres") throw new Error("Hosted smoke server did not select PostgreSQL.");
        console.log("Hosted smoke readiness selected PostgreSQL.");
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Hosted smoke server did not become ready.");
}

let server;
try {
  await run(process.execPath, ["--import", "tsx", "scripts/migrate-pg.ts"]);
  await run(process.execPath, ["--import", "tsx", "scripts/seed-pg.ts"]);
  await run(process.execPath, ["--import", "tsx", "scripts/bootstrap-admin-pg.ts"]);
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), env, stdio: "inherit", shell: false });
  await waitForReady();
  console.log("Hosted smoke fetching homepage.");
  const homepageResponse = await fetch(baseURL, { signal: AbortSignal.timeout(60_000) });
  if (!homepageResponse.ok) throw new Error(`Hosted smoke homepage returned ${homepageResponse.status}.`);
  await homepageResponse.text();
  console.log("Hosted smoke starting browser workflow.");
  await run(process.execPath, ["scripts/browser-smoke.mjs"]);
  console.log("Hosted PostgreSQL/Supabase browser smoke completed with process-only administrator credentials.");
} finally {
  if (server && server.exitCode === null) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill();
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5_000))]);
  }
  let cleanupError;
  try { await run(process.execPath, ["--import", "tsx", "scripts/cleanup-pg-smoke.ts"]); } catch (error) { cleanupError = error; }
  const sql = postgres(migrationUrl, { ssl: "require", prepare: false, max: 1, connect_timeout: 15, onnotice: () => undefined });
  try {
    if (!/^shaffaq_smoke_[a-f0-9]{16}$/.test(schema)) throw new Error("Refusing to drop an unexpected schema name.");
    await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    console.log("Hosted smoke PostgreSQL schema dropped.");
  } finally {
    await sql.end({ timeout: 5 });
  }
  if (cleanupError) throw cleanupError;
}
