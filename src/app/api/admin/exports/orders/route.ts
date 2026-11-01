import { NextRequest } from "next/server";
import { createCsv } from "@/lib/csv";
import { getAdminOrders } from "@/server/admin-data";
import { requireAdminRequest } from "@/server/auth";
import { csvResponse } from "@/server/csv-response";
import { apiErrorResponse } from "@/server/http";

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const query = request.nextUrl.searchParams;
    const orders = await getAdminOrders({ q: query.get("q") ?? undefined, orderStatus: query.get("orderStatus") ?? undefined, fulfillmentStatus: query.get("fulfillmentStatus") ?? undefined, source: query.get("source") ?? undefined });
    return csvResponse(createCsv(["reference", "source", "customer_name", "email", "phone", "city", "order_status", "fulfillment_status", "payment_status", "subtotal_pkr", "discount_pkr", "tax_pkr", "shipping_pkr", "total_pkr", "coupon_code", "courier", "tracking", "created_at"], orders.map((order) => [order.reference, order.source, order.customerName, order.email, order.phone, order.city, order.orderStatus, order.fulfillmentStatus, order.paymentStatus, order.subtotalPkr, order.discountPkr, order.taxPkr, order.shippingPkr, order.totalPkr, order.couponCode, order.courierName, order.trackingNumber, new Date(Number(order.createdAt)).toISOString()])), "shaffaq-orders.csv");
  } catch (error) { return apiErrorResponse(error); }
}
