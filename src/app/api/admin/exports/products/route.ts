import { NextRequest } from "next/server";
import { database } from "@/db";
import { createCsv } from "@/lib/csv";
import { requireAdminRequest } from "@/server/auth";
import { csvResponse } from "@/server/csv-response";
import { apiErrorResponse } from "@/server/http";

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const rows = await database.prepare(`SELECT p.slug AS productSlug, p.title, p.description, p.status, c.slug AS categorySlug,
      cl.slug AS collectionSlug, (SELECT path FROM product_images WHERE product_id = p.id ORDER BY position, id LIMIT 1) AS imagePath,
      p.is_featured AS featured, p.is_sample AS sample, p.seo_title AS seoTitle, p.seo_description AS seoDescription,
      COALESCE(po.name, 'Option') AS optionName, COALESCE(ov.value, v.title) AS optionValue, v.sku,
      v.price_pkr AS pricePkr, v.compare_at_pkr AS compareAtPkr, v.stock, v.low_stock_threshold AS lowStockThreshold,
      v.active FROM products p JOIN variants v ON v.product_id = p.id
      LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN collections cl ON cl.id = p.collection_id
      LEFT JOIN variant_option_values vov ON vov.variant_id = v.id LEFT JOIN option_values ov ON ov.id = vov.option_value_id
      LEFT JOIN product_options po ON po.id = ov.option_id ORDER BY p.id, v.position, v.id`).all<Record<string, unknown>>();
    return csvResponse(createCsv(["product_slug", "title", "description", "status", "category_slug", "collection_slug", "image_path", "featured", "sample", "seo_title", "seo_description", "option_name", "option_value", "sku", "price_pkr", "compare_at_pkr", "stock", "low_stock_threshold", "active"], rows.map((row) => [row.productSlug, row.title, row.description, row.status, row.categorySlug, row.collectionSlug, row.imagePath, row.featured, row.sample, row.seoTitle, row.seoDescription, row.optionName, row.optionValue, row.sku, row.pricePkr, row.compareAtPkr, row.stock, row.lowStockThreshold, row.active])), "shaffaq-products.csv");
  } catch (error) { return apiErrorResponse(error); }
}
