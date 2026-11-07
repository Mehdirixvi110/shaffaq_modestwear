import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, ApiError } from "@/server/http";
import { assertMutationRequest } from "@/server/protection";
import { assertWithinRateLimit, clientIp } from "@/server/rate-limit";
import { emailConfigured } from "@/server/email";
import { requestPasswordReset } from "@/server/password-reset";

export const runtime = "nodejs";

const schema = z.object({ email: z.email().max(254) }).strict();

export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request);
    assertWithinRateLimit(`pwreset:forgot:${clientIp(request)}`, { limit: 5, windowMs: 15 * 60 * 1000 });
    const body = schema.parse(await request.json());
    if (!emailConfigured()) {
      throw new ApiError(503, "EMAIL_NOT_CONFIGURED", "Email recovery is not set up yet. The site owner must configure Gmail SMTP (SMTP_USER + SMTP_PASS) in the server environment.");
    }
    await requestPasswordReset(body.email);
    return NextResponse.json({ ok: true, message: "If an administrator uses that email, a reset code has been sent. Check the inbox (and spam)." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
