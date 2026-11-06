import { createHmac, timingSafeEqual } from "node:crypto";

// A-7 (confirmed against Safepay "Webhooks delivery" docs): each delivery is
// signed as HMAC-SHA256 over `X-SFPY-TIMESTAMP` + "." + the raw request body,
// keyed by the base64-DECODED webhook secret, and delivered in `X-SFPY-SIGNATURE`
// formatted as `sha256=<lowercase hex digest>`. Verification uses the exact raw
// bytes received (never a re-serialised body) and a constant-time comparison.

const SIGNATURE_PREFIX = "sha256=";

export function computeSafepaySignature(rawBody: string, timestamp: string, secret: string): string {
  const key = Buffer.from(secret, "base64");
  return createHmac("sha256", key).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

export function verifySafepaySignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
  timestamp: string | null | undefined,
): boolean {
  if (!signatureHeader || !timestamp || !secret) return false;
  const trimmed = signatureHeader.trim();
  if (!trimmed.toLowerCase().startsWith(SIGNATURE_PREFIX)) return false;
  const providedHex = trimmed.slice(SIGNATURE_PREFIX.length).toLowerCase();
  if (!/^[0-9a-f]+$/.test(providedHex)) return false;
  const expectedHex = computeSafepaySignature(rawBody, timestamp, secret);
  const provided = Buffer.from(providedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return provided.length === expected.length && provided.length > 0 && timingSafeEqual(provided, expected);
}
