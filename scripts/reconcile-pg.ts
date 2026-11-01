import { createDatabaseConnection } from "../src/db/provider";

const tables = [
  "settings", "categories", "collections", "products", "product_images", "product_options", "option_values", "variants", "variant_option_values", "carts", "cart_items", "users", "sessions", "orders", "order_items", "order_history", "checkout_requests", "homepage_sections", "policies", "media_files", "audit_logs", "stock_movements", "coupons", "coupon_products", "coupon_collections", "coupon_redemptions", "return_requests", "wishlists", "wishlist_items", "newsletter_subscriptions", "reviews", "shipping_regions",
] as const;

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error("MIGRATION_DATABASE_URL is required for PostgreSQL reconciliation.");
const database = createDatabaseConnection({ provider: "postgres", postgresUrl: url });
try {
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const row = await database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get<{ count: number }>();
    counts[table] = row?.count ?? 0;
  }
  const settings = await database.prepare(`SELECT contact_email AS contactEmail, contact_phone AS contactPhone, whatsapp_number AS whatsappNumber,
    shipping_pkr AS shippingPkr, free_shipping_threshold_pkr AS freeShippingThresholdPkr, cod_enabled AS codEnabled
    FROM settings WHERE id = 1`).get<{ contactEmail: string | null; contactPhone: string | null; whatsappNumber: string | null; shippingPkr: number; freeShippingThresholdPkr: number | null; codEnabled: number }>();
  const samples = await database.prepare("SELECT COUNT(*) AS count FROM products WHERE is_sample = 1 AND status = 'PUBLISHED'").get<{ count: number }>();
  if (!settings || settings.contactEmail !== "admin@shaffaqmodestwear.com" || settings.contactPhone !== "923233367659" || settings.whatsappNumber !== "923233367659" || settings.shippingPkr !== 250 || settings.freeShippingThresholdPkr !== 6000 || settings.codEnabled !== 1) {
    throw new Error("Critical hosted store settings do not match the supplied business configuration.");
  }
  if (samples?.count !== 6) throw new Error("The hosted catalogue must contain exactly six published labelled sample products after initial seed.");
  console.log(JSON.stringify({ schema: process.env.DATABASE_SCHEMA?.trim() || "public", tables: tables.length, counts, criticalSettings: "verified", publishedSampleProducts: samples.count }, null, 2));
} finally {
  await database.close();
}
