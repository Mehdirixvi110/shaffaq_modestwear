import { createDatabaseConnection } from "../src/db/provider";
import { bootstrapAdmin } from "./bootstrap-admin-shared";

const database = createDatabaseConnection({ provider: "sqlite" });
try {
  const result = await bootstrapAdmin(database);
  console.log(result.created ? "Administrator created. The password was not printed or stored outside its hash." : "An administrator already exists for this email; no credentials were changed.");
} finally {
  await database.close();
}
