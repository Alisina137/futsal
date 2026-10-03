CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE "language_code" AS ENUM ('fa-AF', 'ps-AF', 'en');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "user_role" AS ENUM ('PLAYER', 'TEAM_MANAGER', 'REFEREE', 'VENUE_STAFF', 'COMPETITION_ADMIN', 'VENUE_OWNER', 'PLATFORM_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "display_name" varchar(80) NOT NULL,
  "username" varchar(30),
  "username_normalized" varchar(30),
  "phone_e164" varchar(20) NOT NULL,
  "phone_verified_at" timestamptz,
  "email_normalized" varchar(320),
  "password_hash" text NOT NULL,
  "preferred_language" "language_code" DEFAULT 'fa-AF' NOT NULL,
  "status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_e164_uq" ON "users" ("phone_e164");
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_normalized_uq" ON "users" ("username_normalized");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_normalized_uq" ON "users" ("email_normalized");
CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users" ("status");

CREATE TABLE IF NOT EXISTS "user_roles" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" "user_role" NOT NULL,
  "assigned_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "user_roles_pk" PRIMARY KEY ("user_id", "role")
);
CREATE INDEX IF NOT EXISTS "user_roles_role_idx" ON "user_roles" ("role");

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "refresh_token_hash" varchar(64) NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "device_label" varchar(120),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "last_seen_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_refresh_token_hash_uq" ON "sessions" ("refresh_token_hash");
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" ("expires_at");

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "action" varchar(100) NOT NULL,
  "target_type" varchar(80) NOT NULL,
  "target_id" varchar(100),
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "audit_logs_actor_idx" ON "audit_logs" ("actor_user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at");
