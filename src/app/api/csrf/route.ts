import { NextRequest, NextResponse } from "next/server";
import { ensureProtectionCookies } from "@/server/protection";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const response = NextResponse.json({ csrfToken: "" }, { headers: { "Cache-Control": "no-store" } });
  const csrfToken = ensureProtectionCookies(request, response);
  return NextResponse.json({ csrfToken }, {
    headers: response.headers,
  });
}
