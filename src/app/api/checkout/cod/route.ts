import { NextRequest, NextResponse } from "next/server";
import { checkoutSchema } from "@/lib/validation";
import { checkout } from "@/server/checkout";
import { apiErrorResponse } from "@/server/http";
import { assertMutationRequest, CART_COOKIE, CHECKOUT_SUBJECT_COOKIE, ORDER_ACCESS_COOKIE, privateCookie } from "@/server/protection";

export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request);
    const input = checkoutSchema.parse(await request.json());
    const { result, accessToken } = await checkout(input, "STOREFRONT_COD", request.cookies.get(CART_COOKIE)?.value, request.cookies.get(CHECKOUT_SUBJECT_COOKIE)?.value);
    const response = NextResponse.json(result, { status: 201 });
    response.cookies.set(ORDER_ACCESS_COOKIE, accessToken, { ...privateCookie, sameSite: "strict", path: `/orders/${result.reference}`, maxAge: 90 * 24 * 60 * 60 });
    response.cookies.set(CART_COOKIE, "", { ...privateCookie, maxAge: 0 });
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
