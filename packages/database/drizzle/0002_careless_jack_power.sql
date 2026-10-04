CREATE TYPE "public"."booking_mode" AS ENUM('INSTANT', 'APPROVAL');--> statement-breakpoint
CREATE TYPE "public"."booking_source" AS ENUM('ONLINE', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"player_user_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"source" "booking_source" NOT NULL,
	"status" "booking_status" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"price_afn" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'AFN' NOT NULL,
	"customer_name" varchar(120),
	"customer_phone" varchar(20),
	"note" varchar(500),
	"cancellation_policy_snapshot" text NOT NULL,
	"idempotency_key" varchar(80),
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" uuid,
	"cancellation_reason" varchar(240),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" varchar(240),
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "timezone" varchar(64) DEFAULT 'Asia/Kabul' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "booking_mode" "booking_mode" DEFAULT 'INSTANT' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "cancellation_policy" text DEFAULT 'Cancellation is allowed before the booking start time.' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_area_id_venue_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."venue_areas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_player_user_id_users_id_fk" FOREIGN KEY ("player_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_blocks" ADD CONSTRAINT "venue_blocks_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_blocks" ADD CONSTRAINT "venue_blocks_area_id_venue_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."venue_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_blocks" ADD CONSTRAINT "venue_blocks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_actor_idempotency_uq" ON "bookings" USING btree ("created_by_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "bookings_area_time_idx" ON "bookings" USING btree ("area_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "bookings_venue_time_idx" ON "bookings" USING btree ("venue_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_player_time_idx" ON "bookings" USING btree ("player_user_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_blocks_area_time_idx" ON "venue_blocks" USING btree ("area_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "venue_blocks_venue_time_idx" ON "venue_blocks" USING btree ("venue_id","starts_at");