import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";

const schema = z.object({ action: z.enum(["PUBLISH", "ARCHIVE", "DUPLICATE"]), ids: z.array(z.number().int().positive()).min(1).max(500) }).strict().superRefine((value, context) => {
  if (value.action === "DUPLICATE" && value.ids.length !== 1) context.addIssue({ code: "custom", path: ["ids"], message: "Select exactly one product to duplicate." });
});

export async function POST(request: NextRequest) {
  try {
    const actor = await authorizeAdminMutation(request); const input = schema.parse(await request.json()); const ids = [...new Set(input.ids)];
    const result = await withAdminAudit(actor, `catalog.products.${input.action.toLowerCase()}`, "product_bulk", null, { ids }, async (connection) => {
      const placeholders = ids.map(() => "?").join(",");
      const count = await connection.prepare(`SELECT COUNT(*) AS count FROM products WHERE id IN (${placeholders})`).get<{ count: number }>(...ids);
      if (count?.count !== ids.length) throw new ApiError(404, "PRODUCT_NOT_FOUND", "One or more selected products no longer exist.");
      if (input.action !== "DUPLICATE") {
        await connection.prepare(`UPDATE products SET status = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE id IN (${placeholders})`).run(input.action === "PUBLISH" ? "PUBLISHED" : "ARCHIVED", ...ids);
        return { changed: ids.length, duplicatedId: null };
      }
      const sourceId = ids[0]; const source = await connection.prepare("SELECT * FROM products WHERE id = ?").get<Record<string, unknown>>(sourceId);
      if (!source) throw new ApiError(404, "PRODUCT_NOT_FOUND", "The selected product no longer exists.");
      const suffix = randomBytes(4).toString("hex");
      const inserted = await connection.prepare(`INSERT INTO products (slug, title, description, category_id, collection_id, status, is_featured, is_sample, seo_title, seo_description)
        VALUES (?, ?, ?, ?, ?, 'DRAFT', 0, ?, ?, ?)`).run(`${String(source.slug).slice(0, 165)}-copy-${suffix}`, `${String(source.title).slice(0, 150)} (copy)`, source.description, source.category_id, source.collection_id, source.is_sample, source.seo_title, source.seo_description);
      const productId = inserted.lastInsertRowid;
      await connection.prepare("INSERT INTO product_images (product_id, path, alt, position) SELECT ?, path, alt, position FROM product_images WHERE product_id = ?").run(productId, sourceId);
      const valueMap = new Map<number, number>();
      const options = await connection.prepare("SELECT id, name, required, position FROM product_options WHERE product_id = ? ORDER BY id").all<{ id: number; name: string; required: number; position: number }>(sourceId);
      for (const option of options) {
        const newOptionId = (await connection.prepare("INSERT INTO product_options (product_id, name, required, position) VALUES (?, ?, ?, ?)").run(productId, option.name, option.required, option.position)).lastInsertRowid;
        const values = await connection.prepare("SELECT id, value, position FROM option_values WHERE option_id = ? ORDER BY id").all<{ id: number; value: string; position: number }>(option.id);
        for (const value of values) valueMap.set(value.id, (await connection.prepare("INSERT INTO option_values (option_id, value, position) VALUES (?, ?, ?)").run(newOptionId, value.value, value.position)).lastInsertRowid);
      }
      const variants = await connection.prepare("SELECT id, title, sku, price_pkr AS pricePkr, compare_at_pkr AS compareAtPkr, low_stock_threshold AS threshold, active, position FROM variants WHERE product_id = ? ORDER BY id").all<{ id: number; title: string; sku: string; pricePkr: number; compareAtPkr: number | null; threshold: number; active: number; position: number }>(sourceId);
      for (const variant of variants) {
        const sku = `${variant.sku.slice(0, 38)}-COPY-${variant.id}-${suffix}`;
        const newVariantId = (await connection.prepare("INSERT INTO variants (product_id, title, sku, price_pkr, compare_at_pkr, stock, low_stock_threshold, active, position) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)").run(productId, variant.title, sku, variant.pricePkr, variant.compareAtPkr, variant.threshold, variant.active, variant.position)).lastInsertRowid;
        const links = await connection.prepare("SELECT option_value_id AS valueId FROM variant_option_values WHERE variant_id = ?").all<{ valueId: number }>(variant.id);
        for (const link of links) { const newValueId = valueMap.get(link.valueId); if (newValueId) await connection.prepare("INSERT INTO variant_option_values (variant_id, option_value_id) VALUES (?, ?)").run(newVariantId, newValueId); }
      }
      return { changed: 1, duplicatedId: productId };
    });
    return NextResponse.json(result);
  } catch (error) { return apiErrorResponse(error); }
}
