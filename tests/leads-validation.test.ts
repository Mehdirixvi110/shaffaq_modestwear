import { describe, expect, it } from "vitest";
import { normalizePkPhone } from "../src/lib/validation";
import { whatsappUrl } from "../src/lib/whatsapp";

describe("normalizePkPhone", () => {
  it("canonicalises every accepted PK phone format to +923XXXXXXXXX", () => {
    const canonical = "+923001234567";
    expect(normalizePkPhone("03001234567")).toBe(canonical);
    expect(normalizePkPhone("+923001234567")).toBe(canonical);
    expect(normalizePkPhone("923001234567")).toBe(canonical);
    expect(normalizePkPhone("3001234567")).toBe(canonical);
  });
});

describe("whatsappUrl", () => {
  it("returns null for a too-short number", () => {
    expect(whatsappUrl("12345", "Hello")).toBeNull();
  });

  it("builds a wa.me URL with encoded text for a valid number", () => {
    expect(whatsappUrl("923001234567", "Hello SHAFFAQ & team")).toBe(
      "https://wa.me/923001234567?text=Hello%20SHAFFAQ%20%26%20team",
    );
  });
});
