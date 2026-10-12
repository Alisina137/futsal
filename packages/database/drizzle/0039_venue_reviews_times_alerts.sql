-- Verified, non-anonymous booking-based reviews. One review per confirmed completed reservation.
CREATE TABLE IF NOT EXISTS "venue_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "venue_id" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
  "booking_id" uuid NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "rating" integer NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "body" varchar(500) NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "venue_reviews_booking_uq" UNIQUE ("booking_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_reviews_venue_created_idx" ON "venue_reviews" ("venue_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_reviews_user_idx" ON "venue_reviews" ("user_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "venue_saved_times" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "venue_id" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
  "preferred_start" time NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "venue_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_saved_times_venue_idx" ON "venue_saved_times" ("venue_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "venue_slot_watches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "venue_id" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
  "area_id" uuid NOT NULL REFERENCES "venue_areas"("id") ON DELETE CASCADE,
  "starts_at" timestamptz NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "venue_slot_watches_one_uq" UNIQUE ("user_id", "area_id", "starts_at")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_slot_watches_area_start_idx" ON "venue_slot_watches" ("area_id", "starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_slot_watches_user_idx" ON "venue_slot_watches" ("user_id");