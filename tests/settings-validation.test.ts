import { describe, expect, it } from "vitest";
import { requiresMediaRecord, settingsUpdateSchema } from "@/server/settings-validation";

// A realistic settings PATCH body: the optional social/analytics/maintenance
// fields are null (their default state) and the logo paths are null (the bundled
// default). The server never receives the server-managed `version` key.
const payload = {
  storeName: "SHAFFAQ",
  descriptor: "Abayas & Scarves",
  contactEmail: "admin@shaffaqmodestwear.com",
  contactPhone: "923233367659",
  whatsappNumber: "923233367659",
  shippingPkr: 250,
  freeShippingThresholdPkr: 6000,
  codEnabled: true,
  taxEnabled: false,
  taxRateBps: 0,
  returnsPolicyUrl: "/pages/returns",
  exchangesPolicyUrl: "/pages/returns",
  instagramUrl: null,
  facebookUrl: null,
  tiktokUrl: null,
  seoTitle: "SHAFFAQ | Abayas & Scarves",
  seoDescription: "Explore the editable SHAFFAQ catalogue in PKR.",
  analyticsIdentifier: null,
  maintenanceMode: false,
  maintenanceMessage: null,
  manualPaymentEnabled: false,
  manualBankName: null,
  manualAccountTitle: null,
  manualAccountNumber: null,
  manualIban: null,
  manualEasypaisaNumber: null,
  manualJazzcashNumber: null,
  manualPaymentInstructions: null,
  headerLogoPath: null,
  headerLogoAlt: "SHAFFAQ",
  footerLogoPath: null,
  footerLogoAlt: "SHAFFAQ Abayas & Scarves",
  ogImagePath: null,
  ogImageAlt: null,
  expectedVersion: 1,
};

describe("requiresMediaRecord", () => {
  it("enforces existence only for admin-uploaded media", () => {
    expect(requiresMediaRecord("/uploads/3cceab56-7217-4e07-a572-d952b6019e49.png")).toBe(true);
  });

  it("allows the static bundled default logo without a media_files row", () => {
    expect(requiresMediaRecord("/brand/logo.jpg")).toBe(false);
  });

  it("allows seeded Git-backed assets without a media_files row", () => {
    expect(requiresMediaRecord("/media/hero-desktop.jpeg")).toBe(false);
  });
});

describe("settingsUpdateSchema", () => {
  it("accepts a realistic payload whose optional fields are null and with no version key", () => {
    expect(settingsUpdateSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects an unknown version key so the client must not echo the server-managed version", () => {
    expect(settingsUpdateSchema.safeParse({ ...payload, version: 1 }).success).toBe(false);
  });

  it("rejects the stray hero/announcement keys that the settings form must not forward", () => {
    const withStoreSettingsRow = { ...payload, announcement: "Sample", heroTitle: "Elegance", heroDesktopPath: "/media/hero-desktop.jpeg", version: 1 };
    const result = settingsUpdateSchema.safeParse(withStoreSettingsRow);
    expect(result.success).toBe(false);
    // The strict guard reports a root-level unrecognized_keys issue, so flatten()
    // yields empty fieldErrors — exactly the 422 {"fields":{}} the save returned.
    if (!result.success) {
      expect(Object.keys(result.error.flatten().fieldErrors)).toHaveLength(0);
      expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
    }
  });
});
