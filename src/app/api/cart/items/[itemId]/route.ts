import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateCartItem } from "@/server/cart";
import { apiErrorResponse } from "@/server/http";
import { assertMutationRequest, CART_COOKIE } from "@/server/protection";

const updateSchema = z.object({ quantity: z.number().int().min(1).max(20) }).strict();

export async function PATCH(request: NextRequest, context: { params: Promise<{ itemId: string }> }) {
  try {
    assertMutationRequest(request);
    const { itemId } = await context.params;
    const body = updateSchema.parse(await request.json());
    const state = await updateCartItem(request.cookies.get(CART_COOKIE)?.value, z.coerce.number().int().positive().parse(itemId), body.quantity);
    return NextResponse.json(state);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ itemId: string }> }) {
  try {
    assertMutationRequest(request);
    const { itemId } = await context.params;
    const state = await updateCartItem(request.cookies.get(CART_COOKIE)?.value, z.coerce.number().int().positive().parse(itemId), null);
    return NextResponse.json(state);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
