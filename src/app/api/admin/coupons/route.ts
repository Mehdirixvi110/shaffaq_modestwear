import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { DatabaseConnection } from "@/db";
import { normalizeCouponCode } from "@/lib/coupons";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";

const fields = z.object({
  code: z.string().trim().min(2).max(40).transform(normalizeCouponCode).pipe(z.string().regex(/^[A-Z0-9_-]+$/)),
  description: z.string().trim().max(500).nullable(),
  type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]),
  value: z.number().int().min(0).max(100_000_000),
  enabled: z.boolean(),
  startsAt: z.number().int().positive().nullable(),
  endsAt: z.number().int().positive().nullable(),
  minimumSubtotalPkr: z.number().int().min(0).max(100_000_000),
  usageLimit: z.number().int().positive().max(10_000_000).nullable(),
  perContactLimit: z.number().int().positive().max(10_000).nullable(),
  productIds: z.array(z.number().int().positive()).max(10_000),
  collectionIds: z.array(z.number().int().positive()).max(10_000),
}).strict().superRefine((value, context) => {
  if (value.type === "PERCENT" && (value.value < 1 || value.value > 100)) context.addIssue({ code: "custom", path: ["value"], message: "Percentage must be between 1 and 100." });
  if (value.type === "FIXED" && value.value < 1) context.addIssue({ code: "custom", path: ["value"], message: "Fixed discount must be at least PKR 1." });
  if (value.type === "FREE_SHIPPING" && value.value !== 0) context.addIssue({ code: "custom", path: ["value"], message: "Free-shipping coupons must use value 0." });
  if (value.startsAt !== null && value.endsAt !== null && value.endsAt <= value.startsAt) context.addIssue({ code: "custom", path: ["endsAt"], message: "End date must be after start date." });
});
const patchSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("SAVE"), id: z.number().int().positive(), expectedVersion: z.number().int().positive(), fields }).strict(),
  z.object({ operation: z.enum(["ARCHIVE", "RESTORE"]), id: z.number().int().positive(), expectedVersion: z.number().int().positive() }).strict(),
]);

async function validateScopes(connection: DatabaseConnection, productIds: number[], collectionIds: number[]) {
  const uniqueProducts = [...new Set(productIds)];
  const uniqueCollections = [...new Set(collectionIds)];
  if (uniqueProducts.length) {
    const placeholders = uniqueProducts.map(() => "?").join(",");
    const count = await connection.prepare(`SELECT COUNT(*) AS count FROM products WHERE id IN (${placeholders})`).get<{ count: number }>(...uniqueProducts);
    if (count?.count !== uniqueProducts.length) throw new ApiError(422, "INVALID_SCOPE", "A selected product no longer exists.");
  }
  if (uniqueCollections.length) {
    const placeholders = uniqueCollections.map(() => "?").join(",");
    const count = await connection.prepare(`SELECT COUNT(*) AS count FROM collections WHERE id IN (${placeholders})`).get<{ count: number }>(...uniqueCollections);
    if (count?.count !== uniqueCollections.length) throw new ApiError(422, "INVALID_SCOPE", "A selected collection no longer exists.");
  }
  return { uniqueProducts, uniqueCollections };
}

async function replaceScopes(connection: DatabaseConnection, couponId: number, productIds: number[], collectionIds: number[]) {
  await connection.prepare("DELETE FROM coupon_products WHERE coupon_id = ?").run(couponId);
  await connection.prepare("DELETE FROM coupon_collections WHERE coupon_id = ?").run(couponId);
  const productInsert = connection.prepare("INSERT INTO coupon_products (coupon_id, product_id) VALUES (?, ?)");
  for (const productId of productIds) await productInsert.run(couponId, productId);
  const collectionInsert = connection.prepare("INSERT INTO coupon_collections (coupon_id, collection_id) VALUES (?, ?)");
  for (const collectionId of collectionIds) await collectionInsert.run(couponId, collectionId);
}

export async function POST(request: NextRequest) {
  try {
    const actor = await authorizeAdminMutation(request);
    const input = fields.parse(await request.json());
    const id = await withAdminAudit(actor, "promotions.coupon.create", "coupon", null, { code: input.code, type: input.type }, async (connection) => {
      const scopes = await validateScopes(connection, input.productIds, input.collectionIds);
      try {
        const result = await connection.prepare(`INSERT INTO coupons (code, description, type, value, enabled, starts_at, ends_at, minimum_subtotal_pkr, usage_limit, per_contact_limit)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(input.code, input.description, input.type, input.value, input.enabled ? 1 : 0, input.startsAt, input.endsAt, input.minimumSubtotalPkr, input.usageLimit, input.perContactLimit);
        const couponId = result.lastInsertRowid;
        await replaceScopes(connection, couponId, scopes.uniqueProducts, scopes.uniqueCollections);
        return couponId;
      } catch (error) {
        if (error instanceof Error && error.message.includes("UNIQUE")) throw new ApiError(409, "COUPON_CODE_CONFLICT", "A coupon with this code already exists.");
        throw error;
      }
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await authorizeAdminMutation(request);
    const input = patchSchema.parse(await request.json());
    const result = await withAdminAudit(actor, `promotions.coupon.${input.operation.toLowerCase()}`, "coupon", String(input.id), { operation: input.operation }, async (connection) => {
      if (input.operation !== "SAVE") {
        const archived = input.operation === "ARCHIVE";
        const update = await connection.prepare("UPDATE coupons SET archived = ?, enabled = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND version = ?")
          .run(archived ? 1 : 0, archived ? 0 : 1, input.id, input.expectedVersion);
        if (update.changes !== 1) throw new ApiError(409, "VERSION_CONFLICT", "This coupon changed in another session. Reload and try again.");
        return { id: input.id, version: input.expectedVersion + 1, archived };
      }
      const value = input.fields;
      const scopes = await validateScopes(connection, value.productIds, value.collectionIds);
      try {
        const update = await connection.prepare("UPDATE coupons SET code = ?, description = ?, type = ?, value = ?, enabled = ?, starts_at = ?, ends_at = ?, minimum_subtotal_pkr = ?, usage_limit = ?, per_contact_limit = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND version = ?")
          .run(value.code, value.description, value.type, value.value, value.enabled ? 1 : 0, value.startsAt, value.endsAt, value.minimumSubtotalPkr, value.usageLimit, value.perContactLimit, input.id, input.expectedVersion);
        if (update.changes !== 1) throw new ApiError(409, "VERSION_CONFLICT", "This coupon changed in another session. Reload and try again.");
        await replaceScopes(connection, input.id, scopes.uniqueProducts, scopes.uniqueCollections);
        return { id: input.id, version: input.expectedVersion + 1 };
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error instanceof Error && error.message.includes("UNIQUE")) throw new ApiError(409, "COUPON_CODE_CONFLICT", "A coupon with this code already exists.");
        throw error;
      }
    });
    return NextResponse.json(result);
  } catch (error) { return apiErrorResponse(error); }
}
