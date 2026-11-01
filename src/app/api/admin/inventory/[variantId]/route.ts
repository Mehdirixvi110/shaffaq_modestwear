import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";
import { adjustStock } from "@/server/inventory";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ADJUST"), delta: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0), reason: z.string().trim().min(1).max(500), expectedVersion: z.number().int().positive(), idempotencyKey: z.uuidv4() }).strict(),
  z.object({ action: z.literal("THRESHOLD"), lowStockThreshold: z.number().int().min(0).max(1_000_000), expectedVersion: z.number().int().positive() }).strict(),
]);

export async function PATCH(request: NextRequest, context: { params: Promise<{ variantId: string }> }) {
  try {
    const actor = await authorizeAdminMutation(request);
    const variantId = z.coerce.number().int().positive().parse((await context.params).variantId);
    const input = schema.parse(await request.json());
    const result = await withAdminAudit(actor, `inventory.${input.action.toLowerCase()}`, "variant", String(variantId), input.action === "ADJUST" ? { delta: input.delta, reason: input.reason } : { lowStockThreshold: input.lowStockThreshold }, async (connection) => {
      if (input.action === "ADJUST") return adjustStock(connection, { variantId, delta: input.delta, expectedVersion: input.expectedVersion, reason: input.reason, source: "MANUAL", sourceKey: `MANUAL:${input.idempotencyKey}`, actorUserId: actor.id });
      const update = await connection.prepare("UPDATE variants SET low_stock_threshold = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND version = ?")
        .run(input.lowStockThreshold, variantId, input.expectedVersion);
      if (update.changes !== 1) {
        const exists = await connection.prepare("SELECT 1 FROM variants WHERE id = ?").get(variantId);
        if (!exists) throw new ApiError(404, "VARIANT_NOT_FOUND", "Variant not found.");
        throw new ApiError(409, "VERSION_CONFLICT", "Inventory changed in another session. Reload and try again.");
      }
      return { lowStockThreshold: input.lowStockThreshold, version: input.expectedVersion + 1 };
    });
    return NextResponse.json(result);
  } catch (error) { return apiErrorResponse(error); }
}
