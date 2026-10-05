CREATE TYPE "public"."venue_verification_status" AS ENUM('PENDING', 'VERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."subscription_payment_status" AS ENUM('RECORDED', 'VOIDED');--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "verification_status" "venue_verification_status" DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "verified_by_user_id" uuid;--> statement-breakpoint
CREATE TABLE "subscription_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"amount_afn" integer NOT NULL,
	"period_starts_at" timestamp with time zone NOT NULL,
	"period_ends_at" timestamp with time zone NOT NULL,
	"provider" varchar(40) DEFAULT 'MANUAL' NOT NULL,
	"provider_reference" varchar(120),
	"status" "subscription_payment_status" DEFAULT 'RECORDED' NOT NULL,
	"note" varchar(500),
	"recorded_by_user_id" uuid NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" varchar(20) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"monthly_price_afn" integer DEFAULT 1500 NOT NULL,
	"annual_price_afn" integer DEFAULT 15000 NOT NULL,
	"trial_duration_hours" integer DEFAULT 72 NOT NULL,
	"feature_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_voided_by_user_id_users_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_payments_venue_created_idx" ON "subscription_payments" USING btree ("venue_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_payments_provider_reference_uq" ON "subscription_payments" USING btree ("provider","provider_reference") WHERE "subscription_payments"."provider_reference" is not null;