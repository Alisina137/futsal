ALTER TYPE "competition_fee_status" ADD VALUE IF NOT EXISTS 'PENDING';
--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'COMPETITION_UPDATE';
--> statement-breakpoint
ALTER TABLE "competitions"
  ADD COLUMN IF NOT EXISTS "registration_closes_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "match_duration_minutes" integer NOT NULL DEFAULT 60;
--> statement-breakpoint
ALTER TABLE "competition_teams"
  ADD COLUMN IF NOT EXISTS "fee_payment_reference" varchar(120),
  ADD COLUMN IF NOT EXISTS "fee_confirmed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "fee_confirmed_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null;
