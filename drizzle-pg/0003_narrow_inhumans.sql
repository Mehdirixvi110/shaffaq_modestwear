CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'PRODUCT_INQUIRY' NOT NULL,
	"status" text DEFAULT 'NEW' NOT NULL,
	"customer_name" text NOT NULL,
	"phone" text NOT NULL,
	"city" text,
	"email" text,
	"product_id" integer,
	"product_name_snapshot" text,
	"selected_options" text,
	"variant_sku" text,
	"message" text,
	"admin_notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL,
	CONSTRAINT "leads_status" CHECK ("leads"."status" IN ('NEW','CONTACTED','CLOSED')),
	CONSTRAINT "leads_source" CHECK ("leads"."source" IN ('PRODUCT_INQUIRY','CONTACT'))
);
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_created_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "leads_product_idx" ON "leads" USING btree ("product_id");