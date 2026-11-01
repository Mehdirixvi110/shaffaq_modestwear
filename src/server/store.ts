import { database } from "@/db";

export type StoreSettings = {
  storeName: string;
  descriptor: string;
  announcement: string | null;
  heroEyebrow: string | null;
  heroTitle: string;
  heroBody: string | null;
  heroCtaLabel: string | null;
  heroCtaUrl: string | null;
  heroDesktopPath: string | null;
  heroMobilePath: string | null;
  shippingPkr: number;
  freeShippingThresholdPkr: number | null;
  codEnabled: number;
  whatsappNumber: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  taxEnabled: number;
  taxRateBps: number;
  returnsPolicyUrl: string;
  exchangesPolicyUrl: string;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  seoTitle: string;
  seoDescription: string;
  analyticsIdentifier: string | null;
  maintenanceMode: number;
  maintenanceMessage: string | null;
  version: number;
};

export type ProductSummary = {
  id: number;
  slug: string;
  title: string;
  description: string;
  imagePath: string | null;
  imageAlt: string | null;
  pricePkr: number;
  compareAtPkr: number | null;
  available: number;
  isSample: number;
  categoryName: string | null;
  collectionName: string | null;
};

export async function getSettings() {
  const row = await database.prepare(`SELECT store_name AS storeName, descriptor, announcement,
    hero_eyebrow AS heroEyebrow, hero_title AS heroTitle, hero_body AS heroBody,
    hero_cta_label AS heroCtaLabel, hero_cta_url AS heroCtaUrl,
    hero_desktop_path AS heroDesktopPath, hero_mobile_path AS heroMobilePath,
    shipping_pkr AS shippingPkr, free_shipping_threshold_pkr AS freeShippingThresholdPkr,
    cod_enabled AS codEnabled, whatsapp_number AS whatsappNumber,
    contact_email AS contactEmail, contact_phone AS contactPhone,
    tax_enabled AS taxEnabled, tax_rate_bps AS taxRateBps,
    returns_policy_url AS returnsPolicyUrl, exchanges_policy_url AS exchangesPolicyUrl,
    instagram_url AS instagramUrl, facebook_url AS facebookUrl, tiktok_url AS tiktokUrl,
    seo_title AS seoTitle, seo_description AS seoDescription, analytics_identifier AS analyticsIdentifier,
    maintenance_mode AS maintenanceMode, maintenance_message AS maintenanceMessage, version
    FROM settings WHERE id = 1`).get<StoreSettings>();
  if (!row) throw new Error("Store has not been seeded. Run the provider-specific seed command.");
  return row;
}

export async function getNavigation() {
  const [categories, collections] = await Promise.all([
    database.prepare("SELECT id, slug, name FROM categories WHERE visible = 1 AND archived = 0 ORDER BY position, id").all<{ id: number; slug: string; name: string }>(),
    database.prepare("SELECT id, slug, name FROM collections WHERE visible = 1 AND archived = 0 ORDER BY position, id").all<{ id: number; slug: string; name: string }>(),
  ]);
  return { categories, collections };
}

export async function getHomepageSections() {
  return database.prepare(`SELECT id, type, title, body, image_path AS imagePath, link_label AS linkLabel,
    link_url AS linkUrl, visible, position FROM homepage_sections WHERE visible = 1 ORDER BY position, id`).all<{
      id: number; type: "CATEGORY_GRID" | "FEATURED" | "CAMPAIGN" | "EDITORIAL" | "REVIEWS" | "SERVICES";
      title: string | null; body: string | null; imagePath: string | null; linkLabel: string | null; linkUrl: string | null; visible: number; position: number;
    }>();
}

export async function listCategoryTiles() {
  return database.prepare("SELECT id, slug, name, description, image_path AS imagePath FROM categories WHERE visible = 1 AND archived = 0 ORDER BY position, id LIMIT 3").all<{ id: number; slug: string; name: string; description: string | null; imagePath: string | null }>();
}

export async function listProducts(input: { q?: string; categorySlug?: string; collectionSlug?: string; size?: string; sort?: string; page?: number; limit?: number } = {}) {
  const conditions = ["p.status = 'PUBLISHED'", "v.active = 1"];
  const parameters: Array<string | number> = [];
  if (input.q?.trim()) {
    const query = `%${input.q.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    conditions.push("(p.title LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\' OR v.sku LIKE ? ESCAPE '\\')");
    parameters.push(query, query, query);
  }
  if (input.categorySlug) {
    conditions.push("c.slug = ?");
    parameters.push(input.categorySlug);
  }
  if (input.collectionSlug) {
    conditions.push("cl.slug = ?");
    parameters.push(input.collectionSlug);
  }
  if (input.size) {
    conditions.push("EXISTS (SELECT 1 FROM variant_option_values fov JOIN option_values fval ON fval.id = fov.option_value_id WHERE fov.variant_id = v.id AND fval.value = ?)");
    parameters.push(input.size);
  }
  let selectedSort = input.sort;
  if (!selectedSort && input.categorySlug) selectedSort = (await database.prepare("SELECT storefront_sort AS sort FROM categories WHERE slug = ? AND archived = 0").get<{ sort: string }>(input.categorySlug))?.sort;
  if (!selectedSort && input.collectionSlug) selectedSort = (await database.prepare("SELECT storefront_sort AS sort FROM collections WHERE slug = ? AND archived = 0").get<{ sort: string }>(input.collectionSlug))?.sort;
  const orderBy = selectedSort === "price-asc" || selectedSort === "PRICE_ASC" ? "MIN(v.price_pkr) ASC, p.id DESC"
    : selectedSort === "price-desc" || selectedSort === "PRICE_DESC" ? "MIN(v.price_pkr) DESC, p.id DESC"
      : selectedSort === "newest" || selectedSort === "NEWEST" ? "p.created_at DESC, p.id DESC"
        : "p.is_featured DESC, p.created_at DESC, p.id DESC";
  const page = Math.max(1, Math.min(1000, input.page ?? 1));
  const limit = Math.max(1, Math.min(48, input.limit ?? 24));
  const where = conditions.join(" AND ");
  const countRow = await database.prepare(`SELECT COUNT(DISTINCT p.id) AS count FROM products p
    JOIN variants v ON v.product_id = p.id
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN collections cl ON cl.id = p.collection_id
    WHERE ${where}`).get<{ count: number }>(...parameters);
  const rows = await database.prepare(`SELECT p.id, p.slug, p.title, p.description, p.is_sample AS isSample,
    c.name AS categoryName, cl.name AS collectionName,
    (SELECT path FROM product_images WHERE product_id = p.id ORDER BY position, id LIMIT 1) AS imagePath,
    (SELECT alt FROM product_images WHERE product_id = p.id ORDER BY position, id LIMIT 1) AS imageAlt,
    MIN(v.price_pkr) AS pricePkr,
    CASE WHEN MIN(v.compare_at_pkr) > MIN(v.price_pkr) THEN MIN(v.compare_at_pkr) ELSE NULL END AS compareAtPkr,
    MAX(CASE WHEN v.stock > 0 THEN 1 ELSE 0 END) AS available
    FROM products p
    JOIN variants v ON v.product_id = p.id
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN collections cl ON cl.id = p.collection_id
    WHERE ${where}
    GROUP BY p.id, c.name, cl.name
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?`).all<ProductSummary>(...parameters, limit, (page - 1) * limit);
  const count = countRow?.count ?? 0;
  return { products: rows, count, page, pages: Math.max(1, Math.ceil(count / limit)) };
}

export type ProductDetail = ProductSummary & {
  seoTitle: string | null;
  seoDescription: string | null;
  images: Array<{ id: number; path: string; alt: string }>;
  options: Array<{ id: number; name: string; required: number; values: Array<{ id: number; value: string }> }>;
  variants: Array<{ id: number; title: string; sku: string; pricePkr: number; compareAtPkr: number | null; stock: number; options: Record<string, string> }>;
  related: ProductSummary[];
};

export async function getProduct(slug: string): Promise<ProductDetail | null> {
  const product = await database.prepare(`SELECT p.id, p.slug, p.title, p.description, p.is_sample AS isSample,
    p.seo_title AS seoTitle, p.seo_description AS seoDescription, c.name AS categoryName,
    cl.name AS collectionName,
    (SELECT path FROM product_images WHERE product_id = p.id ORDER BY position, id LIMIT 1) AS imagePath,
    (SELECT alt FROM product_images WHERE product_id = p.id ORDER BY position, id LIMIT 1) AS imageAlt,
    MIN(v.price_pkr) AS pricePkr,
    CASE WHEN MIN(v.compare_at_pkr) > MIN(v.price_pkr) THEN MIN(v.compare_at_pkr) ELSE NULL END AS compareAtPkr,
    MAX(CASE WHEN v.stock > 0 THEN 1 ELSE 0 END) AS available
    FROM products p JOIN variants v ON v.product_id = p.id AND v.active = 1
    LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN collections cl ON cl.id = p.collection_id
    WHERE p.slug = ? AND p.status = 'PUBLISHED' GROUP BY p.id, c.name, cl.name`).get<Omit<ProductDetail, "images" | "options" | "variants" | "related">>(slug);
  if (!product) return null;
  const [images, optionRows, variantRows] = await Promise.all([
    database.prepare("SELECT id, path, alt FROM product_images WHERE product_id = ? ORDER BY position, id").all<ProductDetail["images"][number]>(product.id),
    database.prepare("SELECT id, name, required FROM product_options WHERE product_id = ? ORDER BY position, id").all<{ id: number; name: string; required: number }>(product.id),
    database.prepare("SELECT id, title, sku, price_pkr AS pricePkr, compare_at_pkr AS compareAtPkr, stock FROM variants WHERE product_id = ? AND active = 1 ORDER BY position, id").all<Omit<ProductDetail["variants"][number], "options">>(product.id),
  ]);
  const options = await Promise.all(optionRows.map(async (option) => ({
    ...option,
    values: await database.prepare("SELECT id, value FROM option_values WHERE option_id = ? ORDER BY position, id").all<{ id: number; value: string }>(option.id),
  })));
  const variantsWithOptions = await Promise.all(variantRows.map(async (variant) => ({
    ...variant,
    options: Object.fromEntries((await database.prepare(`SELECT po.name, ov.value FROM variant_option_values vov
      JOIN option_values ov ON ov.id = vov.option_value_id JOIN product_options po ON po.id = ov.option_id
      WHERE vov.variant_id = ? ORDER BY po.position, po.id`).all<{ name: string; value: string }>(variant.id)).map((row) => [row.name, row.value])),
  })));
  const related = (await listProducts({ limit: 4 })).products.filter((item) => item.id !== product.id).slice(0, 4);
  return { ...product, images, options, variants: variantsWithOptions, related };
}

export async function getCollection(slug: string) {
  return database.prepare("SELECT id, slug, name, description, image_path AS imagePath, storefront_sort AS storefrontSort FROM collections WHERE slug = ? AND visible = 1 AND archived = 0").get<{ id: number; slug: string; name: string; description: string | null; imagePath: string | null; storefrontSort: string }>(slug);
}

export async function getCategory(slug: string) {
  return database.prepare("SELECT id, slug, name, description, image_path AS imagePath, storefront_sort AS storefrontSort FROM categories WHERE slug = ? AND visible = 1 AND archived = 0").get<{ id: number; slug: string; name: string; description: string | null; imagePath: string | null; storefrontSort: string }>(slug);
}

export async function getPolicy(slug: string) {
  return database.prepare("SELECT id, slug, title, content, is_template AS isTemplate, updated_at AS updatedAt FROM policies WHERE slug = ?").get<{ id: number; slug: string; title: string; content: string; isTemplate: number; updatedAt: number }>(slug);
}

export type ApprovedReview = {
  id: string;
  productId: number;
  productTitle: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: number;
};

export async function getApprovedReviews(productId?: number, limit = 8) {
  const safeLimit = Math.max(1, Math.min(24, limit));
  const query = `SELECT r.id, r.product_id AS productId, p.title AS productTitle, r.customer_name AS customerName,
    r.rating, r.title, r.body, r.created_at AS createdAt FROM reviews r
    JOIN products p ON p.id = r.product_id WHERE r.status = 'APPROVED'${productId ? " AND r.product_id = ?" : ""}
    ORDER BY r.created_at DESC LIMIT ?`;
  const rows = await database.prepare(query).all<ApprovedReview>(...(productId ? [productId, safeLimit] : [safeLimit]));
  return rows.map((row) => {
    const names = row.customerName.trim().split(/\s+/);
    const publicName = names.length > 1 ? `${names[0]} ${names[names.length - 1][0]}.` : names[0];
    return { ...row, customerName: publicName };
  });
}
