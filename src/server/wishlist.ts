import { randomUUID } from "node:crypto";
import { database } from "@/db";
import { hashToken, randomToken } from "@/lib/security";
import type { ProductSummary } from "./store";
import { ApiError } from "./http";

async function findWishlist(rawToken: string | undefined) {
  if (!rawToken) return null;
  return database.prepare("SELECT id FROM wishlists WHERE token_hash = ?").get<{ id: string }>(hashToken(rawToken));
}

export async function readWishlist(rawToken: string | undefined) {
  const wishlist = await findWishlist(rawToken);
  if (!wishlist) return { items: [] as ProductSummary[] };
  const items = await database.prepare(`SELECT p.id, p.slug, p.title, p.description, p.is_sample AS isSample,
    c.name AS categoryName, cl.name AS collectionName,
    (SELECT path FROM product_images WHERE product_id = p.id ORDER BY position, id LIMIT 1) AS imagePath,
    (SELECT alt FROM product_images WHERE product_id = p.id ORDER BY position, id LIMIT 1) AS imageAlt,
    MIN(v.price_pkr) AS pricePkr,
    CASE WHEN MIN(v.compare_at_pkr) > MIN(v.price_pkr) THEN MIN(v.compare_at_pkr) ELSE NULL END AS compareAtPkr,
    MAX(CASE WHEN v.stock > 0 THEN 1 ELSE 0 END) AS available
    FROM wishlist_items wi JOIN products p ON p.id = wi.product_id JOIN variants v ON v.product_id = p.id AND v.active = 1
    LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN collections cl ON cl.id = p.collection_id
    WHERE wi.wishlist_id = ? AND p.status = 'PUBLISHED' GROUP BY p.id, c.name, cl.name ORDER BY MAX(wi.created_at) DESC`).all<ProductSummary>(wishlist.id);
  return { items };
}

export async function updateWishlist(rawToken: string | undefined, productId: number, action: "ADD" | "REMOVE") {
  if (action === "ADD") {
    const product = await database.prepare("SELECT 1 FROM products WHERE id = ? AND status = 'PUBLISHED'").get(productId);
    if (!product) throw new ApiError(404, "PRODUCT_NOT_FOUND", "This product is unavailable.");
  }
  const existing = await findWishlist(rawToken);
  const token = existing ? rawToken! : randomToken();
  const wishlistId = existing?.id ?? randomUUID();
  await database.transaction(async () => {
    if (!existing) await database.prepare("INSERT INTO wishlists (id, token_hash) VALUES (?, ?)").run(wishlistId, hashToken(token));
    if (action === "ADD") await database.prepare("INSERT OR IGNORE INTO wishlist_items (wishlist_id, product_id) VALUES (?, ?)").run(wishlistId, productId);
    else await database.prepare("DELETE FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?").run(wishlistId, productId);
    await database.prepare("UPDATE wishlists SET updated_at = unixepoch() * 1000 WHERE id = ?").run(wishlistId);
  }).immediate();
  return { token, state: await readWishlist(token) };
}
