// Pure, dependency-free checkout contact rules shared by the client (inline form
// validation in checkout-form.tsx) and the server (zod schema in validation.ts).
// Intentionally no zod import so the client bundle stays lean and both sides apply
// the exact same rules.

// Common consumer email providers. Email is optional at checkout, but when a
// customer does enter one we only accept mainstream providers so typos in the
// domain (e.g. "gmail.con") are caught before the order is placed.
export const ALLOWED_EMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "rocketmail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
] as const;

// Name: must start with a letter, then letters, spaces, apostrophes, hyphens, or
// dots only — no digits. Unicode letters are allowed so Urdu/Arabic names pass.
export const CHECKOUT_NAME_REGEX = /^\p{L}[\p{L}\s.'-]*$/u;

// Pakistan mobile number: exactly "03" followed by 9 digits (11 digits total),
// digits only. Matches the owner's requested format, e.g. 03001234567.
export const CHECKOUT_PHONE_REGEX = /^03\d{9}$/;

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when the value is a syntactically valid email on an allowed provider. */
export function isAllowedConsumerEmail(email: string): boolean {
  const value = email.trim().toLowerCase();
  if (value.length > 254 || !BASIC_EMAIL_REGEX.test(value)) return false;
  return ALLOWED_EMAIL_DOMAINS.some((domain) => value.endsWith(`@${domain}`));
}

/** Human-readable list of the allowed providers, for hint text. */
export const ALLOWED_EMAIL_HINT = "gmail.com, outlook.com, yahoo.com, hotmail.com, icloud.com";
