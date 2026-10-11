-- Preserve legacy identity and roles. Existing profile emails are unverified until proven.
ALTER TABLE "users" ALTER COLUMN "phone_e164" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "password_reset_challenges" ALTER COLUMN "phone_e164" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "password_reset_challenges" ADD COLUMN IF NOT EXISTS "email_normalized" varchar(320);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_reset_email_created_idx" ON "password_reset_challenges" ("email_normalized","created_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_verification_challenges" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
"email_normalized" varchar(320) NOT NULL,
"code_hash" varchar(64) NOT NULL,
"expires_at" timestamp with time zone NOT NULL,
"attempts" integer NOT NULL DEFAULT 0,
"consumed_at" timestamp with time zone,
"created_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_verification_user_created_idx" ON "email_verification_challenges" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_verification_expires_idx" ON "email_verification_challenges" ("expires_at");
