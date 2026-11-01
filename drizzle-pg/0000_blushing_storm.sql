CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" integer,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"detail_json" text DEFAULT '{}' NOT NULL,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"variant_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "cart_items_quantity_range" CHECK ("cart_items"."quantity" >= 1 AND "cart_items"."quantity" <= 20)
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	"coupon_code" text,
	CONSTRAINT "carts_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_path" text,
	"position" integer DEFAULT 0 NOT NULL,
	"visible" integer DEFAULT 1 NOT NULL,
	"archived" integer DEFAULT 0 NOT NULL,
	"storefront_sort" text DEFAULT 'FEATURED' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "categories_flags" CHECK ("categories"."visible" IN (0,1) AND "categories"."archived" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE "checkout_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_hash" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"order_id" text NOT NULL,
	"response_json" text NOT NULL,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_path" text,
	"position" integer DEFAULT 0 NOT NULL,
	"visible" integer DEFAULT 1 NOT NULL,
	"archived" integer DEFAULT 0 NOT NULL,
	"storefront_sort" text DEFAULT 'FEATURED' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "collections_slug_unique" UNIQUE("slug"),
	CONSTRAINT "collections_flags" CHECK ("collections"."visible" IN (0,1) AND "collections"."archived" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE "coupon_collections" (
	"coupon_id" integer NOT NULL,
	"collection_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_products" (
	"coupon_id" integer NOT NULL,
	"product_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"coupon_id" integer NOT NULL,
	"order_id" text NOT NULL,
	"contact_hash" text NOT NULL,
	"discount_pkr" bigint NOT NULL,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "coupon_redemptions_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"starts_at" bigint,
	"ends_at" bigint,
	"minimum_subtotal_pkr" bigint DEFAULT 0 NOT NULL,
	"usage_limit" integer,
	"per_contact_limit" integer,
	"archived" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code"),
	CONSTRAINT "coupons_value_nonnegative" CHECK ("coupons"."value" >= 0),
	CONSTRAINT "coupons_minimum_nonnegative" CHECK ("coupons"."minimum_subtotal_pkr" >= 0),
	CONSTRAINT "coupons_flags" CHECK ("coupons"."enabled" IN (0,1) AND "coupons"."archived" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE "homepage_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text,
	"body" text,
	"image_path" text,
	"link_label" text,
	"link_url" text,
	"visible" integer DEFAULT 1 NOT NULL,
	"position" integer NOT NULL,
	"updated_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "homepage_sections_visible_flag" CHECK ("homepage_sections"."visible" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"storage_key" text,
	"public_path" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"sha256" text NOT NULL,
	"replaced_by_id" integer,
	"replaced_at" bigint,
	"created_by" integer,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "media_files_public_path_unique" UNIQUE("public_path"),
	CONSTRAINT "media_files_size_nonnegative" CHECK ("media_files"."bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"consented_at" bigint NOT NULL,
	"consent_source" text NOT NULL,
	"unsubscribe_token_hash" text NOT NULL,
	"unsubscribed_at" bigint,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "newsletter_subscriptions_email_unique" UNIQUE("email"),
	CONSTRAINT "newsletter_subscriptions_unsubscribe_token_hash_unique" UNIQUE("unsubscribe_token_hash")
);
--> statement-breakpoint
CREATE TABLE "option_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"option_id" integer NOT NULL,
	"value" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"event" text NOT NULL,
	"note" text,
	"actor_user_id" integer,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_id" integer,
	"variant_id" integer,
	"product_title" text NOT NULL,
	"product_slug" text NOT NULL,
	"variant_title" text NOT NULL,
	"sku" text NOT NULL,
	"options_json" text NOT NULL,
	"unit_price_pkr" bigint NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_pkr" bigint NOT NULL,
	CONSTRAINT "order_items_amounts_positive" CHECK ("order_items"."unit_price_pkr" >= 0 AND "order_items"."quantity" > 0 AND "order_items"."line_total_pkr" >= 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"source" text NOT NULL,
	"order_status" text NOT NULL,
	"fulfillment_status" text DEFAULT 'UNFULFILLED' NOT NULL,
	"payment_status" text DEFAULT 'UNPAID' NOT NULL,
	"customer_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"region" text,
	"postal_code" text,
	"country" text DEFAULT 'PK' NOT NULL,
	"notes" text,
	"subtotal_pkr" bigint NOT NULL,
	"discount_pkr" bigint DEFAULT 0 NOT NULL,
	"tax_pkr" bigint DEFAULT 0 NOT NULL,
	"shipping_pkr" bigint NOT NULL,
	"total_pkr" bigint NOT NULL,
	"coupon_code" text,
	"coupon_type" text,
	"coupon_value" bigint,
	"stock_allocated" integer DEFAULT 0 NOT NULL,
	"stock_released" integer DEFAULT 0 NOT NULL,
	"order_access_hash" text NOT NULL,
	"courier_name" text,
	"tracking_number" text,
	"cancellation_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "orders_reference_unique" UNIQUE("reference"),
	CONSTRAINT "orders_amounts_nonnegative" CHECK ("orders"."subtotal_pkr" >= 0 AND "orders"."discount_pkr" >= 0 AND "orders"."tax_pkr" >= 0 AND "orders"."shipping_pkr" >= 0 AND "orders"."total_pkr" >= 0),
	CONSTRAINT "orders_stock_flags" CHECK ("orders"."stock_allocated" IN (0,1) AND "orders"."stock_released" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"is_template" integer DEFAULT 1 NOT NULL,
	"updated_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "policies_slug_unique" UNIQUE("slug"),
	CONSTRAINT "policies_template_flag" CHECK ("policies"."is_template" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"path" text NOT NULL,
	"alt" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"name" text NOT NULL,
	"required" integer DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "product_options_required_flag" CHECK ("product_options"."required" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category_id" integer,
	"collection_id" integer,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"is_featured" integer DEFAULT 0 NOT NULL,
	"is_sample" integer DEFAULT 0 NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_flags" CHECK ("products"."is_featured" IN (0,1) AND "products"."is_sample" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE "return_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'REQUESTED' NOT NULL,
	"reason" text NOT NULL,
	"resolution_note" text,
	"actor_user_id" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"order_id" text NOT NULL,
	"order_item_id" integer NOT NULL,
	"customer_name" text NOT NULL,
	"rating" integer NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"moderated_by" integer,
	"moderated_at" bigint,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "reviews_order_item_id_unique" UNIQUE("order_item_id"),
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" >= 1 AND "reviews"."rating" <= 5)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"store_name" text DEFAULT 'SHAFFAQ' NOT NULL,
	"descriptor" text DEFAULT 'Abayas & Scarves' NOT NULL,
	"announcement" text,
	"hero_eyebrow" text,
	"hero_title" text NOT NULL,
	"hero_body" text,
	"hero_cta_label" text,
	"hero_cta_url" text,
	"hero_desktop_path" text,
	"hero_mobile_path" text,
	"shipping_pkr" bigint DEFAULT 0 NOT NULL,
	"free_shipping_threshold_pkr" bigint,
	"cod_enabled" integer DEFAULT 1 NOT NULL,
	"whatsapp_number" text,
	"contact_email" text,
	"contact_phone" text,
	"tax_enabled" integer DEFAULT 0 NOT NULL,
	"tax_rate_bps" integer DEFAULT 0 NOT NULL,
	"returns_policy_url" text DEFAULT '/pages/returns' NOT NULL,
	"exchanges_policy_url" text DEFAULT '/pages/returns' NOT NULL,
	"instagram_url" text,
	"facebook_url" text,
	"tiktok_url" text,
	"seo_title" text DEFAULT 'SHAFFAQ | Abayas & Scarves' NOT NULL,
	"seo_description" text DEFAULT 'Explore the editable SHAFFAQ catalogue in PKR.' NOT NULL,
	"analytics_identifier" text,
	"maintenance_mode" integer DEFAULT 0 NOT NULL,
	"maintenance_message" text,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "settings_shipping_nonnegative" CHECK ("settings"."shipping_pkr" >= 0),
	CONSTRAINT "settings_free_shipping_nonnegative" CHECK ("settings"."free_shipping_threshold_pkr" IS NULL OR "settings"."free_shipping_threshold_pkr" >= 0),
	CONSTRAINT "settings_tax_rate_range" CHECK ("settings"."tax_rate_bps" >= 0 AND "settings"."tax_rate_bps" <= 10000),
	CONSTRAINT "settings_flags" CHECK ("settings"."cod_enabled" IN (0,1) AND "settings"."tax_enabled" IN (0,1) AND "settings"."maintenance_mode" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE "shipping_regions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"countries_json" text NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"rate_pkr" bigint DEFAULT 0 NOT NULL,
	"free_shipping_threshold_pkr" bigint,
	"enabled" integer DEFAULT 0 NOT NULL,
	"live_checkout" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "shipping_regions_code_unique" UNIQUE("code"),
	CONSTRAINT "shipping_regions_rate_nonnegative" CHECK ("shipping_regions"."rate_pkr" >= 0),
	CONSTRAINT "shipping_regions_free_shipping_nonnegative" CHECK ("shipping_regions"."free_shipping_threshold_pkr" IS NULL OR "shipping_regions"."free_shipping_threshold_pkr" >= 0),
	CONSTRAINT "shipping_regions_currency_pkr" CHECK ("shipping_regions"."currency" = 'PKR'),
	CONSTRAINT "shipping_regions_flags" CHECK ("shipping_regions"."enabled" IN (0,1) AND "shipping_regions"."live_checkout" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"variant_id" integer NOT NULL,
	"delta" integer NOT NULL,
	"stock_before" integer NOT NULL,
	"stock_after" integer NOT NULL,
	"reason" text NOT NULL,
	"source" text NOT NULL,
	"source_key" text,
	"order_id" text,
	"actor_user_id" integer,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "stock_movements_source_key_unique" UNIQUE("source_key"),
	CONSTRAINT "stock_movements_nonnegative" CHECK ("stock_movements"."stock_before" >= 0 AND "stock_movements"."stock_after" >= 0),
	CONSTRAINT "stock_movements_balance" CHECK ("stock_movements"."stock_after" = "stock_movements"."stock_before" + "stock_movements"."delta")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'CUSTOMER' NOT NULL,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "variant_option_values" (
	"variant_id" integer NOT NULL,
	"option_value_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"title" text NOT NULL,
	"sku" text NOT NULL,
	"price_pkr" bigint NOT NULL,
	"compare_at_pkr" bigint,
	"stock" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 2 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"updated_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "variants_sku_unique" UNIQUE("sku"),
	CONSTRAINT "variants_price_nonnegative" CHECK ("variants"."price_pkr" >= 0),
	CONSTRAINT "variants_stock_nonnegative" CHECK ("variants"."stock" >= 0),
	CONSTRAINT "variants_threshold_nonnegative" CHECK ("variants"."low_stock_threshold" >= 0),
	CONSTRAINT "variants_compare_price" CHECK ("variants"."compare_at_pkr" IS NULL OR "variants"."compare_at_pkr" > "variants"."price_pkr"),
	CONSTRAINT "variants_active_flag" CHECK ("variants"."active" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"wishlist_id" text NOT NULL,
	"product_id" integer NOT NULL,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "wishlists_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_requests" ADD CONSTRAINT "checkout_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_collections" ADD CONSTRAINT "coupon_collections_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_collections" ADD CONSTRAINT "coupon_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_products" ADD CONSTRAINT "coupon_products_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_products" ADD CONSTRAINT "coupon_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_values" ADD CONSTRAINT "option_values_option_id_product_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "product_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_history" ADD CONSTRAINT "order_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_history" ADD CONSTRAINT "order_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_options" ADD CONSTRAINT "product_options_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_option_value_id_option_values_id_fk" FOREIGN KEY ("option_value_id") REFERENCES "option_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlist_id_wishlists_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "wishlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cart_items_variant_uq" ON "cart_items" USING btree ("cart_id","variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_requests_subject_key_uq" ON "checkout_requests" USING btree ("subject_hash","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_collections_uq" ON "coupon_collections" USING btree ("coupon_id","collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_products_uq" ON "coupon_products" USING btree ("coupon_id","product_id");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_coupon_idx" ON "coupon_redemptions" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_contact_idx" ON "coupon_redemptions" USING btree ("coupon_id","contact_hash");--> statement-breakpoint
CREATE INDEX "coupons_active_idx" ON "coupons" USING btree ("enabled","archived");--> statement-breakpoint
CREATE UNIQUE INDEX "homepage_sections_position_uq" ON "homepage_sections" USING btree ("position");--> statement-breakpoint
CREATE UNIQUE INDEX "option_values_value_uq" ON "option_values" USING btree ("option_id","value");--> statement-breakpoint
CREATE INDEX "order_history_order_idx" ON "order_history" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_options_name_uq" ON "product_options" USING btree ("product_id","name");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_collection_idx" ON "products" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "return_requests_order_idx" ON "return_requests" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "reviews_product_status_idx" ON "reviews" USING btree ("product_id","status","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stock_movements_variant_idx" ON "stock_movements" USING btree ("variant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "variant_option_values_uq" ON "variant_option_values" USING btree ("variant_id","option_value_id");--> statement-breakpoint
CREATE INDEX "variants_product_idx" ON "variants" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wishlist_items_product_uq" ON "wishlist_items" USING btree ("wishlist_id","product_id");