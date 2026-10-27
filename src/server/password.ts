import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";

export function validateAdminPassword(password: string, email: string) {
  const schema = z.string().min(14).max(128);
  schema.parse(password);
  if (password.trim() !== password || /^\s+$/.test(password)) throw new Error("Password cannot begin or end with whitespace.");
  if (/^(.)\1+$/u.test(password)) throw new Error("Password cannot repeat one character.");
  const normalized = password.toLowerCase();
  const localPart = email.split("@")[0]?.toLowerCase() ?? "";
  if (normalized.includes(email.toLowerCase()) || (localPart.length >= 4 && normalized.includes(localPart))) {
    throw new Error("Password cannot contain the administrator email.");
  }
  if (["password", "administrator", "shaffaq123456"].some((value) => normalized.includes(value))) {
    throw new Error("Choose a less predictable password.");
  }
}

export function hashPassword(password: string) {
  return hash(password, { memoryCost: 65_536, timeCost: 3, parallelism: 1, outputLen: 32 });
}

export function verifyPassword(passwordHash: string, password: string) {
  return verify(passwordHash, password);
}
