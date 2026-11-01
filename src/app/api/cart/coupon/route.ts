import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setCartCoupon } from "@/server/cart";
import { apiErrorResponse } from "@/server/http";
import { assertMutationRequest, CART_COOKIE } from "@/server/protection";

const schema = z.object({ code: z.string().trim().max(40).nullable() }).strict();

export async function PATCH(request: NextRequest) {
  try {
    assertMutationRequest(request);
    const input = schema.parse(await request.json());
    return NextResponse.json(await setCartCoupon(request.cookies.get(CART_COOKIE)?.value, input.code));
  } catch (error) { return apiErrorResponse(error); }
}
