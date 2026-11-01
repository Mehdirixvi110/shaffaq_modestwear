import { NextRequest, NextResponse } from "next/server";
import { createCsrfToken } from "@/lib/security";
import { apiErrorResponse } from "@/server/http";
import { deleteSession } from "@/server/auth";
import { assertMutationRequest, privateCookie, SESSION_COOKIE, setCsrfCookie } from "@/server/protection";

export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request);
    await deleteSession(request.cookies.get(SESSION_COOKIE)?.value);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", { ...privateCookie, maxAge: 0 });
    setCsrfCookie(response, createCsrfToken());
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
