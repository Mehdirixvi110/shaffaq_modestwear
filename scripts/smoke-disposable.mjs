import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";

if (!existsSync(".next/BUILD_ID")) throw new Error("Build not found. Run npm run build before npm run smoke:browser.");
const suffix = randomBytes(8).toString("hex");
const root = resolve(process.cwd(), ".data", "smoke", suffix);
const databasePath = resolve(root, "shaffaq-smoke.sqlite");
const mediaRoot = resolve(root, "media");
mkdirSync(root, { recursive: true });
const port = Number(process.env.SMOKE_PORT ?? "3100");
const baseURL = `http://localhost:${port}`;
const adminEmail = `smoke-${suffix}@example.test`;
const adminPassword = `Smoke-${randomBytes(18).toString("base64url")}Aa1!`;
const env = {
  ...process.env,
  NODE_ENV: "production",
  VERCEL: "0",
  SHAFFAQ_ALLOW_LOCAL_PRODUCTION_PROFILE: "1",
  DATABASE_PROVIDER: "sqlite",
  MEDIA_PROVIDER: "local",
  APP_ORIGIN: baseURL,
  NEXT_PUBLIC_APP_ORIGIN: baseURL,
  PORT: String(port),
  SQLITE_PATH: databasePath,
  MEDIA_ROOT: mediaRoot,
  SESSION_SECRET: randomBytes(48).toString("base64url"),
  CSRF_SECRET: randomBytes(48).toString("base64url"),
  ADMIN_EMAIL: adminEmail,
  ADMIN_INITIAL_PASSWORD: adminPassword,
};
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is required to run the disposable smoke setup.");

function run(command, args, extraEnv = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: { ...env, ...extraEnv }, stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} ${args.join(" ")} exited with ${code}.`)));
  });
}

async function waitForReady() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try { const response = await fetch(`${baseURL}/api/health/ready`); if (response.ok) return; } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("Disposable smoke server did not become ready.");
}

let server;
try {
  await run(process.execPath, [npmCli, "run", "db:migrate"]);
  await run(process.execPath, [npmCli, "run", "db:seed"]);
  await run(process.execPath, [npmCli, "run", "bootstrap:admin"]);
  const database = new Database(databasePath);
  database.prepare("UPDATE settings SET whatsapp_number = '+923001234567' WHERE id = 1").run();
  database.close();
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), env, stdio: "inherit", shell: false });
  await waitForReady();
  await run(process.execPath, ["scripts/browser-smoke.mjs"], { SMOKE_BASE_URL: baseURL, SMOKE_ADMIN_EMAIL: adminEmail, SMOKE_ADMIN_PASSWORD: adminPassword });
  console.log("Disposable browser smoke completed; credentials and secrets existed only in child-process environments.");
} finally {
  if (server && server.exitCode === null) {
    const exited = new Promise((resolvePromise) => server.once("exit", resolvePromise));
    server.kill();
    await Promise.race([exited, new Promise((resolvePromise) => setTimeout(resolvePromise, 3_000))]);
  }
  rmSync(root, { recursive: true, force: true });
}
