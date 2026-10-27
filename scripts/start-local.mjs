import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync(".next/BUILD_ID")) {
  console.error("Build not found. Run npm run build first.");
  process.exit(1);
}

const port = Number(process.env.PORT ?? "3000");
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error("PORT must be an integer from 1024 to 65535.");
  process.exit(1);
}

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  stdio: "inherit",
  shell: false,
  env: { ...process.env, APP_ORIGIN: process.env.APP_ORIGIN ?? `http://localhost:${port}` },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
