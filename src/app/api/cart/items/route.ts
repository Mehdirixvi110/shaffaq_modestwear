import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addCartItem } from "@/server/cart";
import { apiErrorResponse } from "@/server/http";
import { assertMutationRequest, CART_COOKIE, privateCookie } from "@/server/protection";

const schema = z.object({ variantId: z.number().int().positive(), quantity: z.number().int().min(1).max(20) }).strict();

export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request);
    const body = schema.parse(await request.json());
    const result = await addCartItem(request.cookies.get(CART_COOKIE)?.value, body.variantId, body.quantity);
    const response = NextResponse.json(result.state);
    response.cookies.set(CART_COOKIE, result.token, { ...privateCookie, maxAge: 30 * 24 * 60 * 60 });
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
