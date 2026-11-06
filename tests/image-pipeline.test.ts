import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processImageUpload } from "../src/server/image-pipeline";

// Proof-upload settings: aggressive downscale + low quality + a hard 1 MiB cap
// (the production host has only 1 GB disk).
const PROOF_OPTS = { maxSidePx: 1600, jpegQuality: 70, webpQuality: 70, pngCompressionLevel: 9, maxOutputBytes: 1024 * 1024 };
// Admin-media settings: no downscale, high quality, 10 MiB cap (behaviour-identical
// to the original inline pipeline).
const MEDIA_OPTS = { jpegQuality: 88, webpQuality: 88, pngCompressionLevel: 9, maxOutputBytes: 10 * 1024 * 1024 };

function noisyJpeg(width: number, height: number): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i += 1) pixels[i] = (i * 2654435761) % 256; // deterministic pseudo-noise
  return sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality: 100 }).toBuffer();
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try { await promise; return "NO_THROW"; } catch (error) { return (error as { code?: string }).code ?? "NO_CODE"; }
}

describe("processImageUpload", () => {
  it("downscales a large image so the longest side is capped (proof settings)", async () => {
    const buffer = await noisyJpeg(3200, 2000);
    const result = await processImageUpload(buffer, "image/jpeg", PROOF_OPTS);
    expect(result.format).toEqual({ mime: "image/jpeg", ext: "jpg" });
    expect(result.width).toBe(1600);
    expect(result.height).toBe(1000);
    expect(result.output.byteLength).toBeLessThanOrEqual(PROOF_OPTS.maxOutputBytes);
  });

  it("never enlarges an image already smaller than the cap", async () => {
    const buffer = await noisyJpeg(400, 300);
    const result = await processImageUpload(buffer, "image/jpeg", PROOF_OPTS);
    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
  });

  it("enforces the output-byte cap", async () => {
    const buffer = await noisyJpeg(1600, 1200);
    expect(await codeOf(processImageUpload(buffer, "image/jpeg", { ...PROOF_OPTS, maxOutputBytes: 10 }))).toBe("ENCODED_FILE_TOO_LARGE");
  });

  it("rejects a declared type that does not match the decoded format", async () => {
    const buffer = await noisyJpeg(200, 200);
    expect(await codeOf(processImageUpload(buffer, "image/png", PROOF_OPTS))).toBe("UNSUPPORTED_IMAGE");
  });

  it("rejects an undecodable buffer", async () => {
    expect(await codeOf(processImageUpload(Buffer.from("this is not an image"), "image/jpeg", PROOF_OPTS))).toBe("IMAGE_DECODE_FAILED");
  });

  it("preserves dimensions and format with the admin-media settings (no downscale)", async () => {
    const webp = await sharp(await noisyJpeg(900, 600)).webp({ quality: 90 }).toBuffer();
    const result = await processImageUpload(webp, "image/webp", MEDIA_OPTS);
    expect(result.format).toEqual({ mime: "image/webp", ext: "webp" });
    expect(result.width).toBe(900);
    expect(result.height).toBe(600);
  });
});
