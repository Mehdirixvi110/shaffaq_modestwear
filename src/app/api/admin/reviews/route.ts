import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cleanText, nullableText } from "@/lib/validation";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse } from "@/server/http";
import { createAdminReview } from "@/server/reviews";

export const reviewFields = z.object({
  customerName: cleanText(100),
  city: nullableText(100),
  rating: z.number().int().min(1).max(5),
  title: nullableText(160),
  body: cleanText(3000),
  reviewDate: z.number().int().positive(),
  productId: z.number().int().positive().nullable(),
  featured: z.boolean(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const actor = await authorizeAdminMutation(request);
    const input = reviewFields.parse(await request.json());
    const id = await withAdminAudit(actor, "reviews.create", "review", null, { status: input.status, featured: input.featured }, (connection) => createAdminReview(connection, input));
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
