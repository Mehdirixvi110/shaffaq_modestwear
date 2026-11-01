import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";
import { adjustStock } from "@/server/inventory";

const schema = z.object({ action: z.enum(["CONFIRM", "PROCESS", "SHIP", "DELIVER", "CANCEL", "MARK_COD_COLLECTED"]), reason: z.string().trim().max(500).nullable(), courierName: z.string().trim().max(120).nullable(), trackingNumber: z.string().trim().max(120).nullable(), expectedVersion: z.number().int().positive() }).strict();
type OrderRow = { id: string; source: string; orderStatus: string; fulfillmentStatus: string; paymentStatus: string; stockAllocated: number; stockReleased: number; version: number };
type ItemRow = { variantId: number | null; quantity: number; productTitle: string };

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authorizeAdminMutation(request); const id = z.uuid().parse((await context.params).id); const input = schema.parse(await request.json());
    const state = await withAdminAudit(actor, `orders.${input.action.toLowerCase()}`, "order", id, { action: input.action, reason: input.reason }, async (connection) => {
      const order = await connection.prepare(`SELECT id, source, order_status AS orderStatus, fulfillment_status AS fulfillmentStatus,
        payment_status AS paymentStatus, stock_allocated AS stockAllocated, stock_released AS stockReleased, version FROM orders WHERE id = ?${connection.provider === "postgres" ? " FOR UPDATE" : ""}`).get<OrderRow>(id);
      if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
      if (order.version !== input.expectedVersion) throw new ApiError(409, "VERSION_CONFLICT", "This order changed in another session. Reload and try again.");
      let orderStatus = order.orderStatus; let fulfillmentStatus = order.fulfillmentStatus; let paymentStatus = order.paymentStatus; let allocated = Boolean(order.stockAllocated); let released = Boolean(order.stockReleased); let note = input.reason; let cancellationReason: string | null = null;
      if (input.action === "CONFIRM") {
        if (!["INQUIRY", "PENDING_CONFIRMATION"].includes(orderStatus) || fulfillmentStatus !== "UNFULFILLED") throw new ApiError(409, "ILLEGAL_TRANSITION", "This order cannot be confirmed from its current state.");
        if (!allocated) {
          const items = await connection.prepare("SELECT variant_id AS variantId, quantity, product_title AS productTitle FROM order_items WHERE order_id = ? ORDER BY id").all<ItemRow>(id);
          for (const item of items) {
            if (!item.variantId) throw new ApiError(409, "STOCK_CHANGED", "A product variant is no longer available.");
            const variant = await connection.prepare("SELECT version FROM variants WHERE id = ?").get<{ version: number }>(item.variantId);
            if (!variant) throw new ApiError(409, "STOCK_CHANGED", `${item.productTitle} is no longer available.`);
            await adjustStock(connection, { variantId: item.variantId, delta: -item.quantity, expectedVersion: variant.version, reason: `Allocated when ${id} was confirmed.`, source: "ORDER_CONFIRM", sourceKey: `${id}:${item.variantId}:ORDER_CONFIRM`, orderId: id, actorUserId: actor.id });
          }
          allocated = true;
        }
        orderStatus = "CONFIRMED"; note = note ?? "Order confirmed by administrator.";
      } else if (input.action === "PROCESS") {
        if (orderStatus !== "CONFIRMED" || fulfillmentStatus !== "UNFULFILLED" || !allocated) throw new ApiError(409, "ILLEGAL_TRANSITION", "This order cannot begin processing.");
        fulfillmentStatus = "PROCESSING"; note = input.reason ?? "Fulfilment processing started.";
      } else if (input.action === "SHIP") {
        if (orderStatus !== "CONFIRMED" || fulfillmentStatus !== "PROCESSING" || !input.courierName || !input.trackingNumber) throw new ApiError(409, "ILLEGAL_TRANSITION", "Courier and tracking details are required before dispatch.");
        fulfillmentStatus = "SHIPPED"; note = input.reason ?? `Dispatched with ${input.courierName}.`;
        await connection.prepare("UPDATE orders SET courier_name = ?, tracking_number = ? WHERE id = ?").run(input.courierName, input.trackingNumber, id);
      } else if (input.action === "DELIVER") {
        if (orderStatus !== "CONFIRMED" || fulfillmentStatus !== "SHIPPED") throw new ApiError(409, "ILLEGAL_TRANSITION", "Only a shipped order can be marked delivered.");
        fulfillmentStatus = "DELIVERED"; note = input.reason ?? "Delivery recorded by administrator.";
      } else if (input.action === "CANCEL") {
        if (orderStatus === "CANCELLED" || ["SHIPPED", "DELIVERED"].includes(fulfillmentStatus) || !input.reason || input.reason.length < 3) throw new ApiError(409, "ILLEGAL_TRANSITION", "A reason is required and shipped orders cannot be cancelled here.");
        if (allocated && !released) {
          const items = await connection.prepare("SELECT variant_id AS variantId, quantity, product_title AS productTitle FROM order_items WHERE order_id = ?").all<ItemRow>(id);
          for (const item of items) if (item.variantId) {
            const variant = await connection.prepare("SELECT version FROM variants WHERE id = ?").get<{ version: number }>(item.variantId);
            if (variant) await adjustStock(connection, { variantId: item.variantId, delta: item.quantity, expectedVersion: variant.version, reason: `Released after cancellation: ${input.reason}`, source: "ORDER_CANCEL", sourceKey: `${id}:${item.variantId}:ORDER_CANCEL`, orderId: id, actorUserId: actor.id });
          }
          released = true;
        }
        orderStatus = "CANCELLED"; fulfillmentStatus = "UNFULFILLED"; cancellationReason = input.reason;
      } else {
        if (orderStatus !== "CONFIRMED" || paymentStatus !== "UNPAID" || order.source !== "STOREFRONT_COD") throw new ApiError(409, "ILLEGAL_TRANSITION", "COD collection cannot be recorded in the current state.");
        paymentStatus = "PAID"; note = input.reason ?? "Administrator recorded cash collection. This is an internal ledger event.";
      }
      const update = await connection.prepare(`UPDATE orders SET order_status = ?, fulfillment_status = ?, payment_status = ?, stock_allocated = ?, stock_released = ?,
        cancellation_reason = COALESCE(?, cancellation_reason), version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND version = ?`)
        .run(orderStatus, fulfillmentStatus, paymentStatus, allocated ? 1 : 0, released ? 1 : 0, cancellationReason, id, input.expectedVersion);
      if (update.changes !== 1) throw new ApiError(409, "VERSION_CONFLICT", "This order changed in another session. Reload and try again.");
      await connection.prepare("INSERT INTO order_history (order_id, event, note, actor_user_id) VALUES (?, ?, ?, ?)").run(id, input.action, note, actor.id);
      return { orderStatus, fulfillmentStatus, paymentStatus, version: input.expectedVersion + 1 };
    });
    return NextResponse.json(state);
  } catch (error) { return apiErrorResponse(error); }
}
