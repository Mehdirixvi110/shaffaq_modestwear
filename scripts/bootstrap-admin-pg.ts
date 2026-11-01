import { createDatabaseConnection } from "../src/db/provider";
import { bootstrapAdmin } from "./bootstrap-admin-shared";

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error("MIGRATION_DATABASE_URL is required for PostgreSQL administrator bootstrap.");
const database = createDatabaseConnection({ provider: "postgres", postgresUrl: url });
try {
  const result = await bootstrapAdmin(database);
  console.log(result.created ? "PostgreSQL administrator created. The password was not printed or stored outside its hash." : "An administrator already exists for this email; no credentials were changed.");
} finally {
  await database.close();
}
