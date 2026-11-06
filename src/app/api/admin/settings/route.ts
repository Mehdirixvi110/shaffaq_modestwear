import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";
import { requiresMediaRecord, settingsUpdateSchema } from "@/server/settings-validation";

export async function PATCH(request: NextRequest) {
  try {
    const actor = await authorizeAdminMutation(request); const input = settingsUpdateSchema.parse(await request.json());
    const result = await withAdminAudit(actor, "settings.store.update", "settings", "1", { codEnabled: input.codEnabled, shippingPkr: input.shippingPkr, taxEnabled: input.taxEnabled, maintenanceMode: input.maintenanceMode, manualPaymentEnabled: input.manualPaymentEnabled }, async (connection) => {
      for (const mediaPath of [input.headerLogoPath, input.footerLogoPath, input.ogImagePath]) if (mediaPath && requiresMediaRecord(mediaPath) && !await connection.prepare("SELECT 1 FROM media_files WHERE public_path = ? AND replaced_at IS NULL").get(mediaPath)) throw new ApiError(422, "MEDIA_NOT_FOUND", "A selected image is no longer available.");
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
