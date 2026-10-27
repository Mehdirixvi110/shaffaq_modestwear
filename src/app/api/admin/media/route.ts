import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";

export const runtime = "nodejs";
const nameSchema = z.string().trim().min(1).max(120);
const replacementSchema = z.coerce.number().int().positive().nullable();
const accepted = new Map([
  ["jpeg", { mime: "image/jpeg", ext: "jpg" }],
  ["png", { mime: "image/png", ext: "png" }],
  ["webp", { mime: "image/webp", ext: "webp" }],
]);

export async function POST(request: NextRequest) {
  let destination: string | null = null;
  try {
    const actor = authorizeAdminMutation(request); const form = await request.formData(); const displayName = nameSchema.parse(form.get("displayName"));
    const replacementValue = String(form.get("replaceMediaId") ?? "").trim(); const replaceMediaId = replacementSchema.parse(replacementValue ? replacementValue : null);
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(422, "FILE_REQUIRED", "Choose an image file.");
    if (file.size < 1 || file.size > 10 * 1024 * 1024) throw new ApiError(413, "FILE_TOO_LARGE", "Images must be 10 MiB or smaller.");
    const input = Buffer.from(await file.arrayBuffer());
    let metadata;
    try { metadata = await sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).metadata(); }
    catch { throw new ApiError(415, "IMAGE_DECODE_FAILED", "The image could not be fully decoded."); }
    const format = metadata.format ? accepted.get(metadata.format) : null;
    if (!format || file.type !== format.mime) throw new ApiError(415, "UNSUPPORTED_IMAGE", "The decoded file must match JPEG, PNG, or WebP.");
    if (!metadata.width || !metadata.height || metadata.width > 12_000 || metadata.height > 12_000 || metadata.width * metadata.height > 40_000_000) throw new ApiError(413, "IMAGE_DIMENSIONS", "Images may be at most 12,000 pixels per side and 40 megapixels.");
    if ((metadata.pages ?? 1) > 1) throw new ApiError(415, "ANIMATED_IMAGE_UNSUPPORTED", "Animated images are not supported.");
    let pipeline = sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
    pipeline = metadata.format === "jpeg" ? pipeline.jpeg({ quality: 88, mozjpeg: true }) : metadata.format === "png" ? pipeline.png({ compressionLevel: 9 }) : pipeline.webp({ quality: 88 });
    let output: Buffer;
    try { output = await pipeline.toBuffer(); } catch { throw new ApiError(415, "IMAGE_ENCODE_FAILED", "The image could not be safely re-encoded."); }
    if (output.byteLength > 10 * 1024 * 1024) throw new ApiError(413, "ENCODED_FILE_TOO_LARGE", "The safely encoded image exceeds 10 MiB.");
    const outputMetadata = await sharp(output).metadata();
    const key = `${randomUUID()}.${format.ext}`; const root = resolve(process.cwd(), process.env.MEDIA_ROOT ?? ".data/media");
    await mkdir(root, { recursive: true }); destination = resolve(root, key);
    if (!destination.startsWith(`${root}\\`) && !destination.startsWith(`${root}/`)) throw new ApiError(400, "INVALID_PATH", "Invalid media path.");
    await writeFile(destination, output, { flag: "wx" });
    const sha256 = createHash("sha256").update(output).digest("hex");
    const created = withAdminAudit(actor, replaceMediaId ? "media.image.replace" : "media.image.upload", "media", replaceMediaId ? String(replaceMediaId) : null, { mime: format.mime, inputBytes: file.size, outputBytes: output.byteLength, metadataStripped: true }, (connection) => {
      let replaced: { id: number; publicPath: string } | undefined;
      if (replaceMediaId) {
        replaced = connection.prepare("SELECT id, public_path AS publicPath FROM media_files WHERE id = ? AND replaced_at IS NULL").get(replaceMediaId) as { id: number; publicPath: string } | undefined;
        if (!replaced) throw new ApiError(404, "MEDIA_NOT_FOUND", "The media selected for replacement is unavailable.");
      }
      const result = connection.prepare("INSERT INTO media_files (display_name, storage_key, public_path, mime, bytes, width, height, sha256, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(displayName, key, `/uploads/${key}`, format.mime, output.byteLength, outputMetadata.width ?? null, outputMetadata.height ?? null, sha256, actor.id);
      const id = Number(result.lastInsertRowid); const publicPath = `/uploads/${key}`;
      if (replaced) {
        connection.prepare("UPDATE product_images SET path = ? WHERE path = ?").run(publicPath, replaced.publicPath);
        connection.prepare("UPDATE categories SET image_path = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE image_path = ?").run(publicPath, replaced.publicPath);
        connection.prepare("UPDATE collections SET image_path = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE image_path = ?").run(publicPath, replaced.publicPath);
        connection.prepare("UPDATE homepage_sections SET image_path = ?, updated_at = unixepoch() * 1000 WHERE image_path = ?").run(publicPath, replaced.publicPath);
        connection.prepare("UPDATE settings SET hero_desktop_path = CASE WHEN hero_desktop_path = ? THEN ? ELSE hero_desktop_path END, hero_mobile_path = CASE WHEN hero_mobile_path = ? THEN ? ELSE hero_mobile_path END, version = version + 1, updated_at = unixepoch() * 1000 WHERE hero_desktop_path = ? OR hero_mobile_path = ?")
          .run(replaced.publicPath, publicPath, replaced.publicPath, publicPath, replaced.publicPath, replaced.publicPath);
        connection.prepare("UPDATE media_files SET replaced_by_id = ?, replaced_at = unixepoch() * 1000 WHERE id = ?").run(id, replaced.id);
      }
      return { id, displayName, publicPath, mime: format.mime, bytes: output.byteLength, width: outputMetadata.width, height: outputMetadata.height, sha256, replacedMediaId: replaced?.id ?? null };
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (destination) await unlink(destination).catch(() => undefined);
    return apiErrorResponse(error);
  }
}
