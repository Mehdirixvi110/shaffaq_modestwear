import { database } from "@/db";
import { getSettings } from "./store";

export async function getDashboardData() {
  const [counts, recentOrders, audits] = await Promise.all([
    database.prepare(`SELECT
      (SELECT COUNT(*) FROM products WHERE status = 'PUBLISHED') AS publishedProducts,
      (SELECT COUNT(*) FROM products WHERE status = 'DRAFT') AS draftProducts,
      (SELECT COUNT(*) FROM orders WHERE order_status != 'CANCELLED') AS activeOrders,
      (SELECT COUNT(*) FROM variants WHERE active = 1 AND stock <= low_stock_threshold) AS lowStockVariants,
      (SELECT COALESCE(SUM(total_pkr), 0) FROM orders WHERE payment_status = 'PAID') AS collectedRevenue`).get<{ publishedProducts: number; draftProducts: number; activeOrders: number; lowStockVariants: number; collectedRevenue: number }>(),
    database.prepare("SELECT id, reference, customer_name AS customerName, order_status AS orderStatus, total_pkr AS totalPkr, created_at AS createdAt FROM orders ORDER BY created_at DESC LIMIT 6").all<{ id: string; reference: string; customerName: string; orderStatus: string; totalPkr: number; createdAt: number }>(),
    database.prepare("SELECT id, action, entity_type AS entityType, entity_id AS entityId, created_at AS createdAt FROM audit_logs ORDER BY id DESC LIMIT 8").all<{ id: number; action: string; entityType: string; entityId: string | null; createdAt: number }>(),
  ]);
  if (!counts) throw new Error("Dashboard counts query returned no row.");
  return { ...counts, recentOrders, audits };
}

export async function getAdminProducts() {
  return database.prepare(`SELECT p.id, p.title, p.slug, p.status, p.is_sample AS isSample, p.updated_at AS updatedAt,
    c.name AS categoryName, cl.name AS collectionName,
    (SELECT MIN(price_pkr) FROM variants WHERE product_id = p.id AND active = 1) AS pricePkr,
    (SELECT SUM(stock) FROM variants WHERE product_id = p.id AND active = 1) AS stock
    FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN collections cl ON cl.id = p.collection_id
    ORDER BY p.updated_at DESC, p.id DESC`).all<Record<string, string | number | null>>();
}

export async function getAdminProduct(id: number) {
  const product = await database.prepare(`SELECT id, title, slug, description, category_id AS categoryId, collection_id AS collectionId,
    status, is_featured AS isFeatured, is_sample AS isSample, seo_title AS seoTitle, seo_description AS seoDescription, version,
    (SELECT path FROM product_images WHERE product_id = products.id ORDER BY position, id LIMIT 1) AS imagePath,
    COALESCE((SELECT name FROM product_options WHERE product_id = products.id ORDER BY position, id LIMIT 1), 'Option') AS optionName
    FROM products WHERE id = ?`).get<Record<string, unknown>>(id);
  if (!product) return null;
  const variants = (await database.prepare(`SELECT v.id,
    COALESCE((SELECT ov.value FROM variant_option_values vov JOIN option_values ov ON ov.id = vov.option_value_id WHERE vov.variant_id = v.id LIMIT 1), v.title) AS optionValue,
    v.sku, v.price_pkr AS pricePkr, v.compare_at_pkr AS compareAtPkr, v.stock, v.low_stock_threshold AS lowStockThreshold, v.version, v.active, v.position
    FROM variants v WHERE v.product_id = ? ORDER BY v.position, v.id`).all<Record<string, unknown>>(id)).map((row) => ({ ...row, active: Boolean(row.active) }));
  return { ...product, variants };
}

export async function getAdminLookups() {
  const [categories, collections, media] = await Promise.all([
    database.prepare("SELECT id, name FROM categories WHERE archived = 0 ORDER BY position, name").all<{ id: number; name: string }>(),
    database.prepare("SELECT id, name FROM collections WHERE archived = 0 ORDER BY position, name").all<{ id: number; name: string }>(),
    database.prepare("SELECT id, display_name AS displayName, public_path AS publicPath FROM media_files WHERE replaced_at IS NULL ORDER BY id DESC").all<{ id: number; displayName: string; publicPath: string }>(),
  ]);
  return { categories, collections, media };
}

export async function getAdminHomepage() {
  const [storeSettings, sections] = await Promise.all([
    getSettings(),
    database.prepare(`SELECT id, type, title, body, image_path AS imagePath, link_label AS linkLabel,
      link_url AS linkUrl, visible, position FROM homepage_sections ORDER BY position, id`).all(),
  ]);
  const settings = {
    announcement: storeSettings.announcement,
    heroEyebrow: storeSettings.heroEyebrow,
    heroTitle: storeSettings.heroTitle,
    heroBody: storeSettings.heroBody,
    heroCtaLabel: storeSettings.heroCtaLabel,
    heroCtaUrl: storeSettings.heroCtaUrl,
    heroDesktopPath: storeSettings.heroDesktopPath,
    heroMobilePath: storeSettings.heroMobilePath,
    version: storeSettings.version,
  };
  return { settings, sections };
}

export async function getAdminOrders(input: { q?: string; orderStatus?: string; fulfillmentStatus?: string; source?: string } = {}) {
  const conditions: string[] = [];
  const parameters: string[] = [];
  if (input.q?.trim()) {
    const query = `%${input.q.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    conditions.push("(reference LIKE ? ESCAPE '\\' OR customer_name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\')");
    parameters.push(query, query, query, query);
  }
  if (input.orderStatus && ["INQUIRY", "PENDING_CONFIRMATION", "CONFIRMED", "CANCELLED"].includes(input.orderStatus)) { conditions.push("order_status = ?"); parameters.push(input.orderStatus); }
  if (input.fulfillmentStatus && ["UNFULFILLED", "PROCESSING", "SHIPPED", "DELIVERED"].includes(input.fulfillmentStatus)) { conditions.push("fulfillment_status = ?"); parameters.push(input.fulfillmentStatus); }
  if (input.source && ["STOREFRONT_COD", "WHATSAPP_INQUIRY"].includes(input.source)) { conditions.push("source = ?"); parameters.push(input.source); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return database.prepare(`SELECT id, reference, source, customer_name AS customerName, email, phone, city, order_status AS orderStatus,
    fulfillment_status AS fulfillmentStatus, payment_status AS paymentStatus, subtotal_pkr AS subtotalPkr,
    discount_pkr AS discountPkr, tax_pkr AS taxPkr, shipping_pkr AS shippingPkr, total_pkr AS totalPkr,
    coupon_code AS couponCode, courier_name AS courierName, tracking_number AS trackingNumber, created_at AS createdAt
    FROM orders ${where} ORDER BY created_at DESC`).all<Record<string, string | number | null>>(...parameters);
}

export async function getAdminOrder(id: string) {
  const order = await database.prepare(`SELECT id, reference, source, order_status AS orderStatus, fulfillment_status AS fulfillmentStatus,
    payment_status AS paymentStatus, customer_name AS customerName, email, phone, address_line1 AS addressLine1,
    address_line2 AS addressLine2, city, region, postal_code AS postalCode, country, notes,
    subtotal_pkr AS subtotalPkr, discount_pkr AS discountPkr, tax_pkr AS taxPkr, shipping_pkr AS shippingPkr,
    total_pkr AS totalPkr, coupon_code AS couponCode, coupon_type AS couponType, coupon_value AS couponValue,
    stock_allocated AS stockAllocated, stock_released AS stockReleased, courier_name AS courierName,
    tracking_number AS trackingNumber, cancellation_reason AS cancellationReason, version, created_at AS createdAt FROM orders WHERE id = ?`).get<Record<string, unknown>>(id);
  if (!order) return null;
  const [items, history, requests] = await Promise.all([
    database.prepare("SELECT id, variant_id AS variantId, product_title AS productTitle, variant_title AS variantTitle, sku, options_json AS optionsJson, unit_price_pkr AS unitPricePkr, quantity, line_total_pkr AS lineTotalPkr FROM order_items WHERE order_id = ? ORDER BY id").all(id),
    database.prepare("SELECT oh.id, oh.event, oh.note, oh.created_at AS createdAt, u.email AS actorEmail FROM order_history oh LEFT JOIN users u ON u.id = oh.actor_user_id WHERE oh.order_id = ? ORDER BY oh.id DESC").all(id),
    database.prepare("SELECT id, kind, status, reason, resolution_note AS resolutionNote, version, created_at AS createdAt, updated_at AS updatedAt FROM return_requests WHERE order_id = ? ORDER BY created_at DESC").all(id),
  ]);
  return { ...order, items, history, requests };
}

export async function getAdminCoupons() {
  const couponRows = await database.prepare(`SELECT c.id, c.code, c.description, c.type, c.value, c.enabled, c.starts_at AS startsAt,
    c.ends_at AS endsAt, c.minimum_subtotal_pkr AS minimumSubtotalPkr, c.usage_limit AS usageLimit,
    c.per_contact_limit AS perContactLimit, c.archived, c.version, c.updated_at AS updatedAt,
    (SELECT COUNT(*) FROM coupon_redemptions cr WHERE cr.coupon_id = c.id) AS usageCount
    FROM coupons c ORDER BY c.archived, c.updated_at DESC, c.id DESC`).all<Record<string, unknown>>();
  const coupons = await Promise.all(couponRows.map(async (coupon) => ({
    ...coupon,
    productIds: (await database.prepare("SELECT product_id AS id FROM coupon_products WHERE coupon_id = ?").all<{ id: number }>(coupon.id)).map((row) => row.id),
    collectionIds: (await database.prepare("SELECT collection_id AS id FROM coupon_collections WHERE coupon_id = ?").all<{ id: number }>(coupon.id)).map((row) => row.id),
  })));
  const [products, collections] = await Promise.all([
    database.prepare("SELECT id, title FROM products WHERE status != 'ARCHIVED' ORDER BY title").all<{ id: number; title: string }>(),
    database.prepare("SELECT id, name FROM collections WHERE archived = 0 ORDER BY position, name").all<{ id: number; name: string }>(),
  ]);
  return { coupons, products, collections };
}

export type TaxonomyKind = "categories" | "collections";

export async function getAdminTaxonomies(kind: TaxonomyKind) {
  const table = kind === "categories" ? "categories" : "collections";
  const foreignKey = kind === "categories" ? "category_id" : "collection_id";
  const itemRows = await database.prepare(`SELECT t.id, t.slug, t.name, t.description, t.image_path AS imagePath,
    t.position, t.visible, t.archived, t.storefront_sort AS storefrontSort, t.version, t.updated_at AS updatedAt,
    (SELECT COUNT(*) FROM products p WHERE p.${foreignKey} = t.id) AS productCount
    FROM ${table} t ORDER BY t.archived, t.position, t.name`).all<Record<string, unknown>>();
  const items = await Promise.all(itemRows.map(async (item) => ({
    ...item,
    productIds: (await database.prepare(`SELECT id FROM products WHERE ${foreignKey} = ? ORDER BY title`).all<{ id: number }>(item.id)).map((row) => row.id),
  })));
  const [products, media] = await Promise.all([
    database.prepare("SELECT id, title, status FROM products ORDER BY title").all<{ id: number; title: string; status: string }>(),
    database.prepare("SELECT id, display_name AS displayName, public_path AS publicPath FROM media_files WHERE replaced_at IS NULL ORDER BY id DESC").all<{ id: number; displayName: string; publicPath: string }>(),
  ]);
  return { items, products, media };
}

export async function getAdminInventory(input: { q?: string; low?: boolean; active?: boolean } = {}) {
  const conditions: string[] = [];
  const parameters: Array<string | number> = [];
  if (input.q?.trim()) {
    const query = `%${input.q.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    conditions.push("(v.sku LIKE ? ESCAPE '\\' OR p.title LIKE ? ESCAPE '\\' OR v.title LIKE ? ESCAPE '\\')");
    parameters.push(query, query, query);
  }
  if (input.low) conditions.push("v.stock <= v.low_stock_threshold");
  if (input.active) conditions.push("v.active = 1");
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [variants, movements] = await Promise.all([
    database.prepare(`SELECT v.id, p.title AS productTitle, p.slug AS productSlug, v.title AS variantTitle,
      v.sku, v.stock, v.low_stock_threshold AS lowStockThreshold, v.version, v.active, v.updated_at AS updatedAt
      FROM variants v JOIN products p ON p.id = v.product_id ${where}
      ORDER BY CASE WHEN v.stock <= v.low_stock_threshold THEN 0 ELSE 1 END, p.title, v.position, v.id`).all<Record<string, string | number | null>>(...parameters),
    database.prepare(`SELECT sm.id, sm.variant_id AS variantId, sm.delta, sm.stock_before AS stockBefore,
      sm.stock_after AS stockAfter, sm.reason, sm.source, sm.order_id AS orderId, sm.created_at AS createdAt,
      v.sku, p.title AS productTitle, u.email AS actorEmail
      FROM stock_movements sm JOIN variants v ON v.id = sm.variant_id JOIN products p ON p.id = v.product_id
      LEFT JOIN users u ON u.id = sm.actor_user_id ORDER BY sm.id DESC LIMIT 100`).all<Record<string, string | number | null>>(),
  ]);
  return { variants, movements };
}

export async function getAdminShippingRegions() {
  return database.prepare(`SELECT id, code, name, countries_json AS countriesJson, currency, rate_pkr AS ratePkr,
    free_shipping_threshold_pkr AS freeShippingThresholdPkr, enabled, live_checkout AS liveCheckout,
    version, updated_at AS updatedAt FROM shipping_regions ORDER BY live_checkout DESC, name`).all<Record<string, string | number | null>>();
}

export async function getAdminNewsletter() {
  return database.prepare(`SELECT id, email, consented_at AS consentedAt, consent_source AS consentSource,
    unsubscribed_at AS unsubscribedAt, updated_at AS updatedAt FROM newsletter_subscriptions ORDER BY updated_at DESC`).all<Record<string, string | number | null>>();
}

export async function getAdminReviews(input: { status?: string } = {}) {
  const status = input.status && ["PENDING", "APPROVED", "REJECTED"].includes(input.status) ? input.status : null;
  return database.prepare(`SELECT r.id, r.rating, r.title, r.body, r.status, r.customer_name AS customerName,
    r.created_at AS createdAt, p.title AS productTitle, o.reference, u.email AS moderatorEmail
    FROM reviews r JOIN products p ON p.id = r.product_id JOIN orders o ON o.id = r.order_id
    LEFT JOIN users u ON u.id = r.moderated_by ${status ? "WHERE r.status = ?" : ""}
    ORDER BY CASE r.status WHEN 'PENDING' THEN 0 WHEN 'APPROVED' THEN 1 ELSE 2 END, r.created_at DESC`).all<Record<string, string | number | null>>(...(status ? [status] : []));
}

export async function getAdminCustomers(input: { q?: string } = {}) {
  const parameters: string[] = [];
  let where = "";
  if (input.q?.trim()) {
    const query = `%${input.q.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    where = "WHERE customer_name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\'";
    parameters.push(query, query, query);
  }
  return database.prepare(`SELECT MIN(customer_name) AS customerName, LOWER(email) AS email, MIN(phone) AS phone,
    COUNT(*) AS orderCount, SUM(CASE WHEN order_status != 'CANCELLED' THEN total_pkr ELSE 0 END) AS orderedPkr,
    SUM(CASE WHEN payment_status = 'PAID' THEN total_pkr ELSE 0 END) AS collectedPkr,
    MAX(created_at) AS lastOrderAt, MIN(created_at) AS firstOrderAt
    FROM orders ${where} GROUP BY LOWER(email) ORDER BY MAX(created_at) DESC`).all<Record<string, string | number | null>>(...parameters);
}

export async function getAdminReturnRequests(input: { status?: string; q?: string } = {}) {
  const conditions: string[] = [];
  const parameters: string[] = [];
  if (input.status && ["REQUESTED", "APPROVED", "REJECTED", "RECEIVED", "COMPLETED", "CANCELLED"].includes(input.status)) { conditions.push("rr.status = ?"); parameters.push(input.status); }
  if (input.q?.trim()) {
    const query = `%${input.q.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    conditions.push("(o.reference LIKE ? ESCAPE '\\' OR o.customer_name LIKE ? ESCAPE '\\' OR o.email LIKE ? ESCAPE '\\')"); parameters.push(query, query, query);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return database.prepare(`SELECT rr.id, rr.order_id AS orderId, rr.kind, rr.status, rr.reason, rr.resolution_note AS resolutionNote,
    rr.version, rr.created_at AS createdAt, rr.updated_at AS updatedAt, o.reference, o.customer_name AS customerName,
    o.email, o.phone FROM return_requests rr JOIN orders o ON o.id = rr.order_id ${where} ORDER BY rr.created_at DESC`).all<Record<string, string | number | null>>(...parameters);
}

export async function getAdminPolicies() {
  return database.prepare("SELECT id, slug, title, content, is_template AS isTemplate, updated_at AS updatedAt FROM policies ORDER BY title").all<{ id: number; slug: string; title: string; content: string; isTemplate: number; updatedAt: number }>();
}

export async function getAdminMedia() {
  return database.prepare("SELECT id, display_name AS displayName, public_path AS publicPath, mime, bytes, width, height, sha256, replaced_by_id AS replacedById, replaced_at AS replacedAt, created_at AS createdAt FROM media_files ORDER BY id DESC").all<{ id: number; displayName: string; publicPath: string; mime: string; bytes: number; width: number | null; height: number | null; sha256: string; replacedById: number | null; replacedAt: number | null; createdAt: number }>();
}
