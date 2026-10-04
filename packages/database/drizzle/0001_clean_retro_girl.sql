CREATE TYPE "public"."subscription_status" AS ENUM('TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."venue_status" AS ENUM('DRAFT', 'READY', 'ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TABLE "venue_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"default_session_duration_minutes" integer NOT NULL,
	"base_price_afn" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_opening_hours" (
	"venue_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"opens_at" time,
	"closes_at" time,
	CONSTRAINT "venue_opening_hours_venue_id_day_of_week_pk" PRIMARY KEY("venue_id","day_of_week")
);
--> statement-breakpoint
CREATE TABLE "venue_subscriptions" (
	"venue_id" uuid PRIMARY KEY NOT NULL,
	"status" "subscription_status" NOT NULL,
	"trial_started_at" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"active_until" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_trial_claims" (
	"identity_hash" varchar(64) PRIMARY KEY NOT NULL,
	"venue_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"public_phone" varchar(20) NOT NULL,
	"whatsapp_phone" varchar(20),
	"province" varchar(80) NOT NULL,
	"city" varchar(80) NOT NULL,
	"address" varchar(240) NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"status" "venue_status" DEFAULT 'DRAFT' NOT NULL,
	"setup_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venue_areas" ADD CONSTRAINT "venue_areas_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_opening_hours" ADD CONSTRAINT "venue_opening_hours_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_subscriptions" ADD CONSTRAINT "venue_subscriptions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_trial_claims" ADD CONSTRAINT "venue_trial_claims_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_trial_claims" ADD CONSTRAINT "venue_trial_claims_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "venue_areas_name_uq" ON "venue_areas" USING btree ("venue_id","name");--> statement-breakpoint
CREATE INDEX "venue_areas_venue_id_idx" ON "venue_areas" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_opening_hours_venue_id_idx" ON "venue_opening_hours" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_subscriptions_status_idx" ON "venue_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_subscriptions_trial_ends_idx" ON "venue_subscriptions" USING btree ("trial_ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_trial_claims_venue_id_uq" ON "venue_trial_claims" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_trial_claims_owner_idx" ON "venue_trial_claims" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "venues_owner_user_id_uq" ON "venues" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "venues_status_idx" ON "venues" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venues_location_idx" ON "venues" USING btree ("province","city");