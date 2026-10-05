ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_credential_reset_at" timestamp with time zone;
