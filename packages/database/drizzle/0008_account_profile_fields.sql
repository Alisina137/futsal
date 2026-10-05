ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_image_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "age" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "city" varchar(80);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" varchar(280);--> statement-breakpoint
