import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? process.env.APP_ORIGIN ?? "http://localhost:3000";
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/cart", "/checkout", "/orders"] }, sitemap: `${origin}/sitemap.xml` };
}
