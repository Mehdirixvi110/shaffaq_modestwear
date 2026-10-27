import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch() * 1000)`;

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  storeName: text("store_name").notNull().default("SHAFFAQ"),
  descriptor: text("descriptor").notNull().default("Abayas & Scarves"),
  announcement: text("announcement"),
  heroEyebrow: text("hero_eyebrow"),
  heroTitle: text("hero_title").notNull(),
  heroBody: text("hero_body"),
  heroCtaLabel: text("hero_cta_label"),
  heroCtaUrl: text("hero_cta_url"),
  heroDesktopPath: text("hero_desktop_path"),
  heroMobilePath: text("hero_mobile_path"),
  shippingPkr: integer("shipping_pkr").notNull().default(0),
  freeShippingThresholdPkr: integer("free_shipping_threshold_pkr"),
  codEnabled: integer("cod_enabled", { mode: "boolean" }).notNull().default(true),
  whatsappNumber: text("whatsapp_number"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  taxEnabled: integer("tax_enabled", { mode: "boolean" }).notNull().default(false),
  taxRateBps: integer("tax_rate_bps").notNull().default(0),
  returnsPolicyUrl: text("returns_policy_url").notNull().default("/pages/returns"),
  exchangesPolicyUrl: text("exchanges_policy_url").notNull().default("/pages/returns"),
  instagramUrl: text("instagram_url"),
  facebookUrl: text("facebook_url"),
  tiktokUrl: text("tiktok_url"),
  seoTitle: text("seo_title").notNull().default("SHAFFAQ | Abayas & Scarves"),
  seoDescription: text("seo_description").notNull().default("Explore the editable SHAFFAQ catalogue in PKR."),
  analyticsIdentifier: text("analytics_identifier"),
  maintenanceMode: integer("maintenance_mode", { mode: "boolean" }).notNull().default(false),
  maintenanceMessage: text("maintenance_message"),
  version: integer("version").notNull().default(1),
  updatedAt: integer("updated_at").notNull().default(now),
}, (table) => [
  check("settings_shipping_nonnegative", sql`${table.shippingPkr} >= 0`),
  check("settings_tax_rate_range", sql`${table.taxRateBps} >= 0 AND ${table.taxRateBps} <= 10000`),
]);

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  imagePath: text("image_path"),
  position: integer("position").notNull().default(0),
  visible: integer("visible", { mode: "boolean" }).notNull().default(true),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  storefrontSort: text("storefront_sort", { enum: ["FEATURED", "NEWEST", "PRICE_ASC", "PRICE_DESC"] }).notNull().default("FEATURED"),
  version: integer("version").notNull().default(1),
  createdAt: integer("created_at").notNull().default(now),
  updatedAt: integer("updated_at").notNull().default(now),
});

export const collections = sqliteTable("collections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  imagePath: text("image_path"),
  position: integer("position").notNull().default(0),
  visible: integer("visible", { mode: "boolean" }).notNull().default(true),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  storefrontSort: text("storefront_sort", { enum: ["FEATURED", "NEWEST", "PRICE_ASC", "PRICE_DESC"] }).notNull().default("FEATURED"),
  version: integer("version").notNull().default(1),
  createdAt: integer("created_at").notNull().default(now),
  updatedAt: integer("updated_at").notNull().default(now),
});

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  collectionId: integer("collection_id").references(() => collections.id, { onDelete: "set null" }),
  status: text("status", { enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] }).notNull().default("DRAFT"),
  isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
  isSample: integer("is_sample", { mode: "boolean" }).notNull().default(false),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  version: integer("version").notNull().default(1),
  createdAt: integer("created_at").notNull().default(now),
  updatedAt: integer("updated_at").notNull().default(now),
}, (table) => [
  index("products_category_idx").on(table.categoryId),
  index("products_collection_idx").on(table.collectionId),
  index("products_status_idx").on(table.status),
]);

export const productImages = sqliteTable("product_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  alt: text("alt").notNull(),
  position: integer("position").notNull().default(0),
}, (table) => [index("product_images_product_idx").on(table.productId)]);

export const productOptions = sqliteTable("product_options", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  required: integer("required", { mode: "boolean" }).notNull().default(true),
  position: integer("position").notNull().default(0),
}, (table) => [uniqueIndex("product_options_name_uq").on(table.productId, table.name)]);

export const optionValues = sqliteTable("option_values", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  optionId: integer("option_id").notNull().references(() => productOptions.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  position: integer("position").notNull().default(0),
}, (table) => [uniqueIndex("option_values_value_uq").on(table.optionId, table.value)]);

export const variants = sqliteTable("variants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sku: text("sku").notNull().unique(),
  pricePkr: integer("price_pkr").notNull(),
  compareAtPkr: integer("compare_at_pkr"),
  stock: integer("stock").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(2),
  version: integer("version").notNull().default(1),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  position: integer("position").notNull().default(0),
  updatedAt: integer("updated_at").notNull().default(now),
}, (table) => [
  index("variants_product_idx").on(table.productId),
  check("variants_price_nonnegative", sql`${table.pricePkr} >= 0`),
  check("variants_stock_nonnegative", sql`${table.stock} >= 0`),
  check("variants_threshold_nonnegative", sql`${table.lowStockThreshold} >= 0`),
  check("variants_compare_price", sql`${table.compareAtPkr} IS NULL OR ${table.compareAtPkr} > ${table.pricePkr}`),
]);

export const variantOptionValues = sqliteTable("variant_option_values", {
  variantId: integer("variant_id").notNull().references(() => variants.id, { onDelete: "cascade" }),
  optionValueId: integer("option_value_id").notNull().references(() => optionValues.id, { onDelete: "cascade" }),
}, (table) => [
  uniqueIndex("variant_option_values_uq").on(table.variantId, table.optionValueId),
]);

export const carts = sqliteTable("carts", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: integer("created_at").notNull().default(now),
  updatedAt: integer("updated_at").notNull().default(now),
  couponCode: text("coupon_code"),
});

export const cartItems = sqliteTable("cart_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cartId: text("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").notNull().references(() => variants.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
}, (table) => [
  uniqueIndex("cart_items_variant_uq").on(table.cartId, table.variantId),
  check("cart_items_quantity_range", sql`${table.quantity} >= 1 AND ${table.quantity} <= 20`),
]);

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["ADMIN", "CUSTOMER"] }).notNull().default("CUSTOMER"),
  createdAt: integer("created_at").notNull().default(now),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull().default(now),
}, (table) => [index("sessions_user_idx").on(table.userId)]);

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  reference: text("reference").notNull().unique(),
  source: text("source", { enum: ["STOREFRONT_COD", "WHATSAPP_INQUIRY"] }).notNull(),
  orderStatus: text("order_status", { enum: ["INQUIRY", "PENDING_CONFIRMATION", "CONFIRMED", "CANCELLED"] }).notNull(),
  fulfillmentStatus: text("fulfillment_status", { enum: ["UNFULFILLED", "PROCESSING", "SHIPPED", "DELIVERED"] }).notNull().default("UNFULFILLED"),
  paymentStatus: text("payment_status", { enum: ["UNPAID", "PAID"] }).notNull().default("UNPAID"),
  customerName: text("customer_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city").notNull(),
  region: text("region"),
  postalCode: text("postal_code"),
  country: text("country").notNull().default("PK"),
  notes: text("notes"),
  subtotalPkr: integer("subtotal_pkr").notNull(),
  discountPkr: integer("discount_pkr").notNull().default(0),
  taxPkr: integer("tax_pkr").notNull().default(0),
  shippingPkr: integer("shipping_pkr").notNull(),
  totalPkr: integer("total_pkr").notNull(),
  couponCode: text("coupon_code"),
  couponType: text("coupon_type"),
  couponValue: integer("coupon_value"),
  stockAllocated: integer("stock_allocated", { mode: "boolean" }).notNull().default(false),
  stockReleased: integer("stock_released", { mode: "boolean" }).notNull().default(false),
  orderAccessHash: text("order_access_hash").notNull(),
  courierName: text("courier_name"),
  trackingNumber: text("tracking_number"),
  cancellationReason: text("cancellation_reason"),
  version: integer("version").notNull().default(1),
  createdAt: integer("created_at").notNull().default(now),
  updatedAt: integer("updated_at").notNull().default(now),
}, (table) => [
  index("orders_created_idx").on(table.createdAt),
  check("orders_amounts_nonnegative", sql`${table.subtotalPkr} >= 0 AND ${table.discountPkr} >= 0 AND ${table.taxPkr} >= 0 AND ${table.shippingPkr} >= 0 AND ${table.totalPkr} >= 0`),
]);

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  variantId: integer("variant_id").references(() => variants.id, { onDelete: "set null" }),
  productTitle: text("product_title").notNull(),
  productSlug: text("product_slug").notNull(),
  variantTitle: text("variant_title").notNull(),
  sku: text("sku").notNull(),
  optionsJson: text("options_json").notNull(),
  unitPricePkr: integer("unit_price_pkr").notNull(),
  quantity: integer("quantity").notNull(),
  lineTotalPkr: integer("line_total_pkr").notNull(),
}, (table) => [index("order_items_order_idx").on(table.orderId)]);

export const orderHistory = sqliteTable("order_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  note: text("note"),
  actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at").notNull().default(now),
}, (table) => [index("order_history_order_idx").on(table.orderId)]);

export const checkoutRequests = sqliteTable("checkout_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subjectHash: text("subject_hash").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  requestHash: text("request_hash").notNull(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  responseJson: text("response_json").notNull(),
  createdAt: integer("created_at").notNull().default(now),
}, (table) => [uniqueIndex("checkout_requests_subject_key_uq").on(table.subjectHash, table.idempotencyKey)]);

export const homepageSections = sqliteTable("homepage_sections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["CATEGORY_GRID", "FEATURED", "CAMPAIGN", "EDITORIAL", "REVIEWS", "SERVICES"] }).notNull(),
  title: text("title"),
  body: text("body"),
  imagePath: text("image_path"),
  linkLabel: text("link_label"),
  linkUrl: text("link_url"),
  visible: integer("visible", { mode: "boolean" }).notNull().default(true),
  position: integer("position").notNull(),
  updatedAt: integer("updated_at").notNull().default(now),
}, (table) => [uniqueIndex("homepage_sections_position_uq").on(table.position)]);

export const policies = sqliteTable("policies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  isTemplate: integer("is_template", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at").notNull().default(now),
});

export const mediaFiles = sqliteTable("media_files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  displayName: text("display_name").notNull(),
  storageKey: text("storage_key"),
  publicPath: text("public_path").notNull().unique(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  sha256: text("sha256").notNull(),
  replacedById: integer("replaced_by_id"),
  replacedAt: integer("replaced_at"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at").notNull().default(now),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  detailJson: text("detail_json").notNull().default("{}"),
  createdAt: integer("created_at").notNull().default(now),
}, (table) => [index("audit_logs_created_idx").on(table.createdAt)]);

export const stockMovements = sqliteTable("stock_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  variantId: integer("variant_id").notNull().references(() => variants.id, { onDelete: "restrict" }),
  delta: integer("delta").notNull(),
  stockBefore: integer("stock_before").notNull(),
  stockAfter: integer("stock_after").notNull(),
  reason: text("reason").notNull(),
  source: text("source", { enum: ["CHECKOUT", "ORDER_CONFIRM", "ORDER_CANCEL", "MANUAL", "INITIAL", "PRODUCT_IMPORT"] }).notNull(),
  sourceKey: text("source_key").unique(),
  orderId: text("order_id").references(() => orders.id, { onDelete: "restrict" }),
  actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at").notNull().default(now),
}, (table) => [
  index("stock_movements_variant_idx").on(table.variantId, table.createdAt),
  check("stock_movements_nonnegative", sql`${table.stockBefore} >= 0 AND ${table.stockAfter} >= 0`),
  check("stock_movements_balance", sql`${table.stockAfter} = ${table.stockBefore} + ${table.delta}`),
]);

export const coupons = sqliteTable("coupons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  description: text("description"),
  type: text("type", { enum: ["PERCENT", "FIXED", "FREE_SHIPPING"] }).notNull(),
  value: integer("value").notNull().default(0),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  startsAt: integer("starts_at"),
  endsAt: integer("ends_at"),
  minimumSubtotalPkr: integer("minimum_subtotal_pkr").notNull().default(0),
  usageLimit: integer("usage_limit"),
  perContactLimit: integer("per_contact_limit"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  version: integer("version").notNull().default(1),
  createdAt: integer("created_at").notNull().default(now),
  updatedAt: integer("updated_at").notNull().default(now),
}, (table) => [
  index("coupons_active_idx").on(table.enabled, table.archived),
  check("coupons_value_nonnegative", sql`${table.value} >= 0`),
  check("coupons_minimum_nonnegative", sql`${table.minimumSubtotalPkr} >= 0`),
]);

export const couponProducts = sqliteTable("coupon_products", {
  couponId: integer("coupon_id").notNull().references(() => coupons.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
}, (table) => [uniqueIndex("coupon_products_uq").on(table.couponId, table.productId)]);

export const couponCollections = sqliteTable("coupon_collections", {
  couponId: integer("coupon_id").notNull().references(() => coupons.id, { onDelete: "cascade" }),
  collectionId: integer("collection_id").notNull().references(() => collections.id, { onDelete: "restrict" }),
}, (table) => [uniqueIndex("coupon_collections_uq").on(table.couponId, table.collectionId)]);

export const couponRedemptions = sqliteTable("coupon_redemptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  couponId: integer("coupon_id").notNull().references(() => coupons.id, { onDelete: "restrict" }),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }).unique(),
  contactHash: text("contact_hash").notNull(),
  discountPkr: integer("discount_pkr").notNull(),
  createdAt: integer("created_at").notNull().default(now),
}, (table) => [
  index("coupon_redemptions_coupon_idx").on(table.couponId),
  index("coupon_redemptions_contact_idx").on(table.couponId, table.contactHash),
]);

export const returnRequests = sqliteTable("return_requests", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  kind: text("kind", { enum: ["RETURN", "EXCHANGE"] }).notNull(),
  status: text("status", { enum: ["REQUESTED", "APPROVED", "REJECTED", "RECEIVED", "COMPLETED", "CANCELLED"] }).notNull().default("REQUESTED"),
  reason: text("reason").notNull(),
  resolutionNote: text("resolution_note"),
  actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  version: integer("version").notNull().default(1),
  createdAt: integer("created_at").notNull().default(now),
  updatedAt: integer("updated_at").notNull().default(now),
}, (table) => [index("return_requests_order_idx").on(table.orderId, table.createdAt)]);

export const wishlists = sqliteTable("wishlists", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: integer("created_at").notNull().default(now),
  updatedAt: integer("updated_at").notNull().default(now),
});

export const wishlistItems = sqliteTable("wishlist_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  wishlistId: text("wishlist_id").notNull().references(() => wishlists.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: integer("created_at").notNull().default(now),
}, (table) => [uniqueIndex("wishlist_items_product_uq").on(table.wishlistId, table.productId)]);

export const newsletterSubscriptions = sqliteTable("newsletter_subscriptions", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  consentedAt: integer("consented_at").notNull(),
  consentSource: text("consent_source").notNull(),
  unsubscribeTokenHash: text("unsubscribe_token_hash").notNull().unique(),
  unsubscribedAt: integer("unsubscribed_at"),
  createdAt: integer("created_at").notNull().default(now),
  updatedAt: integer("updated_at").notNull().default(now),
});

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  orderItemId: integer("order_item_id").notNull().references(() => orderItems.id, { onDelete: "restrict" }).unique(),
  customerName: text("customer_name").notNull(),
  rating: integer("rating").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED"] }).notNull().default("PENDING"),
  moderatedBy: integer("moderated_by").references(() => users.id, { onDelete: "set null" }),
  moderatedAt: integer("moderated_at"),
  createdAt: integer("created_at").notNull().default(now),
}, (table) => [
  index("reviews_product_status_idx").on(table.productId, table.status, table.createdAt),
  check("reviews_rating_range", sql`${table.rating} >= 1 AND ${table.rating} <= 5`),
]);

export const shippingRegions = sqliteTable("shipping_regions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  countriesJson: text("countries_json").notNull(),
  currency: text("currency").notNull().default("PKR"),
  ratePkr: integer("rate_pkr").notNull().default(0),
  freeShippingThresholdPkr: integer("free_shipping_threshold_pkr"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  liveCheckout: integer("live_checkout", { mode: "boolean" }).notNull().default(false),
  version: integer("version").notNull().default(1),
  createdAt: integer("created_at").notNull().default(now),
  updatedAt: integer("updated_at").notNull().default(now),
}, (table) => [
  check("shipping_regions_rate_nonnegative", sql`${table.ratePkr} >= 0`),
  check("shipping_regions_currency_pkr", sql`${table.currency} = 'PKR'`),
]);
