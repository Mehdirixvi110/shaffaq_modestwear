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

describe("self-hosted SQLite production profile (SELF_HOSTED_SQLITE)", () => {
  const selfHosted = {
    ...valid,
    DATABASE_PROVIDER: "sqlite",
    MEDIA_PROVIDER: "local",
    SELF_HOSTED_SQLITE: "1",
  };

  it("still rejects sqlite in production when the flag is off", () => {
    expect(() => validateRuntimeConfiguration({ ...selfHosted, SELF_HOSTED_SQLITE: "0" })).toThrow("DATABASE_PROVIDER");
  });

  it("permits sqlite + local media behind the flag with HTTPS and strong distinct secrets", () => {
    expect(() => validateRuntimeConfiguration(selfHosted)).not.toThrow();
  });

  it("still requires an exact HTTPS origin, rejecting http even on loopback", () => {
    expect(() => validateRuntimeConfiguration({ ...selfHosted, APP_ORIGIN: "http://127.0.0.1:3000", NEXT_PUBLIC_APP_ORIGIN: "http://127.0.0.1:3000" })).toThrow("HTTPS");
  });

  it("still requires a >=32-byte SESSION_SECRET", () => {
    expect(() => validateRuntimeConfiguration({ ...selfHosted, SESSION_SECRET: "short" })).toThrow("32 bytes");
  });

  it("still requires independent SESSION_SECRET and CSRF_SECRET", () => {
    expect(() => validateRuntimeConfiguration({ ...selfHosted, CSRF_SECRET: selfHosted.SESSION_SECRET })).toThrow("independent");
  });

  it("permits only local media, rejecting supabase even behind the flag", () => {
    expect(() => validateRuntimeConfiguration({ ...selfHosted, MEDIA_PROVIDER: "supabase" })).toThrow("MEDIA_PROVIDER");
  });

  it("ignores the flag on Vercel and still forces postgres", () => {
    expect(() => validateRuntimeConfiguration({ ...selfHosted, VERCEL: "1" })).toThrow("DATABASE_PROVIDER");
  });
});
