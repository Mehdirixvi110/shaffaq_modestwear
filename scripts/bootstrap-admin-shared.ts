import { z } from "zod";
import type { DatabaseConnection } from "../src/db/provider";
import { hashPassword, validateAdminPassword } from "../src/server/password";

export async function bootstrapAdmin(database: DatabaseConnection) {
  const input = z.object({
    email: z.email().transform((value) => value.trim().toLowerCase()),
    password: z.string(),
  }).parse({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_INITIAL_PASSWORD });

  validateAdminPassword(input.password, input.email);
  const existing = await database.prepare("SELECT id, role FROM users WHERE email = ?").get<{ id: number; role: string }>(input.email);
  if (existing) {
    if (existing.role !== "ADMIN") throw new Error("The email is already registered and cannot be promoted by this command.");
    return { created: false };
  }

  const passwordHash = await hashPassword(input.password);
  await database.transaction(async () => {
    const result = await database.prepare("INSERT INTO users (email, display_name, password_hash, role) VALUES (?, ?, ?, 'ADMIN')")
      .run(input.email, "SHAFFAQ Owner", passwordHash);
    await database.prepare("INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, detail_json) VALUES (?, 'auth.admin.bootstrap', 'user', ?, '{}')")
      .run(result.lastInsertRowid, String(result.lastInsertRowid));
  }).immediate();
  return { created: true };
}
