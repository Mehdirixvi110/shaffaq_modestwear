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

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: supabaseRemotePatterns(),
  },
  serverExternalPackages: ["better-sqlite3", "@node-rs/argon2", "sharp", "postgres"],
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
