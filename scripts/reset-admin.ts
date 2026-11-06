import { z } from "zod";
import { createDatabaseConnection } from "../src/db/provider";
import { hashPassword, validateAdminPassword } from "../src/server/password";

// Data-preserving admin password reset for the LOCAL SQLite profile.
// Reads ADMIN_EMAIL + ADMIN_INITIAL_PASSWORD from the environment (same as
// bootstrap). It only updates the password hash of an EXISTING administrator;
// it never creates, deletes, or promotes an account, and never prints the
// password. Run: $env:ADMIN_INITIAL_PASSWORD='<new password>'; npm run reset:admin
const input = z
  .object({
    email: z.email().transform((value) => value.trim().toLowerCase()),
    password: z.string(),
  })
  .parse({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_INITIAL_PASSWORD });

validateAdminPassword(input.password, input.email);

const database = createDatabaseConnection({ provider: "sqlite" });
try {
  const existing = await database
    .prepare("SELECT id, role FROM users WHERE email = ?")
    .get<{ id: number; role: string }>(input.email);
  if (!existing) {
    throw new Error(`No user found for ${input.email}. Nothing to reset.`);
  }
  if (existing.role !== "ADMIN") {
    throw new Error("That account is not an administrator; refusing to change it.");
  }
  const passwordHash = await hashPassword(input.password);
  await database.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, existing.id);
  console.log("Administrator password reset. The new password was not printed or stored outside its hash.");
} finally {
  await database.close();
}
