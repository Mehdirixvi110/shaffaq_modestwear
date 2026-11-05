ALTER TABLE "reviews" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "order_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "source" text DEFAULT 'CUSTOMER' NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "featured" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "review_date" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "updated_at" bigint DEFAULT floor(extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL;--> statement-breakpoint
CREATE INDEX "reviews_featured_idx" ON "reviews" USING btree ("featured","status");--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_source" CHECK ("reviews"."source" IN ('CUSTOMER','ADMIN'));--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_featured_flag" CHECK ("reviews"."featured" IN (0,1));