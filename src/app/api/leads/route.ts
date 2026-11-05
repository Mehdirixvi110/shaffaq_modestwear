import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database } from "@/db";
import { cleanText, normalizePkPhone, nullableText, pkPhoneRegex } from "@/lib/validation";
import { ApiError, apiErrorResponse } from "@/server/http";
import { assertMutationRequest } from "@/server/protection";
import { assertWithinRateLimit, clientIp } from "@/server/rate-limit";

const schema = z.object({
  source: z.enum(["PRODUCT_INQUIRY", "CONTACT"]),
  productId: z.number().int().positive().nullable(),
  variantId: z.number().int().positive().nullable().optional().default(null),
  customerName: cleanText(100),
  phone: z.string().trim().regex(pkPhoneRegex),
  city: nullableText(100),
  email: z.email().max(254).or(z.literal("")).nullable().optional().transform((value) => value || null),
  message: nullableText(1000),
  // Honeypot: a real person leaves this hidden field empty. A non-empty value is
  // treated as abuse and silently accepted without persisting a row.
  company: z.string().optional().default(""),
}).strict();

export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request);
    assertWithinRateLimit(clientIp(request), { limit: 5, windowMs: 600_000 });
    const input = schema.parse(await request.json());

    if (input.company.trim()) {
      return NextResponse.json({ received: true, message: "Thanks — we'll contact you shortly." }, { status: 201 });
    }

    // Server-authoritative snapshot: never trust client-sent product name/options.
    let productId: number | null = null;
    let productNameSnapshot: string | null = null;
    let selectedOptions: string | null = null;
    let variantSku: string | null = null;
    if (input.source === "PRODUCT_INQUIRY" && input.productId !== null) {
      const product = await database.prepare("SELECT id, title FROM products WHERE id = ?").get<{ id: number; title: string }>(input.productId);
      if (!product) throw new ApiError(422, "INVALID_PRODUCT", "The selected product is no longer available.");
      productId = product.id;
      productNameSnapshot = product.title;
      if (input.variantId !== null) {
        const variant = await database.prepare("SELECT id, sku FROM variants WHERE id = ? AND product_id = ?").get<{ id: number; sku: string }>(input.variantId, product.id);
        if (!variant) throw new ApiError(422, "INVALID_VARIANT", "The selected option is no longer available.");
        variantSku = variant.sku;
        const optionRows = await database.prepare(`SELECT po.name, ov.value FROM variant_option_values vov
          JOIN option_values ov ON ov.id = vov.option_value_id JOIN product_options po ON po.id = ov.option_id
          WHERE vov.variant_id = ? ORDER BY po.position, po.id`).all<{ name: string; value: string }>(variant.id);
        selectedOptions = JSON.stringify(Object.fromEntries(optionRows.map((row) => [row.name, row.value])));
      }
    }

    await database.prepare(`INSERT INTO leads (id, source, status, customer_name, phone, city, email, product_id, product_name_snapshot, selected_options, variant_sku, message)
      VALUES (?, ?, 'NEW', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(randomUUID(), input.source, input.customerName, normalizePkPhone(input.phone), input.city, input.email, productId, productNameSnapshot, selectedOptions, variantSku, input.message);

    return NextResponse.json({ received: true, message: "Thanks — we'll contact you shortly." }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
