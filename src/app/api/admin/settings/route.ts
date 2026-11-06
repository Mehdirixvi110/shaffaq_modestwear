import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";

const optionalUrl = z.string().trim().max(500).refine((value) => !value || value.startsWith("/") || /^https:\/\//.test(value), "Use an internal path or HTTPS URL.").transform((value) => value || null);
const socialUrl = z.string().trim().max(500).refine((value) => !value || /^https:\/\//.test(value), "Social links must use HTTPS.").transform((value) => value || null);
const manualText = (max: number) => z.string().trim().max(max).transform((value) => value || null).nullable();
const mediaPath = z.string().trim().max(500).refine((value) => value.startsWith("/"), "Media path must be an internal path.").nullable();
const mediaAlt = z.string().trim().max(180).transform((value) => value || null).nullable();
const schema = z.object({
  storeName: z.string().trim().min(1).max(120), descriptor: z.string().trim().min(1).max(180),
  contactEmail: z.email().max(254).nullable(), contactPhone: z.string().trim().max(30).nullable(),
  whatsappNumber: z.string().trim().regex(/^\+?[1-9]\d{7,14}$/).nullable(), shippingPkr: z.number().int().min(0).max(1_000_000),
  freeShippingThresholdPkr: z.number().int().min(0).max(100_000_000).nullable(), codEnabled: z.boolean(),
  taxEnabled: z.boolean(), taxRateBps: z.number().int().min(0).max(10_000),
  returnsPolicyUrl: optionalUrl, exchangesPolicyUrl: optionalUrl,
  instagramUrl: socialUrl, facebookUrl: socialUrl, tiktokUrl: socialUrl,
  seoTitle: z.string().trim().min(1).max(160), seoDescription: z.string().trim().min(1).max(300),
  analyticsIdentifier: z.string().trim().max(120).transform((value) => value || null),
  maintenanceMode: z.boolean(), maintenanceMessage: z.string().trim().max(500).transform((value) => value || null),
  manualPaymentEnabled: z.boolean(), manualBankName: manualText(120), manualAccountTitle: manualText(120), manualAccountNumber: manualText(60),
  manualIban: manualText(60), manualEasypaisaNumber: manualText(30), manualJazzcashNumber: manualText(30), manualPaymentInstructions: manualText(2000),
  headerLogoPath: mediaPath, headerLogoAlt: mediaAlt, footerLogoPath: mediaPath, footerLogoAlt: mediaAlt, ogImagePath: mediaPath, ogImageAlt: mediaAlt,
  expectedVersion: z.number().int().positive(),
}).strict().superRefine((value, context) => {
  if (value.taxEnabled && value.taxRateBps === 0) context.addIssue({ code: "custom", path: ["taxRateBps"], message: "Set a nonzero tax rate before enabling tax." });
  if (value.maintenanceMode && !value.maintenanceMessage) context.addIssue({ code: "custom", path: ["maintenanceMessage"], message: "Add a customer-facing maintenance message." });
});

export async function PATCH(request: NextRequest) {
  try {
    const actor = await authorizeAdminMutation(request); const input = schema.parse(await request.json());
    const result = await withAdminAudit(actor, "settings.store.update", "settings", "1", { codEnabled: input.codEnabled, shippingPkr: input.shippingPkr, taxEnabled: input.taxEnabled, maintenanceMode: input.maintenanceMode, manualPaymentEnabled: input.manualPaymentEnabled }, async (connection) => {
      for (const mediaPath of [input.headerLogoPath, input.footerLogoPath, input.ogImagePath]) if (mediaPath && !await connection.prepare("SELECT 1 FROM media_files WHERE public_path = ? AND replaced_at IS NULL").get(mediaPath)) throw new ApiError(422, "MEDIA_NOT_FOUND", "A selected image is no longer available.");
      const update = await connection.prepare(`UPDATE settings SET store_name=?, descriptor=?, contact_email=?, contact_phone=?, whatsapp_number=?,
        shipping_pkr=?, free_shipping_threshold_pkr=?, cod_enabled=?, tax_enabled=?, tax_rate_bps=?, returns_policy_url=?, exchanges_policy_url=?,
        instagram_url=?, facebook_url=?, tiktok_url=?, seo_title=?, seo_description=?, analytics_identifier=?, maintenance_mode=?, maintenance_message=?,
        manual_payment_enabled=?, manual_bank_name=?, manual_account_title=?, manual_account_number=?, manual_iban=?, manual_easypaisa_number=?, manual_jazzcash_number=?, manual_payment_instructions=?,
        header_logo_path=?, header_logo_alt=?, footer_logo_path=?, footer_logo_alt=?, og_image_path=?, og_image_alt=?,
        version=version+1, updated_at=unixepoch()*1000 WHERE id=1 AND version=?`)
        .run(input.storeName, input.descriptor, input.contactEmail, input.contactPhone, input.whatsappNumber, input.shippingPkr, input.freeShippingThresholdPkr, input.codEnabled ? 1 : 0, input.taxEnabled ? 1 : 0, input.taxRateBps, input.returnsPolicyUrl ?? "/pages/returns", input.exchangesPolicyUrl ?? "/pages/returns", input.instagramUrl, input.facebookUrl, input.tiktokUrl, input.seoTitle, input.seoDescription, input.analyticsIdentifier, input.maintenanceMode ? 1 : 0, input.maintenanceMessage, input.manualPaymentEnabled ? 1 : 0, input.manualBankName, input.manualAccountTitle, input.manualAccountNumber, input.manualIban, input.manualEasypaisaNumber, input.manualJazzcashNumber, input.manualPaymentInstructions, input.headerLogoPath, input.headerLogoAlt, input.footerLogoPath, input.footerLogoAlt, input.ogImagePath, input.ogImageAlt, input.expectedVersion);
      if (update.changes !== 1) throw new ApiError(409, "VERSION_CONFLICT", "Settings changed in another session. Reload and try again.");
      await connection.prepare(`UPDATE shipping_regions SET rate_pkr = ?, free_shipping_threshold_pkr = ?, enabled = 1,
        live_checkout = 1, version = version + 1, updated_at = unixepoch() * 1000 WHERE code = 'PK'`).run(input.shippingPkr, input.freeShippingThresholdPkr);
      return { version: input.expectedVersion + 1 };
    });
    return NextResponse.json(result);
  } catch (error) { return apiErrorResponse(error); }
}
