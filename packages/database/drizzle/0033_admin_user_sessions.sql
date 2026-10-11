-- Admin Phase 3: access-token invalidation watermark, set atomically with session revocations.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sessions_revoked_at" timestamp with time zone;
