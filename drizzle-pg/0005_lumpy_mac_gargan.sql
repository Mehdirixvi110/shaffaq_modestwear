CREATE TABLE "payment_proofs" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"media_file_id" integer NOT NULL,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_source";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_provider";--> statement-breakpoint
ALTER TABLE "settings" DROP CONSTRAINT "settings_flags";--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "account_snapshot" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "manual_payment_enabled" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "manual_bank_name" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "manual_account_title" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "manual_account_number" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "manual_iban" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "manual_easypaisa_number" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "manual_jazzcash_number" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "manual_payment_instructions" text;--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_media_file_id_media_files_id_fk" FOREIGN KEY ("media_file_id") REFERENCES "public"."media_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_proofs_order_idx" ON "payment_proofs" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_source" CHECK ("orders"."source" IN ('STOREFRONT_COD','WHATSAPP_INQUIRY','STOREFRONT_ONLINE','STOREFRONT_MANUAL'));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_provider" CHECK ("payments"."provider" IN ('COD','SAFEPAY','MANUAL'));--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_flags" CHECK ("settings"."cod_enabled" IN (0,1) AND "settings"."tax_enabled" IN (0,1) AND "settings"."maintenance_mode" IN (0,1) AND "settings"."manual_payment_enabled" IN (0,1));