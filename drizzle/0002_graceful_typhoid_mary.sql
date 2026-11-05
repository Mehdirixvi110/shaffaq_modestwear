PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` integer,
	`order_id` text,
	`order_item_id` integer,
	`customer_name` text NOT NULL,
	`source` text DEFAULT 'CUSTOMER' NOT NULL,
	`city` text,
	`rating` integer NOT NULL,
	`title` text,
	`body` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`review_date` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`moderated_by` integer,
	`moderated_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`moderated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "reviews_rating_range" CHECK("__new_reviews"."rating" >= 1 AND "__new_reviews"."rating" <= 5)
);
--> statement-breakpoint
INSERT INTO `__new_reviews`("id", "product_id", "order_id", "order_item_id", "customer_name", "rating", "title", "body", "status", "moderated_by", "moderated_at", "created_at") SELECT "id", "product_id", "order_id", "order_item_id", "customer_name", "rating", "title", "body", "status", "moderated_by", "moderated_at", "created_at" FROM `reviews`;--> statement-breakpoint
DROP TABLE `reviews`;--> statement-breakpoint
ALTER TABLE `__new_reviews` RENAME TO `reviews`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_order_item_id_unique` ON `reviews` (`order_item_id`);--> statement-breakpoint
CREATE INDEX `reviews_product_status_idx` ON `reviews` (`product_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `reviews_featured_idx` ON `reviews` (`featured`,`status`);