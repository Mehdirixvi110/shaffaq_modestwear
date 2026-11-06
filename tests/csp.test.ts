import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "../src/lib/csp";

const BASE = {
  nonce: "test-nonce",
  supabaseImgOrigin: "",
  selfOrigin: "http://127.0.0.1:3000",
};

function directive(csp: string, name: string): string {
  return csp.split("; ").find((part) => part.startsWith(`${name} `) || part === name) ?? "";
}

describe("buildContentSecurityPolicy", () => {
  it("keeps the production policy strict (nonce + strict-dynamic, no unsafe-*, no ws:)", () => {
    const csp = buildContentSecurityPolicy({ ...BASE, isDev: false, isHttps: false });
    const script = directive(csp, "script-src");
    expect(script).toContain("'strict-dynamic'");
    expect(script).toContain("'nonce-test-nonce'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
    const connect = directive(csp, "connect-src");
    expect(connect).toBe("connect-src 'self'");
    expect(connect).not.toContain("ws:");
    expect(connect).not.toContain("wss:");
    expect(csp).not.toContain("worker-src");
  });

  it("relaxes the development policy for HMR and React Refresh", () => {
    const csp = buildContentSecurityPolicy({ ...BASE, isDev: true, isHttps: false });
    const script = directive(csp, "script-src");
    expect(script).toContain("'unsafe-inline'");
    expect(script).toContain("'unsafe-eval'");
    expect(script).not.toContain("'strict-dynamic'");
    expect(script).not.toContain("'nonce-");
    const connect = directive(csp, "connect-src");
    expect(connect).toContain("ws:");
    expect(connect).toContain("wss:");
    expect(connect).toContain(BASE.selfOrigin);
    expect(csp).toContain("worker-src 'self' blob:");
  });

  it("includes the Supabase image origin only when configured", () => {
    const withSupabase = buildContentSecurityPolicy({
      ...BASE,
      isDev: false,
      isHttps: false,
      supabaseImgOrigin: "https://proj.supabase.co",
    });
    expect(directive(withSupabase, "img-src")).toBe("img-src 'self' data: blob: https://proj.supabase.co");
    const withoutSupabase = buildContentSecurityPolicy({ ...BASE, isDev: false, isHttps: false });
    expect(directive(withoutSupabase, "img-src")).toBe("img-src 'self' data: blob:");
  });

  it("appends upgrade-insecure-requests only over HTTPS", () => {
    expect(buildContentSecurityPolicy({ ...BASE, isDev: false, isHttps: true })).toContain("upgrade-insecure-requests");
    expect(buildContentSecurityPolicy({ ...BASE, isDev: false, isHttps: false })).not.toContain("upgrade-insecure-requests");
  });
});
