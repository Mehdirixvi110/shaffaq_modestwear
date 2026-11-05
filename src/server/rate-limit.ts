import type { NextRequest } from "next/server";
import { ApiError } from "./http";

// NOTE: single-host/in-memory sliding window only. State lives in this module's
// Map and is lost on restart and not shared across instances; durable,
// multi-instance rate limiting is a separate pass (AUDIT SEC-1/DEP-6).
const buckets = new Map<string, number[]>();

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || "local";
}

export function assertWithinRateLimit(key: string, opts: { limit: number; windowMs: number }): void {
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  const recent = (buckets.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
  if (recent.length >= opts.limit) {
    buckets.set(key, recent);
    throw new ApiError(429, "RATE_LIMITED", "Too many requests. Please try again shortly.");
  }
  recent.push(now);
  buckets.set(key, recent);
}
