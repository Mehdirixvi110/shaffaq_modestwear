import { createDatabaseConnection } from "../src/db/provider";
import { removeStoredMedia } from "../src/server/media-storage";

const schema = process.env.DATABASE_SCHEMA;
if (!schema?.startsWith("shaffaq_smoke_")) throw new Error("Hosted smoke cleanup requires a shaffaq_smoke_* schema.");
const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error("MIGRATION_DATABASE_URL is required for hosted smoke cleanup.");
const database = createDatabaseConnection({ provider: "postgres", postgresUrl: url });
try {
  const uploaded = await database.prepare("SELECT storage_key AS storageKey, public_path AS publicPath FROM media_files WHERE storage_key IS NOT NULL").all<{ storageKey: string; publicPath: string }>();
  for (const media of uploaded) await removeStoredMedia({ ...media, provider: "supabase" });
  console.log(`Hosted smoke storage cleanup removed ${uploaded.length} isolated object(s).`);
} finally {
  await database.close();
}
