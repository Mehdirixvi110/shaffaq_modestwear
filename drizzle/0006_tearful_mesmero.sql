CREATE TABLE `payment_proofs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`media_file_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_file_id`) REFERENCES `media_files`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `payment_proofs_order_idx` ON `payment_proofs` (`order_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`provider` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'PKR' NOT NULL,
	`provider_reference` text,
	`event_id` text,
	`last_event` text,
	`account_snapshot` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payments_amount_nonnegative" CHECK("__new_payments"."amount" >= 0),
	CONSTRAINT "payments_currency_pkr" CHECK("__new_payments"."currency" = 'PKR'),
	CONSTRAINT "payments_provider" CHECK("__new_payments"."provider" IN ('COD','SAFEPAY','MANUAL')),
	CONSTRAINT "payments_status" CHECK("__new_payments"."status" IN ('PENDING','PAID','FAILED','CANCELLED','REFUNDED'))
);
--> statement-breakpoint
INSERT INTO `__new_payments`("id", "order_id", "provider", "status", "amount", "currency", "provider_reference", "event_id", "last_event", "version", "created_at", "updated_at") SELECT "id", "order_id", "provider", "status", "amount", "currency", "provider_reference", "event_id", "last_event", "version", "created_at", "updated_at" FROM `payments`;--> statement-breakpoint
DROP TABLE `payments`;--> statement-breakpoint
ALTER TABLE `__new_payments` RENAME TO `payments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `payments_order_idx` ON `payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `payments_status_idx` ON `payments` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_order_provider_uq` ON `payments` (`order_id`,`provider`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_event_uq` ON `payments` (`event_id`);--> statement-breakpoint
ALTER TABLE `settings` ADD `manual_payment_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `manual_bank_name` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `manual_account_title` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `manual_account_number` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `manual_iban` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `manual_easypaisa_number` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `manual_jazzcash_number` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `manual_payment_instructions` text;