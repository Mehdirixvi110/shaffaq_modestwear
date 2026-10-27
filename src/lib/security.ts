import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function canonicalHash(value: unknown) {
  const canonicalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(canonicalize);
    if (input && typeof input === "object") {
      return Object.fromEntries(Object.entries(input as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]));
    }
    return input;
  };
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function requiredSecret(name: "CSRF_SECRET" | "SESSION_SECRET") {
  const value = process.env[name];
  if (!value || Buffer.byteLength(value) < 32) throw new Error(`${name} must contain at least 32 bytes.`);
  return value;
}

export function createCsrfToken() {
  const nonce = randomToken();
  const signature = createHmac("sha256", requiredSecret("CSRF_SECRET")).update(nonce).digest("base64url");
  return `${nonce}.${signature}`;
}

export function verifyCsrfToken(token: string) {
  const [nonce, supplied, extra] = token.split(".");
  if (!nonce || !supplied || extra) return false;
  const expected = createHmac("sha256", requiredSecret("CSRF_SECRET")).update(nonce).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(supplied, "base64url");
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function orderAccessToken(orderId: string) {
  return createHmac("sha256", requiredSecret("SESSION_SECRET")).update(`order:${orderId}`).digest("base64url");
}

export function isSessionActive(expiresAt: number, now = Date.now()) {
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function canAccessAdmin(role: string, expiresAt: number, now = Date.now()) {
  return role === "ADMIN" && isSessionActive(expiresAt, now);
}
