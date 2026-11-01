import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";

const fields = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,20}$/), name: z.string().trim().min(1).max(120), countries: z.array(z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/)).min(1).max(250), ratePkr: z.number().int().min(0).max(10_000_000), freeShippingThresholdPkr: z.number().int().min(0).max(100_000_000).nullable(), enabled: z.boolean(), liveCheckout: z.boolean() }).strict().superRefine((value, context) => {
  if (value.code !== "PK" && (value.enabled || value.liveCheckout)) context.addIssue({ code: "custom", path: ["enabled"], message: "International regions must remain disabled until pricing, payments, and fulfilment are implemented." });
  if (value.code === "PK" && !value.countries.includes("PK")) context.addIssue({ code: "custom", path: ["countries"], message: "The live Pakistan region must contain PK." });
  if (value.liveCheckout && value.code !== "PK") context.addIssue({ code: "custom", path: ["liveCheckout"], message: "Only Pakistan checkout is implemented." });
});
const schema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("CREATE"), fields }).strict(),
  z.object({ operation: z.literal("SAVE"), id: z.number().int().positive(), expectedVersion: z.number().int().positive(), fields }).strict(),
  z.object({ operation: z.literal("DISABLE"), id: z.number().int().positive(), expectedVersion: z.number().int().positive() }).strict(),
]);

export async function POST(request: NextRequest) {
  try {
    const actor = await authorizeAdminMutation(request); const input = schema.parse(await request.json());
    const result = await withAdminAudit(actor, `settings.shipping_region.${input.operation.toLowerCase()}`, "shipping_region", "id" in input ? String(input.id) : null, {}, async (connection) => {
      if (input.operation === "DISABLE") {
        const row = await connection.prepare("SELECT code FROM shipping_regions WHERE id = ?").get<{ code: string }>(input.id);
        if (!row) throw new ApiError(404, "REGION_NOT_FOUND", "Shipping region not found.");
        if (row.code === "PK") throw new ApiError(409, "LIVE_REGION_REQUIRED", "Pakistan is the only live checkout region and cannot be disabled here. Disable COD in Settings instead.");
        const update = await connection.prepare("UPDATE shipping_regions SET enabled = 0, live_checkout = 0, version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND version = ?").run(input.id, input.expectedVersion);
        if (update.changes !== 1) throw new ApiError(409, "VERSION_CONFLICT", "This region changed in another session. Reload and try again.");
        return { id: input.id, version: input.expectedVersion + 1 };
      }
      const value = input.fields; const countriesJson = JSON.stringify([...new Set(value.countries)]);
      try {
        if (input.operation === "CREATE") {
          const inserted = await connection.prepare("INSERT INTO shipping_regions (code, name, countries_json, currency, rate_pkr, free_shipping_threshold_pkr, enabled, live_checkout) VALUES (?, ?, ?, 'PKR', ?, ?, ?, ?)").run(value.code, value.name, countriesJson, value.ratePkr, value.freeShippingThresholdPkr, value.enabled ? 1 : 0, value.liveCheckout ? 1 : 0);
          return { id: inserted.lastInsertRowid, version: 1 };
        }
        const update = await connection.prepare("UPDATE shipping_regions SET code = ?, name = ?, countries_json = ?, rate_pkr = ?, free_shipping_threshold_pkr = ?, enabled = ?, live_checkout = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND version = ?")
          .run(value.code, value.name, countriesJson, value.ratePkr, value.freeShippingThresholdPkr, value.enabled ? 1 : 0, value.liveCheckout ? 1 : 0, input.id, input.expectedVersion);
        if (update.changes !== 1) throw new ApiError(409, "VERSION_CONFLICT", "This region changed in another session. Reload and try again.");
        if (value.code === "PK") await connection.prepare("UPDATE settings SET shipping_pkr = ?, free_shipping_threshold_pkr = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE id = 1").run(value.ratePkr, value.freeShippingThresholdPkr);
        return { id: input.id, version: input.expectedVersion + 1 };
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error instanceof Error && error.message.includes("UNIQUE")) throw new ApiError(409, "REGION_CODE_CONFLICT", "This region code already exists.");
        throw error;
      }
    });
    return NextResponse.json(result, { status: input.operation === "CREATE" ? 201 : 200 });
  } catch (error) { return apiErrorResponse(error); }
}
