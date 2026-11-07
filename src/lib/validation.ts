import { z } from "zod";
import { CHECKOUT_NAME_REGEX, CHECKOUT_PHONE_REGEX, isAllowedConsumerEmail } from "./checkout-contact";

export const slugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180);
export const positiveId = z.coerce.number().int().positive();
export const pkrSchema = z.coerce.number().int().min(0).max(9_000_000_000);
export const quantitySchema = z.coerce.number().int().min(1).max(20);
export const cleanText = (max: number) => z.string().trim().min(1).max(max);
export const nullableText = (max: number) => z.string().trim().max(max).transform((value) => value || null).nullable();

// Canonicalise a Pakistani mobile number to +923XXXXXXXXX. Assumes the input has
// already matched the pkPhone regex ^(?:\+92|92|0)?3\d{9}$, so the trailing 10 digits
// are always the national 3XXXXXXXXX subscriber number.
export const pkPhoneRegex = /^(?:\+92|92|0)?3\d{9}$/;
export function normalizePkPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return `+92${digits.slice(-10)}`;
}

// Checkout contact rules (stricter than the lead form on purpose):
//  - name: letters only, no digits (shared CHECKOUT_NAME_REGEX)
//  - phone: exactly 03XXXXXXXXX, digits only (shared CHECKOUT_PHONE_REGEX)
//  - email: OPTIONAL. Empty string is accepted; when present it must be a valid
//    address on an allowed consumer provider. Defaults to "" so orders.email
//    (NOT NULL) always receives a string.
export const checkoutNameSchema = z.string().trim().min(1).max(100).regex(CHECKOUT_NAME_REGEX);
export const checkoutPhoneSchema = z.string().trim().regex(CHECKOUT_PHONE_REGEX);
export const optionalConsumerEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .refine((value) => value === "" || isAllowedConsumerEmail(value))
  .default("");

export const checkoutSchema = z.object({
  idempotencyKey: z.uuidv4(),
  customerName: checkoutNameSchema,
  email: optionalConsumerEmailSchema,
  phone: checkoutPhoneSchema,
  addressLine1: cleanText(160),
  addressLine2: z.string().trim().max(160).optional().default(""),
  city: cleanText(100),
  region: z.string().trim().max(100).optional().default(""),
  postalCode: z.string().trim().max(20).optional().default(""),
  country: z.literal("PK"),
  notes: z.string().trim().max(1000).optional().default(""),
  couponCode: z.string().trim().max(40).nullable().optional().default(null),
}).strict();

export type CheckoutInput = z.infer<typeof checkoutSchema>;
