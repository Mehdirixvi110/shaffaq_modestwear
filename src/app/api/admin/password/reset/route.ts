import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/server/http";
import { assertMutationRequest } from "@/server/protection";
import { assertWithinRateLimit, clientIp } from "@/server/rate-limit";
import { resetPasswordWithCode } from "@/server/password-reset";

export const runtime = "nodejs";

const schema = z.object({
  email: z.email().max(254),
  code: z.string().trim().min(4).max(12),
  password: z.string().min(1).max(512),
}).strict();

export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request);
    assertWithinRateLimit(`pwreset:reset:${clientIp(request)}`, { limit: 10, windowMs: 15 * 60 * 1000 });
    const body = schema.parse(await request.json());
    await resetPasswordWithCode(body.email, body.code, body.password);
    return NextResponse.json({ ok: true, message: "Password updated. You can now sign in." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
