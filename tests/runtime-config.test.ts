import { describe, expect, it } from "vitest";
import { validateRuntimeConfiguration } from "../src/config/runtime";

const valid = {
  NODE_ENV: "production",
  APP_ORIGIN: "https://shop.example.com",
  NEXT_PUBLIC_APP_ORIGIN: "https://shop.example.com",
  SESSION_SECRET: "s".repeat(48),
  CSRF_SECRET: "c".repeat(48),
  DATABASE_PROVIDER: "postgres",
  DATABASE_URL: "postgresql://user:password@pooler.example.com:6543/postgres",
  MEDIA_PROVIDER: "supabase",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SECRET_KEY: "k".repeat(40),
  SUPABASE_STORAGE_BUCKET: "shaffaq-media",
};

describe("production runtime configuration", () => {
  it("accepts the hosted PostgreSQL and Supabase profile", () => {
    expect(() => validateRuntimeConfiguration(valid)).not.toThrow();
  });

  it("fails closed for SQLite or local media", () => {
    expect(() => validateRuntimeConfiguration({ ...valid, DATABASE_PROVIDER: "sqlite" })).toThrow("DATABASE_PROVIDER");
    expect(() => validateRuntimeConfiguration({ ...valid, MEDIA_PROVIDER: "local" })).toThrow("MEDIA_PROVIDER");
  });

  it("requires HTTPS and independent strong secrets", () => {
    expect(() => validateRuntimeConfiguration({ ...valid, APP_ORIGIN: "http://shop.example.com", NEXT_PUBLIC_APP_ORIGIN: "http://shop.example.com" })).toThrow("HTTPS");
    expect(() => validateRuntimeConfiguration({ ...valid, CSRF_SECRET: valid.SESSION_SECRET })).toThrow("independent");
    expect(() => validateRuntimeConfiguration({ ...valid, SESSION_SECRET: "short" })).toThrow("32 bytes");
  });

  it("allows the explicit local-only production profile on loopback", () => {
    expect(() => validateRuntimeConfiguration({
      ...valid,
      VERCEL: "0",
      APP_ORIGIN: "http://localhost:3000",
      NEXT_PUBLIC_APP_ORIGIN: "http://localhost:3000",
      DATABASE_PROVIDER: "sqlite",
      MEDIA_PROVIDER: "local",
      SHAFFAQ_ALLOW_LOCAL_PRODUCTION_PROFILE: "1",
    })).not.toThrow();
  });

  it("does not allow the local override on Vercel", () => {
    expect(() => validateRuntimeConfiguration({ ...valid, VERCEL: "1", APP_ORIGIN: "http://localhost:3000", NEXT_PUBLIC_APP_ORIGIN: "http://localhost:3000", SHAFFAQ_ALLOW_LOCAL_PRODUCTION_PROFILE: "1" })).toThrow("HTTPS");
  });
});
