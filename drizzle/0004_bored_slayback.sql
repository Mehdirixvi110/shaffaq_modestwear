CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text DEFAULT 'PRODUCT_INQUIRY' NOT NULL,
	`status` text DEFAULT 'NEW' NOT NULL,
	`customer_name` text NOT NULL,
	`phone` text NOT NULL,
	`city` text,
	`email` text,
	`product_id` integer,
	`product_name_snapshot` text,
	`selected_options` text,
	`variant_sku` text,
	`message` text,
	`admin_notes` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "leads_status" CHECK("leads"."status" IN ('NEW','CONTACTED','CLOSED')),
	CONSTRAINT "leads_source" CHECK("leads"."source" IN ('PRODUCT_INQUIRY','CONTACT'))
);
--> statement-breakpoint
CREATE INDEX `leads_status_idx` ON `leads` (`status`);--> statement-breakpoint
CREATE INDEX `leads_created_idx` ON `leads` (`created_at`);--> statement-breakpoint
CREATE INDEX `leads_product_idx` ON `leads` (`product_id`);