-- Admin Phase 4: auditable investigations without rewriting reservation, match or team history.
CREATE TABLE IF NOT EXISTS "admin_cases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "target_type" varchar(24) NOT NULL CHECK ("target_type" IN ('VENUE','TEAM','COMPETITION','REFEREE','RESERVATION')),
  "target_id" uuid NOT NULL,
  "state" varchar(24) NOT NULL DEFAULT 'OPEN' CHECK ("state" IN ('OPEN','UNDER_REVIEW','RESOLVED')),
  "reason" varchar(500) NOT NULL,
  "note" text NOT NULL,
  "opened_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "opened_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "closed_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "admin_cases_target_idx" ON "admin_cases"("target_type","target_id");
CREATE INDEX IF NOT EXISTS "admin_cases_state_updated_idx" ON "admin_cases"("state","updated_at");
CREATE UNIQUE INDEX IF NOT EXISTS "admin_cases_one_open_per_target_uq"
  ON "admin_cases"("target_type","target_id") WHERE "state" <> 'RESOLVED';
