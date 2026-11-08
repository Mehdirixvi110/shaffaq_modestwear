import type { NextConfig } from "next";

function supabaseRemotePatterns(): NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> {
  const value = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) return [];
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return [];
    return [{ protocol: "https", hostname: url.hostname, pathname: "/storage/v1/object/public/**" }];
  } catch {
    return [];
  }
}

// Drop drivers the chosen profile never loads from the standalone file trace. The
// provider-scoped dynamic imports (src/db/provider.ts, src/server/media-storage.ts) only
// fire on their path, but Next's tracer still copies the string-literal module references
// into .next/standalone/node_modules. Excludes are keyed to EXPLICIT env so an unset build
// keeps both drivers: sqlite data never loads Postgres; local media never loads Supabase.
// The hybrid (DATABASE_PROVIDER=sqlite, MEDIA_PROVIDER=supabase) therefore keeps @supabase
// and drops only postgres, and the Vercel build (postgres + supabase) ships both.
const tracingExcludes = [
  ...(process.env.DATABASE_PROVIDER === "sqlite" ? ["node_modules/postgres/**"] : []),
  ...(process.env.MEDIA_PROVIDER === "local" ? ["node_modules/@supabase/**"] : []),
];

const nextConfig: NextConfig = {
  // Standalone output bundles only traced dependencies and a minimal server into
  // .next/standalone (with its own server.js), which is the deployment artifact for
  // the cPanel "Setup Node.js App" startup file and keeps the footprint small on the
  // 1 GB disk. Deploy note: .next/static and public/ are NOT copied into the
  // standalone folder by the build — they must be placed alongside
  // .next/standalone/server.js on the server (see docs/CPANEL_DEPLOYMENT.md).
  output: "standalone",
  // Hide the Next.js dev-mode indicator ("N" badge) so it never overlaps the
  // storefront's floating WhatsApp button in local dev. (It never renders in production.)
  devIndicators: false,
  ...(tracingExcludes.length ? { outputFileTracingExcludes: { "*": tracingExcludes } } : {}),
  images: {
    unoptimized: true,
    remotePatterns: supabaseRemotePatterns(),
  },
  // @supabase/supabase-js is external like postgres so the provider-scoped dynamic
  // import in src/server/media-storage.ts resolves as a runtime require and stays out
  // of the SQLite trace; the Supabase profile is unaffected (its host runs npm install).
  serverExternalPackages: ["better-sqlite3", "@node-rs/argon2", "sharp", "postgres", "@supabase/supabase-js"],
  async headers() {
    // HSTS is only meaningful (and only valid) over HTTPS, so it is gated to
    // production builds. Local dev and the http://localhost production smoke
    // must not advertise it. The nonce-based Content-Security-Policy is set
    // per-request in src/proxy.ts (a static header cannot carry a fresh nonce).
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
