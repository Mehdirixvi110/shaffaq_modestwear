import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { buildGoogleAuthUrl, createPkcePair, googleOAuthConfigured } from "@/server/google-oauth";

export const runtime = "nodejs";

const APP_ORIGIN = () => process.env.APP_ORIGIN || "http://127.0.0.1:3000";

export async function GET() {
  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/admin/login?error=google_unavailable", APP_ORIGIN()));
  }
  const state = randomBytes(24).toString("base64url");
  const { verifier, challenge } = createPkcePair();
  const response = NextResponse.redirect(buildGoogleAuthUrl({ state, codeChallenge: challenge }));
  // Short-lived, HttpOnly, SameSite=Lax so the cookies survive Google's top-level
  // redirect back to the callback. Secure is keyed to an HTTPS origin so local
  // http dev still works. Scoped to the google auth path only.
  const secure = APP_ORIGIN().startsWith("https://");
  const options = { httpOnly: true, secure, sameSite: "lax" as const, path: "/api/auth/google", maxAge: 600 };
  response.cookies.set("g_oauth_state", state, options);
  response.cookies.set("g_oauth_verifier", verifier, options);
  return response;
}
