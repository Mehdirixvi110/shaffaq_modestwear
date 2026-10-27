import { NextRequest } from "next/server";
import { sqlite } from "@/db";
import { createCsv } from "@/lib/csv";
import { requireAdminRequest } from "@/server/auth";
import { csvResponse } from "@/server/csv-response";
import { apiErrorResponse } from "@/server/http";

export function GET(request: NextRequest) {
  try {
    requireAdminRequest(request);
    const rows = sqlite.prepare(`SELECT p.title, v.title AS variantTitle, v.sku, v.stock, v.low_stock_threshold AS threshold,
      v.active, v.version, v.updated_at AS updatedAt FROM variants v JOIN products p ON p.id = v.product_id
      ORDER BY p.title, v.position, v.id`).all() as Array<Record<string, unknown>>;
    return csvResponse(createCsv(["product", "variant", "sku", "stock", "low_stock_threshold", "active", "version", "updated_at"], rows.map((row) => [row.title, row.variantTitle, row.sku, row.stock, row.threshold, row.active, row.version, new Date(Number(row.updatedAt)).toISOString()])), "shaffaq-inventory.csv");
  } catch (error) { return apiErrorResponse(error); }
}
