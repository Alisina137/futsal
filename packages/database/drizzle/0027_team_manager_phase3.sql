-- Team Manager final phase: private announcements, friendly challenges, and social notifications.
CREATE TABLE "team_friendly_challenges" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "from_team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
 "to_team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
 "proposed_at" timestamptz NOT NULL,
 "venue_name" varchar(160),
 "message" varchar(500),
 "status" varchar(12) NOT NULL DEFAULT 'PENDING',
 "responded_at" timestamptz,
 "created_at" timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT "team_friendly_different_teams" CHECK ("from_team_id"<>"to_team_id"),
 CONSTRAINT "team_friendly_status_check" CHECK ("status" IN ('PENDING','ACCEPTED','DECLINED','CANCELLED'))
);
CREATE INDEX "team_friendly_from_idx" ON "team_friendly_challenges" ("from_team_id","created_at");
CREATE INDEX "team_friendly_to_idx" ON "team_friendly_challenges" ("to_team_id","created_at");
CREATE UNIQUE INDEX "team_friendly_pending_unique" ON "team_friendly_challenges" ("from_team_id","to_team_id") WHERE "status"='PENDING';

CREATE TABLE "team_announcements" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
 "author_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "title" varchar(120) NOT NULL,
 "body" text NOT NULL,
 "created_at" timestamptz NOT NULL DEFAULT now(),
 "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "team_announcements_team_date_idx" ON "team_announcements" ("team_id","created_at");
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'TEAM_CHALLENGE';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'TEAM_ANNOUNCEMENT';
