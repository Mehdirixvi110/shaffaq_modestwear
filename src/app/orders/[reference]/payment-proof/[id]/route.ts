import { NextRequest, NextResponse } from "next/server";
import { getAdminPageActor } from "@/server/auth";
import { readProofMedia } from "@/server/media-storage";
import { getProofForViewer } from "@/server/payments/manual";
import { ORDER_ACCESS_COOKIE } from "@/server/protection";

export const runtime = "nodejs";

// Access-gated payment-proof image stream. A proof screenshot is customer financial
// data, so it is NEVER served from the public /uploads route; it is returned here
// only to an authenticated admin OR the order owner holding the order-access
// capability cookie for this exact order. Every other caller gets a bare 404 — no
// existence signal (no IDOR), matching the sibling POST route's convention.
export async function GET(request: NextRequest, context: { params: Promise<{ reference: string; id: string }> }) {
  const { reference, id } = await context.params;
  const isAdmin = Boolean(await getAdminPageActor());
  const rawAccessToken = request.cookies.get(ORDER_ACCESS_COOKIE)?.value;
  const proof = await getProofForViewer(reference, Number(id), { isAdmin, rawAccessToken });
  if (!proof) return new NextResponse(null, { status: 404 });
  const bytes = await readProofMedia(proof.storageKey);
  if (!bytes) return new NextResponse(null, { status: 404 });
  return new NextResponse(bytes, { headers: { "Content-Type": proof.mime, "Cache-Control": "private, no-store", ETag: `\"${proof.sha256}\"`, "X-Content-Type-Options": "nosniff" } });
}
