import sharp from "sharp";
import { ApiError } from "./http";

export type ImageFormat = { mime: string; ext: "jpg" | "png" | "webp" };
export type ProcessedImage = { output: Buffer; format: ImageFormat; width: number | null; height: number | null };

export type ImagePipelineOptions = {
  // When set, downscale so the longest side is at most maxSidePx (never enlarge).
  maxSidePx?: number;
  jpegQuality: number;
  webpQuality: number;
  pngCompressionLevel: number;
  maxOutputBytes: number;
};

const accepted = new Map<string, ImageFormat>([
  ["jpeg", { mime: "image/jpeg", ext: "jpg" }],
  ["png", { mime: "image/png", ext: "png" }],
  ["webp", { mime: "image/webp", ext: "webp" }],
]);

// Shared, behaviour-preserving Sharp pipeline extracted from the admin media route:
// decode (failOn error, pixel-capped), enforce the decoded format matches the
// declared MIME, apply dimension/megapixel caps, reject animated frames, auto-rotate,
// optionally downscale (proof uploads), re-encode per format (which strips metadata),
// then enforce an output-byte cap. Throws the SAME ApiError codes as before.
export async function processImageUpload(input: Buffer, declaredType: string, opts: ImagePipelineOptions): Promise<ProcessedImage> {
  let metadata;
  try { metadata = await sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).metadata(); }
  catch { throw new ApiError(415, "IMAGE_DECODE_FAILED", "The image could not be fully decoded."); }
  const format = metadata.format ? accepted.get(metadata.format) : null;
  if (!format || declaredType !== format.mime) throw new ApiError(415, "UNSUPPORTED_IMAGE", "The decoded file must match JPEG, PNG, or WebP.");
  if (!metadata.width || !metadata.height || metadata.width > 12_000 || metadata.height > 12_000 || metadata.width * metadata.height > 40_000_000) throw new ApiError(413, "IMAGE_DIMENSIONS", "Images may be at most 12,000 pixels per side and 40 megapixels.");
  if ((metadata.pages ?? 1) > 1) throw new ApiError(415, "ANIMATED_IMAGE_UNSUPPORTED", "Animated images are not supported.");
  let pipeline = sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
  if (opts.maxSidePx) pipeline = pipeline.resize({ width: opts.maxSidePx, height: opts.maxSidePx, fit: "inside", withoutEnlargement: true });
  pipeline = metadata.format === "jpeg" ? pipeline.jpeg({ quality: opts.jpegQuality, mozjpeg: true })
    : metadata.format === "png" ? pipeline.png({ compressionLevel: opts.pngCompressionLevel })
      : pipeline.webp({ quality: opts.webpQuality });
  let output: Buffer;
  try { output = await pipeline.toBuffer(); } catch { throw new ApiError(415, "IMAGE_ENCODE_FAILED", "The image could not be safely re-encoded."); }
  if (output.byteLength > opts.maxOutputBytes) throw new ApiError(413, "ENCODED_FILE_TOO_LARGE", "The safely encoded image is too large.");
  const outputMetadata = await sharp(output).metadata();
  return { output, format, width: outputMetadata.width ?? null, height: outputMetadata.height ?? null };
}
