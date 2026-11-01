import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database } from "@/db";
import { hashToken, randomToken } from "@/lib/security";
import { apiErrorResponse } from "@/server/http";
import { assertMutationRequest } from "@/server/protection";

const schema = z.object({ email: z.email().max(254), consent: z.literal(true), source: z.enum(["FOOTER"]) }).strict();

export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request); const input = schema.parse(await request.json()); const email = input.email.toLowerCase(); const token = randomToken(); const now = Date.now();
    await database.prepare(`INSERT INTO newsletter_subscriptions (id, email, consented_at, consent_source, unsubscribe_token_hash, unsubscribed_at)
      VALUES (?, ?, ?, ?, ?, NULL)
      ON CONFLICT(email) DO UPDATE SET consented_at = excluded.consented_at, consent_source = excluded.consent_source,
      unsubscribe_token_hash = excluded.unsubscribe_token_hash, unsubscribed_at = NULL, updated_at = unixepoch() * 1000`)
      .run(randomUUID(), email, now, input.source, hashToken(token));
    return NextResponse.json({ subscribed: true, unsubscribeUrl: `/newsletter/unsubscribe/${token}`, message: "Consent recorded. Email sending is not configured." }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
