import { createHash, randomBytes } from "node:crypto";

// Lean Google OAuth 2.0 (authorization-code + PKCE) for admin sign-in. No extra
// dependency: the authorization URL is built here, and the code is exchanged +
// the email read via Google's token/userinfo endpoints over TLS using fetch.
// Admission is decided by the callback: the verified Google email must match an
// existing ADMIN user, so only the store's admin Gmail can sign in.
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function appOrigin(): string {
  return (process.env.APP_ORIGIN || "http://127.0.0.1:3000").replace(/\/$/, "");
}

export function googleRedirectUri(): string {
  return `${appOrigin()}/api/auth/google/callback`;
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildGoogleAuthUrl(params: { state: string; codeChallenge: string }): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function exchangeGoogleCode(code: string, codeVerifier: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: googleRedirectUri(),
  });
  const response = await fetch(TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error(`Google token exchange failed (${response.status}).`);
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google token exchange returned no access token.");
  return data.access_token;
}

export async function fetchGoogleEmail(accessToken: string): Promise<{ email: string; emailVerified: boolean }> {
  const response = await fetch(USERINFO_ENDPOINT, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Google userinfo failed (${response.status}).`);
  const data = (await response.json()) as { email?: string; email_verified?: boolean };
  if (!data.email) throw new Error("Google userinfo returned no email.");
  return { email: data.email.trim().toLowerCase(), emailVerified: Boolean(data.email_verified) };
}
