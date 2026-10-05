CREATE TABLE IF NOT EXISTS "password_reset_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "phone_e164" varchar(20) NOT NULL,
  "code_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "verified_at" timestamp with time zone,
  "reset_token_hash" varchar(64),
  "reset_token_expires_at" timestamp with time zone,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_challenges_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "password_reset_challenges"
      ADD CONSTRAINT "password_reset_challenges_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END
$$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_reset_phone_created_idx"
  ON "password_reset_challenges" USING btree ("phone_e164","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_reset_expires_idx"
  ON "password_reset_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_reset_user_idx"
  ON "password_reset_challenges" USING btree ("user_id");