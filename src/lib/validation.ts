import { z } from "zod";

export const slugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180);
export const positiveId = z.coerce.number().int().positive();
export const pkrSchema = z.coerce.number().int().min(0).max(9_000_000_000);
export const quantitySchema = z.coerce.number().int().min(1).max(20);
export const cleanText = (max: number) => z.string().trim().min(1).max(max);
export const nullableText = (max: number) => z.string().trim().max(max).transform((value) => value || null).nullable();

export const checkoutSchema = z.object({
  idempotencyKey: z.uuidv4(),
  customerName: cleanText(100),
  email: z.email().max(254),
  phone: z.string().trim().regex(/^(?:\+92|92|0)?3\d{9}$/),
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
