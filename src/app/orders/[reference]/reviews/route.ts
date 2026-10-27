import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sqlite } from "@/db";
import { getOrderForCustomer } from "@/server/checkout";
import { apiErrorResponse, ApiError } from "@/server/http";
import { assertMutationRequest, ORDER_ACCESS_COOKIE } from "@/server/protection";

const schema = z.object({ orderItemId: z.number().int().positive(), rating: z.number().int().min(1).max(5), title: z.string().trim().max(120).nullable(), body: z.string().trim().min(10).max(3000) }).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  try {
    assertMutationRequest(request);
    const reference = z.string().trim().min(1).max(40).parse((await context.params).reference);
    const order = getOrderForCustomer(reference, request.cookies.get(ORDER_ACCESS_COOKIE)?.value) as { id: string; customerName: string; orderStatus: string; fulfillmentStatus: string } | null;
    if (!order) throw new ApiError(404, "ORDER_ACCESS_UNAVAILABLE", "Order access is unavailable.");
    if (order.orderStatus !== "CONFIRMED" || order.fulfillmentStatus !== "DELIVERED") throw new ApiError(409, "REVIEW_NOT_ALLOWED", "A review can be submitted only after delivery.");
    const input = schema.parse(await request.json());
    const item = sqlite.prepare("SELECT product_id AS productId FROM order_items WHERE id = ? AND order_id = ?").get(input.orderItemId, order.id) as { productId: number | null } | undefined;
    if (!item?.productId) throw new ApiError(404, "ORDER_ITEM_NOT_FOUND", "This delivered item is unavailable for review.");
    try {
      const id = randomUUID();
      sqlite.transaction(() => {
        sqlite.prepare(`INSERT INTO reviews (id, product_id, order_id, order_item_id, customer_name, rating, title, body)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, item.productId, order.id, input.orderItemId, order.customerName, input.rating, input.title, input.body);
        sqlite.prepare("INSERT INTO order_history (order_id, event, note) VALUES (?, 'REVIEW_SUBMITTED', ?)").run(order.id, `Review submitted for order item ${input.orderItemId}; pending moderation.`);
      }).immediate();
      return NextResponse.json({ id, status: "PENDING" }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE")) throw new ApiError(409, "REVIEW_ALREADY_SUBMITTED", "A review has already been submitted for this item.");
      throw error;
    }
  } catch (error) { return apiErrorResponse(error); }
}
