import { defineConfig } from "drizzle-kit";

const url = process.env.MIGRATION_DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/pg-schema.ts",
  out: "./drizzle-pg",
  dbCredentials: url ? { url } : undefined,
});
