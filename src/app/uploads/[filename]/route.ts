import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { sqlite } from "@/db";

export const runtime = "nodejs";
export async function GET(_: Request, context: { params: Promise<{ filename: string }> }) { const { filename } = await context.params; if (!/^[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(filename)) return new NextResponse(null, { status: 404 }); const media = sqlite.prepare("SELECT storage_key AS storageKey, mime, sha256 FROM media_files WHERE storage_key = ?").get(filename) as { storageKey: string; mime: string; sha256: string } | undefined; if (!media) return new NextResponse(null, { status: 404 }); try { const root = resolve(process.cwd(), process.env.MEDIA_ROOT ?? ".data/media"); const bytes = await readFile(resolve(root, media.storageKey)); return new NextResponse(bytes, { headers: { "Content-Type": media.mime, "Cache-Control": "private, max-age=0, must-revalidate", ETag: `\"${media.sha256}\"`, "X-Content-Type-Options": "nosniff" } }); } catch { return new NextResponse(null, { status: 404 }); } }
