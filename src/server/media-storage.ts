import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
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

// Loaded lazily (only on the Supabase path) via a dynamic import so the local
// filesystem profile never pulls @supabase/supabase-js into its trace. The media
// functions below are already async, so awaiting the client here is the minimal change.
async function storageClient() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required for Supabase media.");
  const { createClient } = await import("@supabase/supabase-js");
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
  const client = await storageClient();
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
  const client = await storageClient();
  const { error } = await client.storage.from(storageBucket()).remove([media.storageKey]);
  if (error) throw new Error(`Supabase Storage cleanup failed (${error.name}).`);
}

export async function readLocalMedia(storageKey: string) {
  if (mediaProvider() !== "local") return null;
  const { path } = safeLocalPath(storageKey);
  return readFile(/* turbopackIgnore: true */ path);
}

// Payment-proof screenshots are customer financial data and must NEVER be reachable
// through the public /uploads route. They are stored under a private `proofs/` key
// prefix (local: the .data/media/proofs subdirectory, which the single-segment
// /uploads/[filename] route cannot address; Supabase: an object with NO public URL)
// and their public_path is a non-routable marker. Bytes are served only through the
// access-gated proof route via readProofMedia. The Sharp re-encode + caps stay with
// the caller; this only changes where the object lives.
export async function storeProofImage(bytes: Buffer, extension: "jpg" | "png" | "webp", mime: string) {
  const provider = mediaProvider();
  const key = `proofs/${randomUUID()}.${extension}`;
  if (provider === "local") {
    const { path } = safeLocalPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes, { flag: "wx" });
    return { storageKey: key, publicPath: `/private/${key}`, provider } satisfies StoredMedia;
  }
  const client = await storageClient();
  const bucket = storageBucket();
  const { error } = await client.storage.from(bucket).upload(key, bytes, {
    cacheControl: "31536000",
    contentType: mime,
    upsert: false,
  });
  if (error) throw new Error(`Supabase Storage upload failed (${error.name}).`);
  return { storageKey: key, publicPath: `/private/${key}`, provider } satisfies StoredMedia;
}

// Read a stored proof's bytes for the gated route. Returns null when the object is
// missing (local ENOENT or a Supabase download error) so the caller can 404.
export async function readProofMedia(storageKey: string) {
  if (mediaProvider() === "local") {
    const { path } = safeLocalPath(storageKey);
    try {
      return await readFile(/* turbopackIgnore: true */ path);
    } catch {
      return null;
    }
  }
  const client = await storageClient();
  const { data, error } = await client.storage.from(storageBucket()).download(storageKey);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
