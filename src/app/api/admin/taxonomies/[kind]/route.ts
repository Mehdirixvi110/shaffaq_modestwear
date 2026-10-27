import type Database from "better-sqlite3";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { slugSchema } from "@/lib/validation";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";

const kindSchema = z.enum(["categories", "collections"]);
const fields = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable(),
  imagePath: z.string().trim().max(500).nullable(),
  position: z.number().int().min(0).max(100_000),
  visible: z.boolean(),
  storefrontSort: z.enum(["FEATURED", "NEWEST", "PRICE_ASC", "PRICE_DESC"]),
  productIds: z.array(z.number().int().positive()).max(10_000),
}).strict();
const patchSchema = z.discriminatedUnion("operation", [
  fields.extend({ operation: z.literal("SAVE"), id: z.number().int().positive(), expectedVersion: z.number().int().positive() }).strict(),
  z.object({ operation: z.enum(["ARCHIVE", "RESTORE"]), id: z.number().int().positive(), expectedVersion: z.number().int().positive() }).strict(),
]);

function names(kind: z.infer<typeof kindSchema>) {
  return kind === "categories" ? { table: "categories", entity: "category", foreignKey: "category_id" } : { table: "collections", entity: "collection", foreignKey: "collection_id" };
}

function validateReferences(connection: Database.Database, imagePath: string | null, productIds: number[]) {
  if (imagePath && !connection.prepare("SELECT 1 FROM media_files WHERE public_path = ? AND replaced_at IS NULL").get(imagePath)) throw new ApiError(422, "MEDIA_NOT_FOUND", "Choose an available media item.");
  if (productIds.length) {
    const placeholders = productIds.map(() => "?").join(",");
    const count = (connection.prepare(`SELECT COUNT(*) AS count FROM products WHERE id IN (${placeholders})`).get(...productIds) as { count: number }).count;
    if (count !== new Set(productIds).size) throw new ApiError(422, "PRODUCT_NOT_FOUND", "One or more assigned products no longer exist.");
  }
}

function assignProducts(connection: Database.Database, foreignKey: string, id: number, productIds: number[]) {
  if (productIds.length) {
    const placeholders = productIds.map(() => "?").join(",");
    connection.prepare(`UPDATE products SET ${foreignKey} = NULL, version = version + 1, updated_at = unixepoch() * 1000 WHERE ${foreignKey} = ? AND id NOT IN (${placeholders})`).run(id, ...productIds);
    connection.prepare(`UPDATE products SET ${foreignKey} = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE id IN (${placeholders}) AND (${foreignKey} IS NULL OR ${foreignKey} != ?)`).run(id, ...productIds, id);
  } else connection.prepare(`UPDATE products SET ${foreignKey} = NULL, version = version + 1, updated_at = unixepoch() * 1000 WHERE ${foreignKey} = ?`).run(id);
}

export async function POST(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  try {
    const actor = authorizeAdminMutation(request);
    const kind = kindSchema.parse((await context.params).kind);
    const input = fields.parse(await request.json());
    const config = names(kind);
    const id = withAdminAudit(actor, `catalog.${config.entity}.create`, config.entity, null, { slug: input.slug, productCount: input.productIds.length }, (connection) => {
      validateReferences(connection, input.imagePath, input.productIds);
      try {
        const result = connection.prepare(`INSERT INTO ${config.table} (slug, name, description, image_path, position, visible, archived, storefront_sort, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, unixepoch() * 1000)`)
          .run(input.slug, input.name, input.description, input.imagePath, input.position, input.visible ? 1 : 0, input.storefrontSort);
        const entityId = Number(result.lastInsertRowid);
        assignProducts(connection, config.foreignKey, entityId, input.productIds);
        return entityId;
      } catch (error) {
        if (error instanceof Error && error.message.includes("UNIQUE")) throw new ApiError(409, "SLUG_CONFLICT", "This slug is already in use.");
        throw error;
      }
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  try {
    const actor = authorizeAdminMutation(request);
    const kind = kindSchema.parse((await context.params).kind);
    const input = patchSchema.parse(await request.json());
    const config = names(kind);
    const result = withAdminAudit(actor, `catalog.${config.entity}.${input.operation.toLowerCase()}`, config.entity, String(input.id), { operation: input.operation }, (connection) => {
      if (input.operation !== "SAVE") {
        const archived = input.operation === "ARCHIVE";
        const update = connection.prepare(`UPDATE ${config.table} SET archived = ?, visible = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND version = ?`)
          .run(archived ? 1 : 0, archived ? 0 : 1, input.id, input.expectedVersion);
        if (update.changes !== 1) throw new ApiError(409, "VERSION_CONFLICT", "This record changed in another session. Reload and try again.");
        return { id: input.id, version: input.expectedVersion + 1, archived };
      }
      validateReferences(connection, input.imagePath, input.productIds);
      try {
        const update = connection.prepare(`UPDATE ${config.table} SET slug = ?, name = ?, description = ?, image_path = ?, position = ?, visible = ?, storefront_sort = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND version = ?`)
          .run(input.slug, input.name, input.description, input.imagePath, input.position, input.visible ? 1 : 0, input.storefrontSort, input.id, input.expectedVersion);
        if (update.changes !== 1) throw new ApiError(409, "VERSION_CONFLICT", "This record changed in another session. Reload and try again.");
        assignProducts(connection, config.foreignKey, input.id, input.productIds);
        return { id: input.id, version: input.expectedVersion + 1 };
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error instanceof Error && error.message.includes("UNIQUE")) throw new ApiError(409, "SLUG_CONFLICT", "This slug is already in use.");
        throw error;
      }
    });
    return NextResponse.json(result);
  } catch (error) { return apiErrorResponse(error); }
}
