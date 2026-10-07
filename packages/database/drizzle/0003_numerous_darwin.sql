CREATE TYPE "public"."device_platform" AS ENUM('ANDROID', 'IOS');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('IN_APP', 'PUSH');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('PENDING', 'SENT', 'SKIPPED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'SLOT_PROMOTION', 'VENUE_POST');--> statement-breakpoint
CREATE TYPE "public"."post_cta_type" AS ENUM('NONE', 'VENUE', 'PROMOTION', 'COMPETITION');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('PUBLISHED', 'UNPUBLISHED');--> statement-breakpoint
CREATE TYPE "public"."promotion_status" AS ENUM('ACTIVE', 'CLOSED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"notification_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"status" "notification_delivery_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"error" varchar(500),
	CONSTRAINT "notification_deliveries_notification_id_channel_pk" PRIMARY KEY("notification_id","channel")
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"promotions_enabled" boolean DEFAULT true NOT NULL,
	"venue_posts_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" varchar(500) NOT NULL,
	"deep_link" varchar(500) NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" varchar(160) NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"expo_push_token" varchar(220) NOT NULL,
	"platform" "device_platform" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_follows" (
	"user_id" uuid NOT NULL,
	"venue_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_follows_user_id_venue_id_pk" PRIMARY KEY("user_id","venue_id")
);
--> statement-breakpoint
CREATE TABLE "venue_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"image_url" text,
	"cta_type" "post_cta_type" DEFAULT 'NONE' NOT NULL,
	"cta_target_id" uuid,
	"status" "post_status" DEFAULT 'PUBLISHED' NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unpublished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"original_price_afn" integer NOT NULL,
	"discounted_price_afn" integer NOT NULL,
	"status" "promotion_status" DEFAULT 'ACTIVE' NOT NULL,
	"title" varchar(120) NOT NULL,
	"note" varchar(500),
	"notify_followers" boolean DEFAULT true NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"closed_at" timestamp with time zone,
	"close_reason" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_follows" ADD CONSTRAINT "venue_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_follows" ADD CONSTRAINT "venue_follows_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_posts" ADD CONSTRAINT "venue_posts_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_posts" ADD CONSTRAINT "venue_posts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_promotions" ADD CONSTRAINT "venue_promotions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_promotions" ADD CONSTRAINT "venue_promotions_area_id_venue_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."venue_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_promotions" ADD CONSTRAINT "venue_promotions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_dedupe_uq" ON "notifications" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_devices_token_uq" ON "push_devices" USING btree ("expo_push_token");--> statement-breakpoint
CREATE INDEX "push_devices_user_idx" ON "push_devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "venue_follows_venue_idx" ON "venue_follows" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_posts_venue_status_idx" ON "venue_posts" USING btree ("venue_id","status");--> statement-breakpoint
CREATE INDEX "venue_posts_published_at_idx" ON "venue_posts" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_promotions_active_slot_uq" ON "venue_promotions" USING btree ("area_id","starts_at","ends_at") WHERE "venue_promotions"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "venue_promotions_venue_status_idx" ON "venue_promotions" USING btree ("venue_id","status");--> statement-breakpoint
CREATE INDEX "venue_promotions_area_time_idx" ON "venue_promotions" USING btree ("area_id","starts_at","ends_at");