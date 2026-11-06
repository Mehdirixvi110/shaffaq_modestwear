CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"provider_reference" text,
	"event_id" text,
	"last_event" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "payments_amount_nonnegative" CHECK ("payments"."amount" >= 0),
	CONSTRAINT "payments_currency_pkr" CHECK ("payments"."currency" = 'PKR'),
	CONSTRAINT "payments_provider" CHECK ("payments"."provider" IN ('COD','SAFEPAY')),
	CONSTRAINT "payments_status" CHECK ("payments"."status" IN ('PENDING','PAID','FAILED','CANCELLED','REFUNDED'))
);
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_source";--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_order_provider_uq" ON "payments" USING btree ("order_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_event_uq" ON "payments" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_source" CHECK ("orders"."source" IN ('STOREFRONT_COD','WHATSAPP_INQUIRY','STOREFRONT_ONLINE'));