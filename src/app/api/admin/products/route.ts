import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { DatabaseConnection } from "@/db";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";
import { cleanText, pkrSchema, slugSchema } from "@/lib/validation";
import { adjustStock } from "@/server/inventory";

const variantSchema = z.object({ id: z.number().int().positive().optional(), version: z.number().int().positive().optional(), optionValue: cleanText(80), sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9._-]+$/).max(64), pricePkr: pkrSchema, compareAtPkr: pkrSchema.nullable(), stock: z.number().int().min(0).max(1_000_000), stockReason: z.string().trim().max(500).nullable().optional().default(null), lowStockThreshold: z.number().int().min(0).max(1_000_000).optional().default(2), active: z.boolean() }).strict().refine((value) => Boolean(value.id) === Boolean(value.version), { message: "Existing variants require a version." }).refine((value) => value.compareAtPkr === null || value.compareAtPkr > value.pricePkr, { message: "Compare-at price must be greater than price." }).refine((value) => Boolean(value.id) || value.stock === 0 || Boolean(value.stockReason), { message: "A reason is required for initial stock." });
export const productSchema = z.object({
  title: cleanText(160), slug: slugSchema, description: cleanText(20000), categoryId: z.number().int().positive().nullable(), collectionId: z.number().int().positive().nullable(), imagePath: z.string().trim().max(500).nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]), isFeatured: z.boolean(), isSample: z.boolean(), seoTitle: z.string().trim().max(160).nullable(), seoDescription: z.string().trim().max(300).nullable(), optionName: cleanText(80), variants: z.array(variantSchema).min(1).max(100), version: z.number().int().positive().optional(),
}).strict();

export async function validateProductReferences(connection: DatabaseConnection, input: z.infer<typeof productSchema>) {
  if (input.categoryId && !await connection.prepare("SELECT 1 FROM categories WHERE id = ? AND archived = 0").get(input.categoryId)) throw new ApiError(422, "CATEGORY_NOT_FOUND", "Choose an active category.");
  if (input.collectionId && !await connection.prepare("SELECT 1 FROM collections WHERE id = ? AND archived = 0").get(input.collectionId)) throw new ApiError(422, "COLLECTION_NOT_FOUND", "Choose an active collection.");
  if (input.imagePath && !await connection.prepare("SELECT 1 FROM media_files WHERE public_path = ? AND replaced_at IS NULL").get(input.imagePath)) throw new ApiError(422, "MEDIA_NOT_FOUND", "Choose an available media item.");
}

export async function POST(request: NextRequest) {
  try {
    const actor = await authorizeAdminMutation(request); const input = productSchema.parse(await request.json());
    const id = await withAdminAudit(actor, "catalog.product.create", "product", null, { slug: input.slug }, async (connection) => {
      await validateProductReferences(connection, input);
      try {
        const result = await connection.prepare("INSERT INTO products (slug, title, description, category_id, collection_id, status, is_featured, is_sample, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(input.slug, input.title, input.description, input.categoryId, input.collectionId, input.status, input.isFeatured ? 1 : 0, input.isSample ? 1 : 0, input.seoTitle, input.seoDescription);
        const productId = result.lastInsertRowid;
        if (input.imagePath) await connection.prepare("INSERT INTO product_images (product_id, path, alt, position) VALUES (?, ?, ?, 0)").run(productId, input.imagePath, input.title);
        const optionId = (await connection.prepare("INSERT INTO product_options (product_id, name, required, position) VALUES (?, ?, 1, 0)").run(productId, input.optionName)).lastInsertRowid;
        for (const [position, variant] of input.variants.entries()) {
          const valueId = (await connection.prepare("INSERT INTO option_values (option_id, value, position) VALUES (?, ?, ?)").run(optionId, variant.optionValue, position)).lastInsertRowid;
          const variantId = (await connection.prepare("INSERT INTO variants (product_id, title, sku, price_pkr, compare_at_pkr, stock, low_stock_threshold, active, position) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)").run(productId, `${input.optionName} ${variant.optionValue}`, variant.sku, variant.pricePkr, variant.compareAtPkr, variant.lowStockThreshold, variant.active ? 1 : 0, position)).lastInsertRowid;
          if (variant.stock > 0) await adjustStock(connection, { variantId, delta: variant.stock, expectedVersion: 1, reason: variant.stockReason ?? "Initial stock recorded during product creation.", source: "INITIAL", sourceKey: `INITIAL:${productId}:${variant.sku}`, actorUserId: actor.id });
          await connection.prepare("INSERT INTO variant_option_values (variant_id, option_value_id) VALUES (?, ?)").run(variantId, valueId);
        }
        return productId;
      } catch (error) {
        if (error instanceof Error && error.message.includes("UNIQUE")) throw new ApiError(409, "CATALOG_CONFLICT", "The slug, SKU, or option value already exists.");
        throw error;
      }
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
