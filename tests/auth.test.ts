import { describe, expect, it } from "vitest";
import { canAccessAdmin, isSessionActive } from "../src/lib/security";

describe("admin authorization", () => {
  it("requires both the admin role and a live session", () => {
    const now = 1_000;
    expect(canAccessAdmin("ADMIN", 2_000, now)).toBe(true);
    expect(canAccessAdmin("CUSTOMER", 2_000, now)).toBe(false);
    expect(canAccessAdmin("ADMIN", 999, now)).toBe(false);
  });
  it("treats an exact expiry as expired", () => {
    expect(isSessionActive(1_000, 1_000)).toBe(false);
  });
});
