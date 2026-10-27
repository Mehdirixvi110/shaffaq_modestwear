import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sqlite } from "@/db";
import { hashToken, randomToken } from "@/lib/security";
import { apiErrorResponse, ApiError } from "@/server/http";
import { verifyPassword } from "@/server/password";
import { assertMutationRequest, privateCookie, SESSION_COOKIE, setCsrfCookie } from "@/server/protection";
import { createCsrfToken } from "@/lib/security";

const schema = z.object({ email: z.email().max(254), password: z.string().min(1).max(512) }).strict();

export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request);
    const body = schema.parse(await request.json());
    const user = sqlite.prepare("SELECT id, password_hash AS passwordHash, role FROM users WHERE email = ?")
      .get(body.email.trim().toLowerCase()) as { id: number; passwordHash: string; role: string } | undefined;
    if (!user || user.role !== "ADMIN" || !(await verifyPassword(user.passwordHash, body.password))) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }
    const rawToken = randomToken();
    sqlite.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
      .run(randomUUID(), user.id, hashToken(rawToken), Date.now() + 8 * 60 * 60 * 1000);
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SESSION_COOKIE, rawToken, { ...privateCookie, maxAge: 8 * 60 * 60 });
    setCsrfCookie(response, createCsrfToken());
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
