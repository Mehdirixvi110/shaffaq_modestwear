import { readOnlinePaymentConfig } from "@/lib/payments/config";

type RuntimeEnvironment = Record<string, string | undefined>;

const LOCAL_PRODUCTION_OVERRIDE = "SHAFFAQ_ALLOW_LOCAL_PRODUCTION_PROFILE";

function requireValue(env: RuntimeEnvironment, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function requireOrigin(env: RuntimeEnvironment, allowLocalProduction: boolean) {
  const value = requireValue(env, "APP_ORIGIN");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("APP_ORIGIN must be an absolute URL.");
  }
  const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(allowLocalProduction && isLoopback && url.protocol === "http:")) {
    throw new Error("APP_ORIGIN must use HTTPS in production.");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash || value !== url.origin) {
    throw new Error("APP_ORIGIN must be the exact origin without credentials, a path, query, fragment, or trailing slash.");
  }
  const publicOrigin = env.NEXT_PUBLIC_APP_ORIGIN?.trim();
  if (publicOrigin && publicOrigin !== value) throw new Error("NEXT_PUBLIC_APP_ORIGIN must match APP_ORIGIN.");
}

function requireSecret(env: RuntimeEnvironment, name: "SESSION_SECRET" | "CSRF_SECRET") {
  const value = requireValue(env, name);
  if (Buffer.byteLength(value, "utf8") < 32) throw new Error(`${name} must contain at least 32 bytes.`);
  return value;
}

function requireHttpsUrl(env: RuntimeEnvironment, name: string) {
  const value = requireValue(env, name);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || value !== url.origin) {
    throw new Error(`${name} must be an exact HTTPS origin without credentials, a path, query, fragment, or trailing slash.`);
  }
  return url;
}

function requireSupabaseStorage(env: RuntimeEnvironment) {
  requireHttpsUrl(env, "SUPABASE_URL");
  const secretKey = requireValue(env, "SUPABASE_SECRET_KEY");
  if (Buffer.byteLength(secretKey, "utf8") < 32) throw new Error("SUPABASE_SECRET_KEY is invalid.");
  const bucket = requireValue(env, "SUPABASE_STORAGE_BUCKET");
  if (!/^[a-z0-9][a-z0-9._-]{1,62}$/i.test(bucket)) throw new Error("SUPABASE_STORAGE_BUCKET is invalid.");
}

function requirePostgresUrl(env: RuntimeEnvironment) {
  const value = requireValue(env, "DATABASE_URL");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || !url.password) {
    throw new Error("DATABASE_URL must be a credentialed PostgreSQL URL.");
  }
  if (url.port !== "6543") throw new Error("DATABASE_URL must use the Supabase transaction-pooler port 6543.");
}

export function isProductionRuntime(env: RuntimeEnvironment = process.env) {
  return env.VERCEL === "1" || (env.NODE_ENV === "production" && env.NEXT_PHASE !== "phase-production-build");
}

export function validateRuntimeConfiguration(env: RuntimeEnvironment = process.env) {
  const production = isProductionRuntime(env);
  if (!production) return;

  const allowLocalProduction = env[LOCAL_PRODUCTION_OVERRIDE] === "1" && env.VERCEL !== "1";
  // SELF_HOSTED_SQLITE is the production opt-in for a REAL non-loopback https host
  // (e.g. cPanel Node) to run the sqlite + local-media profile. Distinct from the
  // loopback override above: it does NOT relax the origin to http, so it drops the
  // http-loopback allowance and still enforces exact-HTTPS origin plus present,
  // >=32-byte, distinct SESSION_SECRET/CSRF_SECRET and the payment fail-closed checks.
  // Self-excludes on Vercel.
  const selfHostedSqlite = env.SELF_HOSTED_SQLITE === "1" && env.VERCEL !== "1";
  const allowHttpLoopback = env.VERCEL !== "1" && !selfHostedSqlite;
  requireOrigin(env, allowHttpLoopback);
  const sessionSecret = requireSecret(env, "SESSION_SECRET");
  const csrfSecret = requireSecret(env, "CSRF_SECRET");
  if (sessionSecret === csrfSecret) throw new Error("SESSION_SECRET and CSRF_SECRET must be independent values.");

  // Online payments fail-closed check. Placed BEFORE the allowLocalProduction
  // early return so both production paths are covered. Reads only presence and the
  // non-secret SAFEPAY_ENVIRONMENT; never logs any secret value.
  const online = readOnlinePaymentConfig(env);
  if (online.status === "MISCONFIGURED") throw new Error("Online payments partially configured: set all SAFEPAY_* variables or none.");
  if (online.status === "ENABLED" && !["sandbox", "production"].includes(env.SAFEPAY_ENVIRONMENT ?? "")) throw new Error("SAFEPAY_ENVIRONMENT must be 'sandbox' or 'production'.");

  if (allowLocalProduction) {
    const hostname = new URL(requireValue(env, "APP_ORIGIN")).hostname;
    if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) throw new Error("The local production profile override is restricted to loopback origins.");
    return;
  }

  // Self-hosted production opt-in (e.g. cPanel Node): sqlite data, with media either
  // local OR on Supabase Storage. The Supabase-media variant is the recommended hybrid
  // for a small host — the tiny text database stays local while the heavy image files
  // live in Supabase Storage. The exact-HTTPS origin, strong distinct secrets, and
  // payment fail-closed checks above have already run; this only widens the provider pair.
  if (selfHostedSqlite) {
    if (env.DATABASE_PROVIDER !== "sqlite") throw new Error("DATABASE_PROVIDER must be sqlite when SELF_HOSTED_SQLITE=1.");
    const media = env.MEDIA_PROVIDER?.trim();
    if (media !== "local" && media !== "supabase") throw new Error("MEDIA_PROVIDER must be local or supabase when SELF_HOSTED_SQLITE=1.");
    if (media === "supabase") requireSupabaseStorage(env);
    return;
  }

  if (env.DATABASE_PROVIDER !== "postgres") throw new Error("DATABASE_PROVIDER must be postgres in production.");
  requirePostgresUrl(env);
  if (env.MEDIA_PROVIDER !== "supabase") throw new Error("MEDIA_PROVIDER must be supabase in production.");
  requireSupabaseStorage(env);
}

export function databaseProvider(env: RuntimeEnvironment = process.env): "sqlite" | "postgres" {
  const value = env.DATABASE_PROVIDER?.trim() || "sqlite";
  if (value !== "sqlite" && value !== "postgres") throw new Error("DATABASE_PROVIDER must be sqlite or postgres.");
  return value;
}

export function mediaProvider(env: RuntimeEnvironment = process.env): "local" | "supabase" {
  const value = env.MEDIA_PROVIDER?.trim() || "local";
  if (value !== "local" && value !== "supabase") throw new Error("MEDIA_PROVIDER must be local or supabase.");
  return value;
}
