import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/server/http";
import { assertMutationRequest, privateCookie, WISHLIST_COOKIE } from "@/server/protection";
import { readWishlist, updateWishlist } from "@/server/wishlist";

const schema = z.object({ productId: z.number().int().positive(), action: z.enum(["ADD", "REMOVE"]) }).strict();

export function GET(request: NextRequest) {
  return NextResponse.json(readWishlist(request.cookies.get(WISHLIST_COOKIE)?.value), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request);
    const input = schema.parse(await request.json());
    const result = updateWishlist(request.cookies.get(WISHLIST_COOKIE)?.value, input.productId, input.action);
    const response = NextResponse.json(result.state);
    response.cookies.set(WISHLIST_COOKIE, result.token, { ...privateCookie, maxAge: 400 * 24 * 60 * 60 });
    return response;
  } catch (error) { return apiErrorResponse(error); }
}
