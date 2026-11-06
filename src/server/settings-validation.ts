import { z } from "zod";

const optionalUrl = z.string().trim().max(500).refine((value) => !value || value.startsWith("/") || /^https:\/\//.test(value), "Use an internal path or HTTPS URL.").transform((value) => value || null).nullable();
const socialUrl = z.string().trim().max(500).refine((value) => !value || /^https:\/\//.test(value), "Social links must use HTTPS.").transform((value) => value || null).nullable();
const manualText = (max: number) => z.string().trim().max(max).transform((value) => value || null).nullable();
const mediaPath = z.string().trim().max(500).refine((value) => value.startsWith("/"), "Media path must be an internal path.").nullable();
const mediaAlt = z.string().trim().max(180).transform((value) => value || null).nullable();

export const settingsUpdateSchema = z.object({
  storeName: z.string().trim().min(1).max(120), descriptor: z.string().trim().min(1).max(180),
  contactEmail: z.email().max(254).nullable(), contactPhone: z.string().trim().max(30).nullable(),
  whatsappNumber: z.string().trim().regex(/^\+?[1-9]\d{7,14}$/).nullable(), shippingPkr: z.number().int().min(0).max(1_000_000),
  freeShippingThresholdPkr: z.number().int().min(0).max(100_000_000).nullable(), codEnabled: z.boolean(),
  taxEnabled: z.boolean(), taxRateBps: z.number().int().min(0).max(10_000),
  returnsPolicyUrl: optionalUrl, exchangesPolicyUrl: optionalUrl,
  instagramUrl: socialUrl, facebookUrl: socialUrl, tiktokUrl: socialUrl,
  seoTitle: z.string().trim().min(1).max(160), seoDescription: z.string().trim().min(1).max(300),
  analyticsIdentifier: z.string().trim().max(120).transform((value) => value || null).nullable(),
  maintenanceMode: z.boolean(), maintenanceMessage: z.string().trim().max(500).transform((value) => value || null).nullable(),
  manualPaymentEnabled: z.boolean(), manualBankName: manualText(120), manualAccountTitle: manualText(120), manualAccountNumber: manualText(60),
  manualIban: manualText(60), manualEasypaisaNumber: manualText(30), manualJazzcashNumber: manualText(30), manualPaymentInstructions: manualText(2000),
  headerLogoPath: mediaPath, headerLogoAlt: mediaAlt, footerLogoPath: mediaPath, footerLogoAlt: mediaAlt, ogImagePath: mediaPath, ogImageAlt: mediaAlt,
  expectedVersion: z.number().int().positive(),
}).strict().superRefine((value, context) => {
  if (value.taxEnabled && value.taxRateBps === 0) context.addIssue({ code: "custom", path: ["taxRateBps"], message: "Set a nonzero tax rate before enabling tax." });
  if (value.maintenanceMode && !value.maintenanceMessage) context.addIssue({ code: "custom", path: ["maintenanceMessage"], message: "Add a customer-facing maintenance message." });
});

// Only admin-uploaded media (the "/uploads/" convention) is stored as a media_files
// row, so only those paths must be verified against the library before a save. Static
// bundled assets ("/brand/...") and seeded Git-backed assets ("/media/...") are valid
// without a media_files row, so a default or seeded logo path never triggers the guard.
export function requiresMediaRecord(path: string): boolean {
  return path.startsWith("/uploads/");
}
