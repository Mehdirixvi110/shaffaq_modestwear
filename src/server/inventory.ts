import type Database from "better-sqlite3";
import { sqlite } from "@/db";
import { applyStockAdjustment } from "@/lib/inventory";
import { ApiError } from "./http";

export type StockSource = "CHECKOUT" | "ORDER_CONFIRM" | "ORDER_CANCEL" | "MANUAL" | "INITIAL" | "PRODUCT_IMPORT";

type AdjustmentInput = {
  variantId: number;
  delta: number;
  expectedVersion: number;
  reason: string;
  source: StockSource;
  sourceKey?: string | null;
  orderId?: string | null;
  actorUserId?: number | null;
};

function inventoryError(error: unknown): never {
  if (!(error instanceof Error)) throw error;
  if (error.message === "VERSION_CONFLICT") throw new ApiError(409, "VERSION_CONFLICT", "Stock changed in another session. Reload and try again.");
  if (error.message === "STOCK_NEGATIVE") throw new ApiError(409, "STOCK_NEGATIVE", "This adjustment would make stock negative.");
  if (error.message === "INVALID_ADJUSTMENT" || error.message === "STOCK_LIMIT") throw new ApiError(422, "INVALID_ADJUSTMENT", "Enter a nonzero adjustment within the supported stock range.");
  throw error;
}

export function adjustStock(connection: Database.Database, input: AdjustmentInput) {
  const reason = input.reason.trim();
  if (!reason) throw new ApiError(422, "ADJUSTMENT_REASON_REQUIRED", "A reason is required for every stock adjustment.");
  if (input.sourceKey) {
    const existing = connection.prepare(`SELECT sm.id AS movementId, sm.variant_id AS variantId, sm.stock_after AS stock, v.version
      FROM stock_movements sm JOIN variants v ON v.id = sm.variant_id
      WHERE sm.source_key = ?`).get(input.sourceKey) as { movementId: number; variantId: number; stock: number; version: number } | undefined;
    if (existing) {
      if (existing.variantId !== input.variantId) throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "This adjustment key was already used for another variant.");
      return { movementId: existing.movementId, stock: existing.stock, version: existing.version };
    }
  }
  const current = connection.prepare("SELECT stock, version FROM variants WHERE id = ?").get(input.variantId) as { stock: number; version: number } | undefined;
  if (!current) throw new ApiError(404, "VARIANT_NOT_FOUND", "Variant not found.");
  let next;
  try { next = applyStockAdjustment(current.stock, input.delta, input.expectedVersion, current.version); } catch (error) { inventoryError(error); }
  const updated = connection.prepare("UPDATE variants SET stock = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND version = ? AND stock = ?")
    .run(next.stockAfter, input.variantId, input.expectedVersion, current.stock);
  if (updated.changes !== 1) throw new ApiError(409, "VERSION_CONFLICT", "Stock changed in another session. Reload and try again.");
  const movement = connection.prepare(`INSERT INTO stock_movements
    (variant_id, delta, stock_before, stock_after, reason, source, source_key, order_id, actor_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(input.variantId, input.delta, current.stock, next.stockAfter, reason, input.source, input.sourceKey ?? null, input.orderId ?? null, input.actorUserId ?? null);
  return { movementId: Number(movement.lastInsertRowid), stock: next.stockAfter, version: next.version };
}

export function adjustStockImmediately(input: AdjustmentInput) {
  return sqlite.transaction(() => adjustStock(sqlite, input)).immediate();
}
