import { NextResponse } from "next/server";
import { getPublishedProductNames } from "@/server/store";

export const runtime = "nodejs";

// Public, read-only feed of published product titles used by the storefront
// social-proof notification widget. No auth, no secrets, no mutation. The feed
// changes rarely, so it is served with a 5-minute shared cache (plus a short
// stale-while-revalidate window) instead of no-store: the widget no longer
// refetches the full list on every navigation, while titles stay fresh enough.
export async function GET() {
  const products = await getPublishedProductNames();
  return NextResponse.json(
    { products },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600" } },
  );
}
