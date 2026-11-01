import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database } from "@/db";
import { createCsrfToken, hashToken, randomToken } from "@/lib/security";
import { apiErrorResponse, ApiError } from "@/server/http";
import { verifyPassword } from "@/server/password";
import { assertMutationRequest, privateCookie, SESSION_COOKIE, setCsrfCookie } from "@/server/protection";

const schema = z.object({ email: z.email().max(254), password: z.string().min(1).max(512) }).strict();

export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request);
    const body = schema.parse(await request.json());
    const user = await database.prepare("SELECT id, password_hash AS passwordHash, role FROM users WHERE email = ?")
      .get<{ id: number; passwordHash: string; role: string }>(body.email.trim().toLowerCase());
    if (!user || user.role !== "ADMIN" || !(await verifyPassword(user.passwordHash, body.password))) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }
    const rawToken = randomToken();
    await database.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
      .run(randomUUID(), user.id, hashToken(rawToken), Date.now() + 8 * 60 * 60 * 1000);
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SESSION_COOKIE, rawToken, { ...privateCookie, maxAge: 8 * 60 * 60 });
    setCsrfCookie(response, createCsrfToken());
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
