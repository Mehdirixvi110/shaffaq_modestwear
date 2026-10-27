import { z } from "zod";
import { sqlite } from "../src/db";
import { hashPassword, validateAdminPassword } from "../src/server/password";

const input = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string(),
}).parse({
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_INITIAL_PASSWORD,
});

validateAdminPassword(input.password, input.email);
const existing = sqlite.prepare("SELECT id, role FROM users WHERE email = ?").get(input.email) as { id: number; role: string } | undefined;
if (existing) {
  if (existing.role !== "ADMIN") throw new Error("The email is already registered and cannot be promoted by this command.");
  console.log("An administrator already exists for this email; no credentials were changed.");
  process.exit(0);
}

const passwordHash = await hashPassword(input.password);
const create = sqlite.transaction(() => {
  const result = sqlite.prepare("INSERT INTO users (email, display_name, password_hash, role) VALUES (?, ?, ?, 'ADMIN')")
    .run(input.email, "SHAFFAQ Owner", passwordHash);
  const userId = Number(result.lastInsertRowid);
  sqlite.prepare("INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, detail_json) VALUES (?, 'auth.admin.bootstrap', 'user', ?, '{}')")
    .run(userId, String(userId));
});
create.immediate();
console.log("Administrator created. The password was not printed or stored outside its hash.");
