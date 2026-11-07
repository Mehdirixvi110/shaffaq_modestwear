import { randomInt } from "node:crypto";
import { database } from "@/db";
import { hashToken } from "@/lib/security";
import { ApiError } from "./http";
import { sendEmail } from "./email";
import { hashPassword, validateAdminPassword } from "./password";

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

async function findAdminId(email: string): Promise<number | null> {
  const row = await database
    .prepare("SELECT id FROM users WHERE email = ? AND role = 'ADMIN'")
    .get<{ id: number }>(email);
  return row?.id ?? null;
}

/**
 * Issue a 6-digit reset code for an administrator and email it. Behaves the
 * same whether or not the email belongs to an admin (no account enumeration):
 * a code is only generated and sent when the admin exists.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const userId = await findAdminId(normalized);
  if (userId === null) return;
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const timestamp = Date.now();
  await database.prepare("UPDATE password_reset_codes SET used_at = ? WHERE user_id = ? AND used_at IS NULL").run(timestamp, userId);
  await database.prepare("INSERT INTO password_reset_codes (user_id, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, 0, ?)").run(userId, hashToken(code), timestamp + CODE_TTL_MS, timestamp);
  await sendEmail({
    to: normalized,
    subject: "SHAFFAQ admin password reset code",
    text: `Your SHAFFAQ admin password reset code is: ${code}\n\nIt expires in 15 minutes. If you did not request this, you can safely ignore this email.`,
  });
}

/** Verify a reset code and set a new admin password. Single-use, attempt-limited, expiring. */
export async function resetPasswordWithCode(email: string, code: string, newPassword: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  try {
    validateAdminPassword(newPassword, normalized);
  } catch {
    throw new ApiError(422, "WEAK_PASSWORD", "Choose a password of at least 14 characters that does not include your email or common words.");
  }
  const invalid = new ApiError(400, "INVALID_RESET", "The reset code is invalid or has expired. Request a new one.");
  const userId = await findAdminId(normalized);
  if (userId === null) throw invalid;
  const row = await database
    .prepare("SELECT id, code_hash AS codeHash, expires_at AS expiresAt, attempts, used_at AS usedAt FROM password_reset_codes WHERE user_id = ? ORDER BY id DESC LIMIT 1")
    .get<{ id: number; codeHash: string; expiresAt: number; attempts: number; usedAt: number | null }>(userId);
  if (!row || row.usedAt !== null || row.expiresAt < Date.now()) throw invalid;
  if (row.attempts >= MAX_ATTEMPTS) throw new ApiError(429, "TOO_MANY_ATTEMPTS", "Too many attempts. Request a new reset code.");
  if (hashToken(code.trim()) !== row.codeHash) {
    await database.prepare("UPDATE password_reset_codes SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    throw invalid;
  }
  const passwordHash = await hashPassword(newPassword);
  const timestamp = Date.now();
  await database.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
  await database.prepare("UPDATE password_reset_codes SET used_at = ? WHERE id = ?").run(timestamp, row.id);
  await database.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}
