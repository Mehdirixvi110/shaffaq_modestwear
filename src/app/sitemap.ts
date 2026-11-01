import type { MetadataRoute } from "next";
import { database } from "@/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? process.env.APP_ORIGIN ?? "http://localhost:3000";
  const [products, categories, collections, pages] = await Promise.all([
    database.prepare("SELECT slug, updated_at AS updatedAt FROM products WHERE status = 'PUBLISHED'").all<{ slug: string; updatedAt: number }>(),
    database.prepare("SELECT slug FROM categories WHERE visible = 1").all<{ slug: string }>(),
    database.prepare("SELECT slug FROM collections WHERE visible = 1").all<{ slug: string }>(),
    database.prepare("SELECT slug, updated_at AS updatedAt FROM policies").all<{ slug: string; updatedAt: number }>(),
  ]);
  return [{ url: origin, changeFrequency: "weekly", priority: 1 }, { url: `${origin}/search`, changeFrequency: "daily", priority: 0.8 }, ...products.map((item) => ({ url: `${origin}/products/${item.slug}`, lastModified: new Date(item.updatedAt), changeFrequency: "weekly" as const, priority: 0.7 })), ...categories.map((item) => ({ url: `${origin}/categories/${item.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })), ...collections.map((item) => ({ url: `${origin}/collections/${item.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })), ...pages.map((item) => ({ url: `${origin}/pages/${item.slug}`, lastModified: new Date(item.updatedAt), changeFrequency: "monthly" as const, priority: 0.4 }))];
}
