import { NextRequest } from "next/server";
import { createCsv } from "@/lib/csv";
import { getAdminCustomers } from "@/server/admin-data";
import { requireAdminRequest } from "@/server/auth";
import { csvResponse } from "@/server/csv-response";
import { apiErrorResponse } from "@/server/http";

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const customers = await getAdminCustomers({ q: request.nextUrl.searchParams.get("q") ?? undefined });
    return csvResponse(createCsv(["customer_name", "email", "phone", "order_count", "ordered_pkr", "collected_pkr", "first_order_at", "last_order_at"], customers.map((customer) => [customer.customerName, customer.email, customer.phone, customer.orderCount, customer.orderedPkr, customer.collectedPkr, new Date(Number(customer.firstOrderAt)).toISOString(), new Date(Number(customer.lastOrderAt)).toISOString()])), "shaffaq-customers.csv");
  } catch (error) { return apiErrorResponse(error); }
}
