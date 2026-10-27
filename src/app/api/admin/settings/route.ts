import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";

const optionalUrl = z.string().trim().max(500).refine((value) => !value || value.startsWith("/") || /^https:\/\//.test(value), "Use an internal path or HTTPS URL.").transform((value) => value || null);
const socialUrl = z.string().trim().max(500).refine((value) => !value || /^https:\/\//.test(value), "Social links must use HTTPS.").transform((value) => value || null);
const schema = z.object({
  storeName: z.string().trim().min(1).max(120), descriptor: z.string().trim().min(1).max(180),
  contactEmail: z.email().max(254).nullable(), contactPhone: z.string().trim().max(30).nullable(),
  whatsappNumber: z.string().trim().regex(/^\+[1-9]\d{7,14}$/).nullable(), shippingPkr: z.number().int().min(0).max(1_000_000),
  freeShippingThresholdPkr: z.number().int().min(0).max(100_000_000).nullable(), codEnabled: z.boolean(),
  taxEnabled: z.boolean(), taxRateBps: z.number().int().min(0).max(10_000),
  returnsPolicyUrl: optionalUrl, exchangesPolicyUrl: optionalUrl,
  instagramUrl: socialUrl, facebookUrl: socialUrl, tiktokUrl: socialUrl,
  seoTitle: z.string().trim().min(1).max(160), seoDescription: z.string().trim().min(1).max(300),
  analyticsIdentifier: z.string().trim().max(120).transform((value) => value || null),
  maintenanceMode: z.boolean(), maintenanceMessage: z.string().trim().max(500).transform((value) => value || null),
  expectedVersion: z.number().int().positive(),
}).strict().superRefine((value, context) => {
  if (value.taxEnabled && value.taxRateBps === 0) context.addIssue({ code: "custom", path: ["taxRateBps"], message: "Set a nonzero tax rate before enabling tax." });
  if (value.maintenanceMode && !value.maintenanceMessage) context.addIssue({ code: "custom", path: ["maintenanceMessage"], message: "Add a customer-facing maintenance message." });
});

export async function PATCH(request: NextRequest) {
  try {
    const actor = authorizeAdminMutation(request); const input = schema.parse(await request.json());
    const result = withAdminAudit(actor, "settings.store.update", "settings", "1", { codEnabled: input.codEnabled, shippingPkr: input.shippingPkr, taxEnabled: input.taxEnabled, maintenanceMode: input.maintenanceMode }, (connection) => {
      const update = connection.prepare(`UPDATE settings SET store_name=?, descriptor=?, contact_email=?, contact_phone=?, whatsapp_number=?,
        shipping_pkr=?, free_shipping_threshold_pkr=?, cod_enabled=?, tax_enabled=?, tax_rate_bps=?, returns_policy_url=?, exchanges_policy_url=?,
        instagram_url=?, facebook_url=?, tiktok_url=?, seo_title=?, seo_description=?, analytics_identifier=?, maintenance_mode=?, maintenance_message=?,
        version=version+1, updated_at=unixepoch()*1000 WHERE id=1 AND version=?`)
        .run(input.storeName, input.descriptor, input.contactEmail, input.contactPhone, input.whatsappNumber, input.shippingPkr, input.freeShippingThresholdPkr, input.codEnabled ? 1 : 0, input.taxEnabled ? 1 : 0, input.taxRateBps, input.returnsPolicyUrl ?? "/pages/returns", input.exchangesPolicyUrl ?? "/pages/returns", input.instagramUrl, input.facebookUrl, input.tiktokUrl, input.seoTitle, input.seoDescription, input.analyticsIdentifier, input.maintenanceMode ? 1 : 0, input.maintenanceMessage, input.expectedVersion);
      if (update.changes !== 1) throw new ApiError(409, "VERSION_CONFLICT", "Settings changed in another session. Reload and try again.");
      connection.prepare(`UPDATE shipping_regions SET rate_pkr = ?, free_shipping_threshold_pkr = ?, enabled = 1,
        live_checkout = 1, version = version + 1, updated_at = unixepoch() * 1000 WHERE code = 'PK'`).run(input.shippingPkr, input.freeShippingThresholdPkr);
      return { version: input.expectedVersion + 1 };
    });
    return NextResponse.json(result);
  } catch (error) { return apiErrorResponse(error); }
}
