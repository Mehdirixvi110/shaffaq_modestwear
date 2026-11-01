import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database } from "@/db";
import { getOrderForCustomer } from "@/server/checkout";
import { apiErrorResponse, ApiError } from "@/server/http";
import { assertMutationRequest, ORDER_ACCESS_COOKIE } from "@/server/protection";

const schema = z.object({ kind: z.enum(["RETURN", "EXCHANGE"]), reason: z.string().trim().min(10).max(1000) }).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  try {
    assertMutationRequest(request);
    const reference = z.string().trim().min(1).max(40).parse((await context.params).reference);
    const order = await getOrderForCustomer(reference, request.cookies.get(ORDER_ACCESS_COOKIE)?.value) as { id: string; orderStatus: string; fulfillmentStatus: string } | null;
    if (!order) throw new ApiError(404, "ORDER_ACCESS_UNAVAILABLE", "Order access is unavailable.");
    if (order.orderStatus !== "CONFIRMED" || order.fulfillmentStatus !== "DELIVERED") throw new ApiError(409, "REQUEST_NOT_ALLOWED", "Return or exchange requests are available only after delivery.");
    const input = schema.parse(await request.json());
    const id = randomUUID();
    await database.transaction(async () => {
      if (database.provider === "postgres") await database.prepare("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))").get(`return:${order.id}:${input.kind}`);
      const open = await database.prepare(`SELECT 1 FROM return_requests WHERE order_id = ? AND kind = ? AND status IN ('REQUESTED','APPROVED','RECEIVED')${database.provider === "postgres" ? " FOR UPDATE" : ""}`).get(order.id, input.kind);
      if (open) throw new ApiError(409, "REQUEST_ALREADY_OPEN", `An open ${input.kind.toLowerCase()} request already exists for this order.`);
      await database.prepare("INSERT INTO return_requests (id, order_id, kind, reason) VALUES (?, ?, ?, ?)").run(id, order.id, input.kind, input.reason);
      await database.prepare("INSERT INTO order_history (order_id, event, note) VALUES (?, 'CUSTOMER_REQUEST', ?)").run(order.id, `${input.kind}: ${input.reason}`);
    }).immediate();
    return NextResponse.json({ id, status: "REQUESTED" }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
