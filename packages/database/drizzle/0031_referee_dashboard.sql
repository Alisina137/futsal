-- Referee appointments, availability and private officiating reports.
-- Venue owner authorizes referee identity; competition organizer owns final scores.
CREATE TABLE "referee_profiles" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "level" varchar(60),
  "experience_years" integer NOT NULL DEFAULT 0 CHECK ("experience_years" BETWEEN 0 AND 70),
  "biography" varchar(500),
  "weekly_availability" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "exceptions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "referee_match_responses" (
  "match_id" uuid NOT NULL REFERENCES "competition_matches"("id") ON DELETE CASCADE,
  "referee_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" varchar(24) NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','ACCEPTED','DECLINED','WITHDRAW_REQUESTED')),
  "reason" varchar(400),
  "responded_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("match_id","referee_user_id")
);
CREATE INDEX "referee_responses_user_idx" ON "referee_match_responses" ("referee_user_id","status");
CREATE TABLE "referee_match_reports" (
  "match_id" uuid PRIMARY KEY REFERENCES "competition_matches"("id") ON DELETE CASCADE,
  "referee_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "status" varchar(24) NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','SUBMITTED','CHANGES_REQUESTED','APPROVING','APPROVED')),
  "events" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "checks" jsonb NOT NULL DEFAULT '{"homePresent":false,"awayPresent":false,"rosterChecked":false,"venueReady":false}'::jsonb,
  "started_at" timestamptz,
  "finished_at" timestamptz,
  "summary" varchar(2000) NOT NULL DEFAULT '',
  "revision" integer NOT NULL DEFAULT 0,
  "submitted_at" timestamptz,
  "reviewed_at" timestamptz,
  "reviewed_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "feedback" varchar(800),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "referee_reports_referee_idx" ON "referee_match_reports" ("referee_user_id","status");
