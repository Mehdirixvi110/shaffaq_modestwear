CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`provider` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'PKR' NOT NULL,
	`provider_reference` text,
	`event_id` text,
	`last_event` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payments_amount_nonnegative" CHECK("payments"."amount" >= 0),
	CONSTRAINT "payments_currency_pkr" CHECK("payments"."currency" = 'PKR'),
	CONSTRAINT "payments_provider" CHECK("payments"."provider" IN ('COD','SAFEPAY')),
	CONSTRAINT "payments_status" CHECK("payments"."status" IN ('PENDING','PAID','FAILED','CANCELLED','REFUNDED'))
);
--> statement-breakpoint
CREATE INDEX `payments_order_idx` ON `payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `payments_status_idx` ON `payments` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_order_provider_uq` ON `payments` (`order_id`,`provider`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_event_uq` ON `payments` (`event_id`);