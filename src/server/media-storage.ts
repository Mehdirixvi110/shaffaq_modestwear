import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mediaProvider } from "@/config/runtime";

export type StoredMedia = {
  storageKey: string;
  publicPath: string;
  provider: "local" | "supabase";
};

let supabase: SupabaseClient | undefined;

function localRoot() {
  return resolve(/* turbopackIgnore: true */ process.cwd(), process.env.MEDIA_ROOT ?? ".data/media");
}

function safeLocalPath(key: string) {
  const root = localRoot();
  const path = resolve(/* turbopackIgnore: true */ root, key);
  const traversal = relative(root, path);
  if (!traversal || traversal.startsWith("..") || traversal.includes(":")) throw new Error("Invalid local media key.");
  return { root, path };
}

function storageClient() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required for Supabase media.");
  supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "shaffaq-server-storage" } },
  });
  return supabase;
}

function storageBucket() {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!bucket) throw new Error("SUPABASE_STORAGE_BUCKET is required for Supabase media.");
  return bucket;
}

export async function storeImage(bytes: Buffer, extension: "jpg" | "png" | "webp", mime: string, keyPrefix = "admin") {
  const provider = mediaProvider();
  if (provider === "local") {
    const key = `${randomUUID()}.${extension}`;
    const { root, path } = safeLocalPath(key);
    await mkdir(root, { recursive: true });
    await writeFile(path, bytes, { flag: "wx" });
    return { storageKey: key, publicPath: `/uploads/${key}`, provider } satisfies StoredMedia;
  }

  const key = `${keyPrefix}/${randomUUID()}.${extension}`;
  const client = storageClient();
  const bucket = storageBucket();
  const { error } = await client.storage.from(bucket).upload(key, bytes, {
    cacheControl: "31536000",
    contentType: mime,
    upsert: false,
  });
  if (error) throw new Error(`Supabase Storage upload failed (${error.name}).`);
  const { data } = client.storage.from(bucket).getPublicUrl(key);
  const expectedStoragePrefix = `${new URL(process.env.SUPABASE_URL!).origin}/storage/v1/object/public/`;
  if (!data.publicUrl.startsWith(expectedStoragePrefix)) {
    await client.storage.from(bucket).remove([key]).catch(() => undefined);
    throw new Error("Supabase Storage returned an unexpected public URL.");
  }
  return { storageKey: key, publicPath: data.publicUrl, provider } satisfies StoredMedia;
}

export async function removeStoredMedia(media: StoredMedia) {
  if (media.provider === "local") {
    const { path } = safeLocalPath(media.storageKey);
    await unlink(path).catch(() => undefined);
    return;
  }
  const { error } = await storageClient().storage.from(storageBucket()).remove([media.storageKey]);
  if (error) throw new Error(`Supabase Storage cleanup failed (${error.name}).`);
}

export async function readLocalMedia(storageKey: string) {
  if (mediaProvider() !== "local") return null;
  const { path } = safeLocalPath(storageKey);
  return readFile(/* turbopackIgnore: true */ path);
}
