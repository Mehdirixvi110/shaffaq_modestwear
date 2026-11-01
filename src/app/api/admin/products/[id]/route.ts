import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";
import { adjustStock } from "@/server/inventory";
import { productSchema, validateProductReferences } from "../route";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authorizeAdminMutation(request); const id = z.coerce.number().int().positive().parse((await context.params).id); const input = productSchema.parse(await request.json());
    if (!input.version) throw new ApiError(422, "VERSION_REQUIRED", "Reload the product before saving.");
    await withAdminAudit(actor, "catalog.product.update", "product", String(id), { status: input.status }, async (connection) => {
      await validateProductReferences(connection, input);
      const exists = await connection.prepare(`SELECT id, version FROM products WHERE id = ?${connection.provider === "postgres" ? " FOR UPDATE" : ""}`).get<{ id: number; version: number }>(id);
      if (!exists) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
      if (exists.version !== input.version) throw new ApiError(409, "VERSION_CONFLICT", "This product changed in another session. Reload and try again.");
      try {
        const productUpdate = await connection.prepare("UPDATE products SET slug=?, title=?, description=?, category_id=?, collection_id=?, status=?, is_featured=?, is_sample=?, seo_title=?, seo_description=?, version=version+1, updated_at=unixepoch()*1000 WHERE id=? AND version=?")
          .run(input.slug, input.title, input.description, input.categoryId, input.collectionId, input.status, input.isFeatured ? 1 : 0, input.isSample ? 1 : 0, input.seoTitle, input.seoDescription, id, input.version);
        if (productUpdate.changes !== 1) throw new ApiError(409, "VERSION_CONFLICT", "This product changed in another session. Reload and try again.");
        await connection.prepare("DELETE FROM product_images WHERE product_id = ?").run(id);
        if (input.imagePath) await connection.prepare("INSERT INTO product_images (product_id, path, alt, position) VALUES (?, ?, ?, 0)").run(id, input.imagePath, input.title);
        const submittedIds = input.variants.flatMap((variant) => variant.id ? [variant.id] : []);
        await connection.prepare(`UPDATE variants SET active = 0, version = version + 1, updated_at = unixepoch() * 1000 WHERE product_id = ?${submittedIds.length ? ` AND id NOT IN (${submittedIds.map(() => "?").join(",")})` : ""}`).run(id, ...submittedIds);
        await connection.prepare("DELETE FROM product_options WHERE product_id = ?").run(id);
        const optionId = (await connection.prepare("INSERT INTO product_options (product_id, name, required, position) VALUES (?, ?, 1, 0)").run(id, input.optionName)).lastInsertRowid;
        for (const [position, variant] of input.variants.entries()) {
          const valueId = (await connection.prepare("INSERT INTO option_values (option_id, value, position) VALUES (?, ?, ?)").run(optionId, variant.optionValue, position)).lastInsertRowid;
          let variantId = variant.id;
          if (variantId) {
            const owned = await connection.prepare(`SELECT id, stock, version FROM variants WHERE id = ? AND product_id = ?${connection.provider === "postgres" ? " FOR UPDATE" : ""}`).get<{ id: number; stock: number; version: number }>(variantId, id);
            if (!owned) throw new ApiError(422, "INVALID_VARIANT", "A variant does not belong to this product.");
            if (owned.version !== variant.version) throw new ApiError(409, "VERSION_CONFLICT", "A variant changed in another session. Reload and try again.");
            if (owned.stock !== variant.stock) throw new ApiError(409, "STOCK_ADJUSTMENT_REQUIRED", "Stock cannot be overwritten in the product editor. Use Inventory and provide a reason.");
            const updated = await connection.prepare("UPDATE variants SET title=?, sku=?, price_pkr=?, compare_at_pkr=?, low_stock_threshold=?, active=?, position=?, version=version+1, updated_at=unixepoch()*1000 WHERE id=? AND version=?")
              .run(`${input.optionName} ${variant.optionValue}`, variant.sku, variant.pricePkr, variant.compareAtPkr, variant.lowStockThreshold, variant.active ? 1 : 0, position, variantId, variant.version);
            if (updated.changes !== 1) throw new ApiError(409, "VERSION_CONFLICT", "A variant changed in another session. Reload and try again.");
          } else {
            variantId = (await connection.prepare("INSERT INTO variants (product_id, title, sku, price_pkr, compare_at_pkr, stock, low_stock_threshold, active, position) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)").run(id, `${input.optionName} ${variant.optionValue}`, variant.sku, variant.pricePkr, variant.compareAtPkr, variant.lowStockThreshold, variant.active ? 1 : 0, position)).lastInsertRowid;
            if (variant.stock > 0) await adjustStock(connection, { variantId, delta: variant.stock, expectedVersion: 1, reason: variant.stockReason ?? "Initial stock recorded for a new variant.", source: "INITIAL", sourceKey: `INITIAL:${id}:${variant.sku}`, actorUserId: actor.id });
          }
          await connection.prepare("INSERT INTO variant_option_values (variant_id, option_value_id) VALUES (?, ?)").run(variantId, valueId);
        }
      } catch (error) { if (error instanceof ApiError) throw error; if (error instanceof Error && error.message.includes("UNIQUE")) throw new ApiError(409, "CATALOG_CONFLICT", "The slug, SKU, or option value already exists."); throw error; }
    });
    return NextResponse.json({ id, version: input.version + 1 });
  } catch (error) { return apiErrorResponse(error); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authorizeAdminMutation(request); const id = z.coerce.number().int().positive().parse((await context.params).id);
    const archived = await withAdminAudit(actor, "catalog.product.delete", "product", String(id), {}, async (connection) => {
      const referenced = await connection.prepare(`SELECT
        (SELECT COUNT(*) FROM order_items WHERE product_id = ?) +
        (SELECT COUNT(*) FROM coupon_products WHERE product_id = ?) +
        (SELECT COUNT(*) FROM reviews WHERE product_id = ?) +
        (SELECT COUNT(*) FROM stock_movements sm JOIN variants v ON v.id = sm.variant_id WHERE v.product_id = ?) AS count`).get<{ count: number }>(id, id, id, id);
      if ((referenced?.count ?? 0) > 0) { await connection.prepare("UPDATE products SET status='ARCHIVED', version=version+1, updated_at=unixepoch()*1000 WHERE id=?").run(id); return true; }
      const result = await connection.prepare("DELETE FROM products WHERE id=?").run(id); if (!result.changes) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found."); return false;
    });
    return NextResponse.json({ id, archived });
  } catch (error) { return apiErrorResponse(error); }
}
