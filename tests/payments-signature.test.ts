import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { computeSafepaySignature, verifySafepaySignature } from "../src/lib/payments/safepay-signature";

const secret = Buffer.from("super-secret-key").toString("base64"); // base64-encoded, as Safepay returns it
const rawBody = JSON.stringify({ identifier: "evt_1", webhook_event_type: "payment.completed" });
const timestamp = "2026-11-02T10:00:00Z";

function sign(body: string, ts: string, b64Secret: string): string {
  const key = Buffer.from(b64Secret, "base64");
  return `sha256=${createHmac("sha256", key).update(`${ts}.${body}`, "utf8").digest("hex")}`;
}

describe("Safepay webhook signature verification (AC3c, FR-4.4)", () => {
  it("accepts a valid signature over the exact raw body + timestamp", () => {
    expect(verifySafepaySignature(rawBody, sign(rawBody, timestamp, secret), secret, timestamp)).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(verifySafepaySignature(`${rawBody} `, sign(rawBody, timestamp, secret), secret, timestamp)).toBe(false);
  });

  it("rejects a tampered timestamp", () => {
    expect(verifySafepaySignature(rawBody, sign(rawBody, timestamp, secret), secret, "2026-11-02T11:00:00Z")).toBe(false);
  });

  it("rejects a missing or malformed signature header", () => {
    expect(verifySafepaySignature(rawBody, null, secret, timestamp)).toBe(false);
    expect(verifySafepaySignature(rawBody, "", secret, timestamp)).toBe(false);
    expect(verifySafepaySignature(rawBody, "not-a-signature", secret, timestamp)).toBe(false);
    expect(verifySafepaySignature(rawBody, "sha256=zzzz", secret, timestamp)).toBe(false);
  });

  it("rejects a missing timestamp or secret", () => {
    expect(verifySafepaySignature(rawBody, sign(rawBody, timestamp, secret), secret, null)).toBe(false);
    expect(verifySafepaySignature(rawBody, sign(rawBody, timestamp, secret), "", timestamp)).toBe(false);
  });

  it("rejects a signature produced with a different secret", () => {
    const other = Buffer.from("different-secret").toString("base64");
    expect(verifySafepaySignature(rawBody, sign(rawBody, timestamp, other), secret, timestamp)).toBe(false);
  });

  it("computeSafepaySignature matches an independent HMAC over timestamp + '.' + body", () => {
    const key = Buffer.from(secret, "base64");
    const expected = createHmac("sha256", key).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
    expect(computeSafepaySignature(rawBody, timestamp, secret)).toBe(expected);
  });
});
