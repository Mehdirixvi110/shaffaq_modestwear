import type { NextRequest, NextResponse } from "next/server";
import { ApiError } from "./http";
import { createCsrfToken, randomToken, verifyCsrfToken } from "@/lib/security";

export const CSRF_COOKIE = "shaffaq_csrf";
export const SESSION_COOKIE = "shaffaq_session";
export const CART_COOKIE = "shaffaq_cart";
export const CHECKOUT_SUBJECT_COOKIE = "shaffaq_checkout_subject";
export const ORDER_ACCESS_COOKIE = "shaffaq_order_access";
export const WISHLIST_COOKIE = "shaffaq_wishlist";

function secureCookies() {
  return (process.env.APP_ORIGIN ?? "").startsWith("https://");
}

export const privateCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: secureCookies(),
  path: "/",
};

export function setCsrfCookie(response: NextResponse, token: string) {
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    maxAge: 8 * 60 * 60,
  });
}

export function ensureProtectionCookies(request: NextRequest, response: NextResponse) {
  const current = request.cookies.get(CSRF_COOKIE)?.value;
  const csrfToken = current && verifyCsrfToken(current) ? current : createCsrfToken();
  if (csrfToken !== current) setCsrfCookie(response, csrfToken);
  if (!request.cookies.get(CHECKOUT_SUBJECT_COOKIE)?.value) {
    response.cookies.set(CHECKOUT_SUBJECT_COOKIE, randomToken(), { ...privateCookie, maxAge: 400 * 24 * 60 * 60 });
  }
  return csrfToken;
}

export function assertMutationRequest(request: NextRequest) {
  const expectedOrigin = process.env.APP_ORIGIN ?? new URL(request.url).origin;
  if (request.headers.get("origin") !== expectedOrigin) {
    throw new ApiError(403, "ORIGIN_REJECTED", "The request origin was rejected.");
  }
  const cookie = request.cookies.get(CSRF_COOKIE)?.value;
  const header = request.headers.get("x-csrf-token");
  if (!cookie || !header || cookie !== header || !verifyCsrfToken(cookie)) {
    throw new ApiError(403, "CSRF_REJECTED", "Refresh the page and try again.");
  }
}
