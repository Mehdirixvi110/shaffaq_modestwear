import { NextResponse } from "next/server";
import { database } from "@/db";
import { readLocalMedia } from "@/server/media-storage";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  if (!/^[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(filename)) return new NextResponse(null, { status: 404 });
  const media = await database.prepare("SELECT storage_key AS storageKey, mime, sha256 FROM media_files WHERE storage_key = ?").get<{ storageKey: string; mime: string; sha256: string }>(filename);
  if (!media) return new NextResponse(null, { status: 404 });
  try {
    const bytes = await readLocalMedia(media.storageKey);
    if (!bytes) return new NextResponse(null, { status: 404 });
    return new NextResponse(bytes, { headers: { "Content-Type": media.mime, "Cache-Control": "private, max-age=0, must-revalidate", ETag: `\"${media.sha256}\"`, "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
