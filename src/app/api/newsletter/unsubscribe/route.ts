import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database } from "@/db";
import { hashToken } from "@/lib/security";
import { apiErrorResponse, ApiError } from "@/server/http";
import { assertMutationRequest } from "@/server/protection";

const schema = z.object({ token: z.string().min(32).max(200) }).strict();

export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request); const input = schema.parse(await request.json());
    const update = await database.prepare("UPDATE newsletter_subscriptions SET unsubscribed_at = ?, updated_at = unixepoch() * 1000 WHERE unsubscribe_token_hash = ? AND unsubscribed_at IS NULL").run(Date.now(), hashToken(input.token));
    if (update.changes !== 1) throw new ApiError(404, "UNSUBSCRIBE_UNAVAILABLE", "This unsubscribe link is invalid or has already been used.");
    return NextResponse.json({ unsubscribed: true });
  } catch (error) { return apiErrorResponse(error); }
}
