// Pure, testable Content-Security-Policy builder. Kept free of any next/server
// import so it can be unit-tested without the Next runtime (same pattern as
// src/server/image-pipeline.ts). src/proxy.ts calls this per request.
//
// Production uses a per-request nonce + 'strict-dynamic' and never 'unsafe-*';
// the whole app is force-dynamic so the nonce cost is zero. Development relaxes
// ONLY script-src/connect-src/worker-src so Next's HMR, Fast Refresh (which
// needs eval) and the non-nonced dev overlay/websocket work — under
// 'strict-dynamic' + nonce the browser ignores 'self'/host sources and blocks
// those dev scripts, which makes HMR fall back to full page reloads.

export interface BuildCspOptions {
  isDev: boolean;
  isHttps: boolean;
  nonce: string;
  // Supabase Storage origin for img-src, or '' when not configured.
  supabaseImgOrigin: string;
  // request.nextUrl.origin, added to the dev connect-src for the HMR socket.
  selfOrigin: string;
}

export function buildContentSecurityPolicy({
  isDev,
  isHttps,
  nonce,
  supabaseImgOrigin,
  selfOrigin,
}: BuildCspOptions): string {
  const supabaseImg = supabaseImgOrigin ? ` ${supabaseImgOrigin}` : "";

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    isDev
      ? // React Refresh needs eval(); the dev overlay/HMR scripts are not nonced,
        // so drop the nonce + 'strict-dynamic' and allow inline/eval/blob in dev.
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:"
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${supabaseImg}`,
    "font-src 'self'",
    // ws:/wss: + the self origin are only needed for the dev HMR socket.
    isDev ? `connect-src 'self' ws: wss: ${selfOrigin}` : "connect-src 'self'",
  ];
  if (isDev) directives.push("worker-src 'self' blob:");
  if (isHttps) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
