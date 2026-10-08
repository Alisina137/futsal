ALTER TABLE "venues" ADD COLUMN "online_booking_enabled" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "minimum_booking_notice_minutes" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "maximum_advance_booking_days" integer NOT NULL DEFAULT 30;
