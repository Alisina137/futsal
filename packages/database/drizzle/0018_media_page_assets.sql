ALTER TABLE "venues" ADD COLUMN "page_profile_image_url" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "page_cover_image_url" text;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "page_bio" varchar(500);
--> statement-breakpoint
CREATE TABLE "venue_media_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "venue_id" uuid NOT NULL REFERENCES "venues"("id") ON DELETE cascade,
  "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "public_token" varchar(64) NOT NULL,
  "purpose" varchar(20) NOT NULL,
  "mime_type" varchar(40) NOT NULL,
  "byte_size" integer NOT NULL,
  "data_base64" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "venue_media_assets_public_token_uq" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE INDEX "venue_media_assets_venue_idx" ON "venue_media_assets" USING btree ("venue_id","created_at");
--> statement-breakpoint
CREATE INDEX "venue_media_assets_owner_idx" ON "venue_media_assets" USING btree ("owner_user_id","created_at");
