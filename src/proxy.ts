import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 renamed the `middleware` file convention to `proxy` (same request
// lifecycle position, Node.js runtime). This proxy issues a fresh per-request
// nonce and a strict Content-Security-Policy. The nonce is placed on the request
// `Content-Security-Policy`/`x-nonce` headers so Next can auto-nonce its own
// framework, bundle, and inline scripts during SSR, and on the response header
// so the browser enforces it. script-src uses a nonce + 'strict-dynamic' and
// never 'unsafe-inline'; the two author JSON-LD blocks on the PDP read the same
// nonce from `x-nonce`. style-src keeps 'unsafe-inline' because Next/next-image
// inject un-nonced inline styles. The whole app is already force-dynamic, so the
// dynamic-rendering cost of nonces is zero here.

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV !== "production";
  // upgrade-insecure-requests is only valid/meaningful over HTTPS. Emitting it on
  // the http://localhost production smoke would try to upgrade local requests and
  // break them, so it is gated to real HTTPS (direct or via a TLS-terminating proxy).
  const isHttps = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

  // In production the only remote image host is Supabase Storage; add its origin
  // to img-src when configured. Everything else is same-origin.
  let supabaseImg = "";
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const parsed = new URL(supabaseUrl);
      if (parsed.protocol === "https:") supabaseImg = ` ${parsed.origin}`;
    } catch {
      // Ignore a malformed Supabase URL; img-src simply omits it.
    }
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    // React dev uses eval for richer stack traces; never in production.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${supabaseImg}`,
    "font-src 'self'",
    // ws:/wss: are only needed for the dev HMR socket.
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  ];
  if (isHttps) directives.push("upgrade-insecure-requests");
  const csp = directives.join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  // Run on all document routes; skip API, static assets, and the icon so they
  // are not needlessly rewritten, and skip link prefetches (no nonce needed).
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|icon.png|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
