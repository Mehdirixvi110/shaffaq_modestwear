import { NextRequest, NextResponse } from "next/server";
import { database } from "@/db";
import type { VerifiedEvent } from "@/lib/payments/types";
import { ApiError, apiErrorResponse } from "@/server/http";
import { resolveProvider } from "@/server/payments/provider";
import { applyPaymentEvent } from "@/server/payments/service";
import { assertWithinRateLimit, clientIp } from "@/server/rate-limit";

// Node runtime: needed for the raw request body and node:crypto. This is the only
// unauthenticated mutation; it is deliberately NOT wrapped in assertMutationRequest
// (server-to-server). Strict signature verification is the sole gate.
export const runtime = "nodejs";

const MAX_BODY_BYTES = 1024 * 1024; // 1 MiB

export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  try {
    const providerName = (await context.params).provider;
    // Unknown provider OR a provider that is not configured → 404 (a forged
    // webhook while disabled changes nothing).
    const provider = resolveProvider(providerName, process.env);
    if (!provider) return NextResponse.json({ error: "PAYMENT_PROVIDER_UNAVAILABLE", message: "Unknown or disabled payment provider." }, { status: 404 });

    assertWithinRateLimit(`payments:webhook:${providerName}:${clientIp(request)}`, { limit: 60, windowMs: 60_000 });

    const rawBody = await request.text();
    if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      console.warn(`[payments] webhook ${providerName} rejected: empty or oversized body from ${clientIp(request)}`);
      return NextResponse.json({ error: "INVALID_BODY", message: "Invalid webhook body." }, { status: 400 });
    }

    // Verify the signature over the raw bytes BEFORE any parsing (FR-8.2). Both a
    // bad signature and a post-verify parse failure are 400 with no state change.
    let event: VerifiedEvent;
    try {
      event = provider.verifyWebhook(request.headers, rawBody);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 400;
      console.warn(`[payments] webhook ${providerName} rejected from ${clientIp(request)}: ${error instanceof Error ? error.message : "verify error"}`);
      return NextResponse.json({ error: "WEBHOOK_REJECTED", message: "The webhook could not be verified." }, { status });
    }

    const target = provider.mapEventToStatus(event);
    if (target === "IGNORE") {
      console.info(`[payments] webhook ${providerName} ignored event type ${event.rawType}`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    let outcome;
    try {
      outcome = await database.transaction(() => applyPaymentEvent(database, { provider, event, target })).immediate();
    } catch (error) {
      // A transient DB conflict (e.g. a stock version conflict during release)
      // rolls the transaction back and returns 500 so the gateway retries; the
      // next attempt dedupes cleanly via the write-once guard.
      console.error(`[payments] webhook ${providerName} apply failed: ${error instanceof Error ? error.message : "unknown error"}`);
      return NextResponse.json({ error: "PAYMENT_APPLY_FAILED", message: "Could not apply the event; retry later." }, { status: 500 });
    }
    if (outcome === "UNMATCHED") return NextResponse.json({ error: "PAYMENT_UNMATCHED", message: "No matching payment; retry later." }, { status: 503 });
    if (outcome === "REJECTED" || outcome === "AMOUNT_MISMATCH") return NextResponse.json({ error: outcome, message: "The webhook event was rejected." }, { status: 400 });
    return NextResponse.json({ received: true, outcome }, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
