import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { database } from "@/db";
import { manualProofActionable } from "@/lib/payments/manual";
import { getOrderForCustomer } from "@/server/checkout";
import { apiErrorResponse, ApiError } from "@/server/http";
import { processImageUpload } from "@/server/image-pipeline";
import { removeStoredMedia, storeProofImage, type StoredMedia } from "@/server/media-storage";
import { recordPaymentProof } from "@/server/payments/manual";
import { assertMutationRequest, ORDER_ACCESS_COOKIE } from "@/server/protection";
import { assertWithinRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";

// Customer proof-of-payment upload for a MANUAL (bank-transfer) order. Authorized by
// the EXISTING order-access capability cookie (getOrderForCustomer returns null for a
// caller lacking it -> 404, so no IDOR) PLUS exact same-origin + signed CSRF
// (assertMutationRequest). Reuses the shared Sharp pipeline with aggressive proof
// caps (<=1600px, q70, <=1 MiB — the 1 GB host) and stores under an immutable random
// name. Uploading NEVER marks the order paid; it stays PENDING for admin review.
export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  let stored: StoredMedia | null = null;
  try {
    assertMutationRequest(request);
    const { reference } = await context.params;
    const order = await getOrderForCustomer(reference, request.cookies.get(ORDER_ACCESS_COOKIE)?.value);
    if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
    const record = order as Record<string, unknown>;
    const orderId = String(record.id);
    if (!manualProofActionable({ source: String(record.source), paymentStatus: String(record.paymentStatus), orderStatus: String(record.orderStatus) })) throw new ApiError(409, "PROOF_NOT_ACCEPTED", "This order is not awaiting bank-transfer verification.");
    const payment = await database.prepare("SELECT id FROM payments WHERE order_id = ? AND provider = 'MANUAL' AND status = 'PENDING'").get<{ id: string }>(orderId);
    if (!payment) throw new ApiError(409, "PROOF_NOT_ACCEPTED", "This order is not awaiting bank-transfer verification.");

    assertWithinRateLimit(`manual-proof:${orderId}`, { limit: 5, windowMs: 10 * 60_000 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(422, "FILE_REQUIRED", "Choose a payment screenshot to upload.");
    if (file.size < 1 || file.size > 10 * 1024 * 1024) throw new ApiError(413, "FILE_TOO_LARGE", "The screenshot must be 10 MiB or smaller.");
    const input = Buffer.from(await file.arrayBuffer());
    const { output, format, width, height } = await processImageUpload(input, file.type, { maxSidePx: 1600, jpegQuality: 70, webpQuality: 70, pngCompressionLevel: 9, maxOutputBytes: 1024 * 1024 });
    stored = await storeProofImage(output, format.ext, format.mime);
    const sha256 = createHash("sha256").update(output).digest("hex");

    const created = await database.transaction(async () => {
      const inserted = await database.prepare("INSERT INTO media_files (display_name, storage_key, public_path, mime, bytes, width, height, sha256, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)")
        .run(`Payment proof ${reference}`, stored!.storageKey, stored!.publicPath, format.mime, output.byteLength, width, height, sha256);
      const proofId = await recordPaymentProof(database, { orderId, mediaFileId: Number(inserted.lastInsertRowid) });
      return { publicPath: `/orders/${reference}/payment-proof/${proofId}`, bytes: output.byteLength, width, height };
    }).immediate();
    stored = null;
    return NextResponse.json({ ok: true, ...created }, { status: 201 });
  } catch (error) {
    if (stored) await removeStoredMedia(stored).catch(() => undefined);
    return apiErrorResponse(error);
  }
}
