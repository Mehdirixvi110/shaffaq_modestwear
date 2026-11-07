import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { database } from "@/db";
import { createCsrfToken, hashToken, randomToken } from "@/lib/security";
import { exchangeGoogleCode, fetchGoogleEmail, googleOAuthConfigured } from "@/server/google-oauth";
import { privateCookie, SESSION_COOKIE, setCsrfCookie } from "@/server/protection";

export const runtime = "nodejs";

function base(request: NextRequest): string {
  return process.env.APP_ORIGIN || request.nextUrl.origin;
}

function clearFlowCookies(response: NextResponse): NextResponse {
  response.cookies.set("g_oauth_state", "", { path: "/api/auth/google", maxAge: 0 });
  response.cookies.set("g_oauth_verifier", "", { path: "/api/auth/google", maxAge: 0 });
  return response;
}

function toLogin(request: NextRequest, error?: string): NextResponse {
  const url = new URL("/admin/login", base(request));
  if (error) url.searchParams.set("error", error);
  return clearFlowCookies(NextResponse.redirect(url));
}

export async function GET(request: NextRequest) {
  try {
    if (!googleOAuthConfigured()) return toLogin(request, "google_unavailable");
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const cookieState = request.cookies.get("g_oauth_state")?.value;
    const verifier = request.cookies.get("g_oauth_verifier")?.value;
    if (!code || !state || !cookieState || !verifier || state !== cookieState) {
      return toLogin(request, "google_state");
    }
    const accessToken = await exchangeGoogleCode(code, verifier);
    const { email, emailVerified } = await fetchGoogleEmail(accessToken);
    if (!emailVerified) return toLogin(request, "google_unverified");
    const user = await database.prepare("SELECT id, role FROM users WHERE email = ?").get<{ id: number; role: string }>(email);
    if (!user || user.role !== "ADMIN") return toLogin(request, "google_not_admin");

    const rawToken = randomToken();
    await database.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
      .run(randomUUID(), user.id, hashToken(rawToken), Date.now() + 8 * 60 * 60 * 1000);
    const response = NextResponse.redirect(new URL("/admin", base(request)));
    response.cookies.set(SESSION_COOKIE, rawToken, { ...privateCookie, maxAge: 8 * 60 * 60 });
    setCsrfCookie(response, createCsrfToken());
    return clearFlowCookies(response);
  } catch {
    return toLogin(request, "google_failed");
  }
}
