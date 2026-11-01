ALTER TABLE "categories" ADD CONSTRAINT "categories_sort" CHECK ("categories"."storefront_sort" IN ('FEATURED','NEWEST','PRICE_ASC','PRICE_DESC'));--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_sort" CHECK ("collections"."storefront_sort" IN ('FEATURED','NEWEST','PRICE_ASC','PRICE_DESC'));--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_type" CHECK ("coupons"."type" IN ('PERCENT','FIXED','FREE_SHIPPING'));--> statement-breakpoint
ALTER TABLE "homepage_sections" ADD CONSTRAINT "homepage_sections_type" CHECK ("homepage_sections"."type" IN ('CATEGORY_GRID','FEATURED','CAMPAIGN','EDITORIAL','REVIEWS','SERVICES'));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_source" CHECK ("orders"."source" IN ('STOREFRONT_COD','WHATSAPP_INQUIRY'));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_statuses" CHECK ("orders"."order_status" IN ('INQUIRY','PENDING_CONFIRMATION','CONFIRMED','CANCELLED') AND "orders"."fulfillment_status" IN ('UNFULFILLED','PROCESSING','SHIPPED','DELIVERED') AND "orders"."payment_status" IN ('UNPAID','PAID'));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_status" CHECK ("products"."status" IN ('DRAFT','PUBLISHED','ARCHIVED'));--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_kind" CHECK ("return_requests"."kind" IN ('RETURN','EXCHANGE'));--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_status" CHECK ("return_requests"."status" IN ('REQUESTED','APPROVED','REJECTED','RECEIVED','COMPLETED','CANCELLED'));--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_status" CHECK ("reviews"."status" IN ('PENDING','APPROVED','REJECTED'));--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_source" CHECK ("stock_movements"."source" IN ('CHECKOUT','ORDER_CONFIRM','ORDER_CANCEL','MANUAL','INITIAL','PRODUCT_IMPORT'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role" CHECK ("users"."role" IN ('ADMIN','CUSTOMER'));