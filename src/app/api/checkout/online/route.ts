import { NextRequest, NextResponse } from "next/server";
import { onlinePaymentsEnabled } from "@/lib/payments/config";
import { checkoutSchema } from "@/lib/validation";
import { ApiError, apiErrorResponse } from "@/server/http";
import { resolveProvider } from "@/server/payments/provider";
import { beginOnlineCheckout } from "@/server/payments/service";
import { assertMutationRequest, CART_COOKIE, CHECKOUT_SUBJECT_COOKIE, ORDER_ACCESS_COOKIE, privateCookie } from "@/server/protection";

export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request);
    // Server-authoritative fail-closed gate: a forged request while no provider is
    // configured is refused here, not merely hidden by the UI (FR-5.3, AC9).
    const provider = onlinePaymentsEnabled(process.env) ? resolveProvider("safepay", process.env) : null;
    if (!provider) throw new ApiError(404, "PAYMENT_PROVIDER_UNAVAILABLE", "Online payment is not available.");
    const input = checkoutSchema.parse(await request.json());
    const { result, accessToken } = await beginOnlineCheckout(input, request.cookies.get(CART_COOKIE)?.value, request.cookies.get(CHECKOUT_SUBJECT_COOKIE)?.value, provider);
    const response = NextResponse.json(result, { status: 201 });
    // SameSite=Lax (not strict) so the gateway's cross-site top-level GET return
    // sends the cookie and the acknowledgement renders over real server state.
    // The cart cookie is intentionally NOT cleared (retry-after-failure, §5.4).
    response.cookies.set(ORDER_ACCESS_COOKIE, accessToken, { ...privateCookie, sameSite: "lax", path: `/orders/${result.reference}`, maxAge: 90 * 24 * 60 * 60 });
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
