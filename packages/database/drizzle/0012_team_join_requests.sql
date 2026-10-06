DO $$ BEGIN
  CREATE TYPE "team_join_request_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_join_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
  "requester_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "status" "team_join_request_status" NOT NULL DEFAULT 'PENDING',
  "responded_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "responded_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "team_join_requests_pending_uq"
  ON "team_join_requests" ("team_id","requester_user_id")
  WHERE "status" = 'PENDING';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_join_requests_team_status_idx"
  ON "team_join_requests" ("team_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_join_requests_user_status_idx"
  ON "team_join_requests" ("requester_user_id","status");
