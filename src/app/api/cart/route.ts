import { NextRequest, NextResponse } from "next/server";
import { readCart } from "@/server/cart";
import { CART_COOKIE } from "@/server/protection";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return NextResponse.json(readCart(request.cookies.get(CART_COOKIE)?.value), { headers: { "Cache-Control": "no-store" } });
}
