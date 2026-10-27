CREATE TABLE `coupon_collections` (
	`coupon_id` integer NOT NULL,
	`collection_id` integer NOT NULL,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupon_collections_uq` ON `coupon_collections` (`coupon_id`,`collection_id`);--> statement-breakpoint
CREATE TABLE `coupon_products` (
	`coupon_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupon_products_uq` ON `coupon_products` (`coupon_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `coupon_redemptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`coupon_id` integer NOT NULL,
	`order_id` text NOT NULL,
	`contact_hash` text NOT NULL,
	`discount_pkr` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupon_redemptions_order_id_unique` ON `coupon_redemptions` (`order_id`);--> statement-breakpoint
CREATE INDEX `coupon_redemptions_coupon_idx` ON `coupon_redemptions` (`coupon_id`);--> statement-breakpoint
CREATE INDEX `coupon_redemptions_contact_idx` ON `coupon_redemptions` (`coupon_id`,`contact_hash`);--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`minimum_subtotal_pkr` integer DEFAULT 0 NOT NULL,
	`usage_limit` integer,
	`per_contact_limit` integer,
	`archived` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "coupons_value_nonnegative" CHECK("coupons"."value" >= 0),
	CONSTRAINT "coupons_minimum_nonnegative" CHECK("coupons"."minimum_subtotal_pkr" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);--> statement-breakpoint
CREATE INDEX `coupons_active_idx` ON `coupons` (`enabled`,`archived`);--> statement-breakpoint
CREATE TABLE `newsletter_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`consented_at` integer NOT NULL,
	`consent_source` text NOT NULL,
	`unsubscribe_token_hash` text NOT NULL,
	`unsubscribed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_subscriptions_email_unique` ON `newsletter_subscriptions` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_subscriptions_unsubscribe_token_hash_unique` ON `newsletter_subscriptions` (`unsubscribe_token_hash`);--> statement-breakpoint
CREATE TABLE `return_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'REQUESTED' NOT NULL,
	`reason` text NOT NULL,
	`resolution_note` text,
	`actor_user_id` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `return_requests_order_idx` ON `return_requests` (`order_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` integer NOT NULL,
	`order_id` text NOT NULL,
	`order_item_id` integer NOT NULL,
	`customer_name` text NOT NULL,
	`rating` integer NOT NULL,
	`title` text,
	`body` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`moderated_by` integer,
	`moderated_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`moderated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "reviews_rating_range" CHECK("reviews"."rating" >= 1 AND "reviews"."rating" <= 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_order_item_id_unique` ON `reviews` (`order_item_id`);--> statement-breakpoint
CREATE INDEX `reviews_product_status_idx` ON `reviews` (`product_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `shipping_regions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`countries_json` text NOT NULL,
	`currency` text DEFAULT 'PKR' NOT NULL,
	`rate_pkr` integer DEFAULT 0 NOT NULL,
	`free_shipping_threshold_pkr` integer,
	`enabled` integer DEFAULT false NOT NULL,
	`live_checkout` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "shipping_regions_rate_nonnegative" CHECK("shipping_regions"."rate_pkr" >= 0),
	CONSTRAINT "shipping_regions_currency_pkr" CHECK("shipping_regions"."currency" = 'PKR')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipping_regions_code_unique` ON `shipping_regions` (`code`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`variant_id` integer NOT NULL,
	`delta` integer NOT NULL,
	`stock_before` integer NOT NULL,
	`stock_after` integer NOT NULL,
	`reason` text NOT NULL,
	`source` text NOT NULL,
	`source_key` text,
	`order_id` text,
	`actor_user_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "stock_movements_nonnegative" CHECK("stock_movements"."stock_before" >= 0 AND "stock_movements"."stock_after" >= 0),
	CONSTRAINT "stock_movements_balance" CHECK("stock_movements"."stock_after" = "stock_movements"."stock_before" + "stock_movements"."delta")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_movements_source_key_unique` ON `stock_movements` (`source_key`);--> statement-breakpoint
CREATE INDEX `stock_movements_variant_idx` ON `stock_movements` (`variant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `wishlist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wishlist_id` text NOT NULL,
	`product_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wishlist_id`) REFERENCES `wishlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wishlist_items_product_uq` ON `wishlist_items` (`wishlist_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `wishlists` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wishlists_token_hash_unique` ON `wishlists` (`token_hash`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`source` text NOT NULL,
	`order_status` text NOT NULL,
	`fulfillment_status` text DEFAULT 'UNFULFILLED' NOT NULL,
	`payment_status` text DEFAULT 'UNPAID' NOT NULL,
	`customer_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`address_line1` text NOT NULL,
	`address_line2` text,
	`city` text NOT NULL,
	`region` text,
	`postal_code` text,
	`country` text DEFAULT 'PK' NOT NULL,
	`notes` text,
	`subtotal_pkr` integer NOT NULL,
	`discount_pkr` integer DEFAULT 0 NOT NULL,
	`tax_pkr` integer DEFAULT 0 NOT NULL,
	`shipping_pkr` integer NOT NULL,
	`total_pkr` integer NOT NULL,
	`coupon_code` text,
	`coupon_type` text,
	`coupon_value` integer,
	`stock_allocated` integer DEFAULT false NOT NULL,
	`stock_released` integer DEFAULT false NOT NULL,
	`order_access_hash` text NOT NULL,
	`courier_name` text,
	`tracking_number` text,
	`cancellation_reason` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "orders_amounts_nonnegative" CHECK("__new_orders"."subtotal_pkr" >= 0 AND "__new_orders"."discount_pkr" >= 0 AND "__new_orders"."tax_pkr" >= 0 AND "__new_orders"."shipping_pkr" >= 0 AND "__new_orders"."total_pkr" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "reference", "source", "order_status", "fulfillment_status", "payment_status", "customer_name", "email", "phone", "address_line1", "address_line2", "city", "region", "postal_code", "country", "notes", "subtotal_pkr", "discount_pkr", "tax_pkr", "shipping_pkr", "total_pkr", "coupon_code", "coupon_type", "coupon_value", "stock_allocated", "stock_released", "order_access_hash", "courier_name", "tracking_number", "cancellation_reason", "version", "created_at", "updated_at") SELECT "id", "reference", "source", "order_status", "fulfillment_status", "payment_status", "customer_name", "email", "phone", "address_line1", "address_line2", "city", "region", "postal_code", "country", "notes", "subtotal_pkr", 0, 0, "shipping_pkr", "total_pkr", NULL, NULL, NULL, "stock_allocated", "stock_released", "order_access_hash", "courier_name", "tracking_number", NULL, 1, "created_at", "updated_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_reference_unique` ON `orders` (`reference`);--> statement-breakpoint
CREATE INDEX `orders_created_idx` ON `orders` (`created_at`);--> statement-breakpoint
ALTER TABLE `carts` ADD `coupon_code` text;--> statement-breakpoint
ALTER TABLE `categories` ADD `archived` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD `storefront_sort` text DEFAULT 'FEATURED' NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `categories` SET `updated_at` = unixepoch() * 1000 WHERE `updated_at` = 0;--> statement-breakpoint
ALTER TABLE `collections` ADD `archived` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `collections` ADD `storefront_sort` text DEFAULT 'FEATURED' NOT NULL;--> statement-breakpoint
ALTER TABLE `collections` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `collections` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `collections` SET `updated_at` = unixepoch() * 1000 WHERE `updated_at` = 0;--> statement-breakpoint
ALTER TABLE `media_files` ADD `width` integer;--> statement-breakpoint
ALTER TABLE `media_files` ADD `height` integer;--> statement-breakpoint
ALTER TABLE `media_files` ADD `replaced_by_id` integer;--> statement-breakpoint
ALTER TABLE `media_files` ADD `replaced_at` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`store_name` text DEFAULT 'SHAFFAQ' NOT NULL,
	`descriptor` text DEFAULT 'Abayas & Scarves' NOT NULL,
	`announcement` text,
	`hero_eyebrow` text,
	`hero_title` text NOT NULL,
	`hero_body` text,
	`hero_cta_label` text,
	`hero_cta_url` text,
	`hero_desktop_path` text,
	`hero_mobile_path` text,
	`shipping_pkr` integer DEFAULT 0 NOT NULL,
	`free_shipping_threshold_pkr` integer,
	`cod_enabled` integer DEFAULT true NOT NULL,
	`whatsapp_number` text,
	`contact_email` text,
	`contact_phone` text,
	`tax_enabled` integer DEFAULT false NOT NULL,
	`tax_rate_bps` integer DEFAULT 0 NOT NULL,
	`returns_policy_url` text DEFAULT '/pages/returns' NOT NULL,
	`exchanges_policy_url` text DEFAULT '/pages/returns' NOT NULL,
	`instagram_url` text,
	`facebook_url` text,
	`tiktok_url` text,
	`seo_title` text DEFAULT 'SHAFFAQ | Abayas & Scarves' NOT NULL,
	`seo_description` text DEFAULT 'Explore the editable SHAFFAQ catalogue in PKR.' NOT NULL,
	`analytics_identifier` text,
	`maintenance_mode` integer DEFAULT false NOT NULL,
	`maintenance_message` text,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "settings_shipping_nonnegative" CHECK("__new_settings"."shipping_pkr" >= 0),
	CONSTRAINT "settings_tax_rate_range" CHECK("__new_settings"."tax_rate_bps" >= 0 AND "__new_settings"."tax_rate_bps" <= 10000)
);
--> statement-breakpoint
INSERT INTO `__new_settings`("id", "store_name", "descriptor", "announcement", "hero_eyebrow", "hero_title", "hero_body", "hero_cta_label", "hero_cta_url", "hero_desktop_path", "hero_mobile_path", "shipping_pkr", "free_shipping_threshold_pkr", "cod_enabled", "whatsapp_number", "contact_email", "contact_phone", "tax_enabled", "tax_rate_bps", "returns_policy_url", "exchanges_policy_url", "instagram_url", "facebook_url", "tiktok_url", "seo_title", "seo_description", "analytics_identifier", "maintenance_mode", "maintenance_message", "version", "updated_at") SELECT "id", "store_name", "descriptor", "announcement", "hero_eyebrow", "hero_title", "hero_body", "hero_cta_label", "hero_cta_url", "hero_desktop_path", "hero_mobile_path", "shipping_pkr", "free_shipping_threshold_pkr", "cod_enabled", "whatsapp_number", "contact_email", "contact_phone", 0, 0, '/pages/returns', '/pages/returns', NULL, NULL, NULL, 'SHAFFAQ | Abayas & Scarves', 'Explore the editable SHAFFAQ catalogue in PKR.', NULL, 0, NULL, 1, "updated_at" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
CREATE TABLE `__new_variants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`title` text NOT NULL,
	`sku` text NOT NULL,
	`price_pkr` integer NOT NULL,
	`compare_at_pkr` integer,
	`stock` integer DEFAULT 0 NOT NULL,
	`low_stock_threshold` integer DEFAULT 2 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "variants_price_nonnegative" CHECK("__new_variants"."price_pkr" >= 0),
	CONSTRAINT "variants_stock_nonnegative" CHECK("__new_variants"."stock" >= 0),
	CONSTRAINT "variants_threshold_nonnegative" CHECK("__new_variants"."low_stock_threshold" >= 0),
	CONSTRAINT "variants_compare_price" CHECK("__new_variants"."compare_at_pkr" IS NULL OR "__new_variants"."compare_at_pkr" > "__new_variants"."price_pkr")
);
--> statement-breakpoint
INSERT INTO `__new_variants`("id", "product_id", "title", "sku", "price_pkr", "compare_at_pkr", "stock", "low_stock_threshold", "version", "active", "position", "updated_at") SELECT "id", "product_id", "title", "sku", "price_pkr", "compare_at_pkr", "stock", 2, 1, "active", "position", "updated_at" FROM `variants`;--> statement-breakpoint
DROP TABLE `variants`;--> statement-breakpoint
ALTER TABLE `__new_variants` RENAME TO `variants`;--> statement-breakpoint
CREATE UNIQUE INDEX `variants_sku_unique` ON `variants` (`sku`);--> statement-breakpoint
CREATE INDEX `variants_product_idx` ON `variants` (`product_id`);