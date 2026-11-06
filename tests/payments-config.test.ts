import { describe, expect, it } from "vitest";
import { validateRuntimeConfiguration } from "../src/config/runtime";
import { onlinePaymentsEnabled, readOnlinePaymentConfig } from "../src/lib/payments/config";

describe("online payment enablement config", () => {
  it("is ABSENT/DISABLED when no SAFEPAY vars are present", () => {
    const config = readOnlinePaymentConfig({});
    expect(config.safepay).toBe("ABSENT");
    expect(config.status).toBe("DISABLED");
    expect(onlinePaymentsEnabled({})).toBe(false);
  });

  it("is READY/ENABLED when all three are present and non-empty", () => {
    const env = { SAFEPAY_ENVIRONMENT: "sandbox", SAFEPAY_API_KEY: "key", SAFEPAY_WEBHOOK_SECRET: "c2VjcmV0" };
    const config = readOnlinePaymentConfig(env);
    expect(config.safepay).toBe("READY");
    expect(config.status).toBe("ENABLED");
    expect(onlinePaymentsEnabled(env)).toBe(true);
  });

  it("is PARTIAL/MISCONFIGURED when only some are present", () => {
    const config = readOnlinePaymentConfig({ SAFEPAY_API_KEY: "key" });
    expect(config.safepay).toBe("PARTIAL");
    expect(config.status).toBe("MISCONFIGURED");
    expect(onlinePaymentsEnabled({ SAFEPAY_API_KEY: "key" })).toBe(false);
  });

  it("treats whitespace-only values as absent", () => {
    expect(readOnlinePaymentConfig({ SAFEPAY_ENVIRONMENT: "  ", SAFEPAY_API_KEY: " ", SAFEPAY_WEBHOOK_SECRET: "" }).status).toBe("DISABLED");
  });
});

const prod = {
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

describe("runtime config — online payments fail-closed (AC11)", () => {
  it("does not throw when online payments are unconfigured", () => {
    expect(() => validateRuntimeConfiguration(prod)).not.toThrow();
  });

  it("throws in production when a required SAFEPAY var is missing (PARTIAL)", () => {
    expect(() => validateRuntimeConfiguration({ ...prod, SAFEPAY_API_KEY: "key" })).toThrow("partially configured");
  });

  it("throws when enabled but SAFEPAY_ENVIRONMENT is neither sandbox nor production", () => {
    expect(() => validateRuntimeConfiguration({ ...prod, SAFEPAY_ENVIRONMENT: "staging", SAFEPAY_API_KEY: "key", SAFEPAY_WEBHOOK_SECRET: "sec" })).toThrow("SAFEPAY_ENVIRONMENT");
  });

  it("accepts a fully enabled sandbox configuration", () => {
    expect(() => validateRuntimeConfiguration({ ...prod, SAFEPAY_ENVIRONMENT: "sandbox", SAFEPAY_API_KEY: "key", SAFEPAY_WEBHOOK_SECRET: "sec" })).not.toThrow();
  });
});
