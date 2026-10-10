-- Team Manager Phase 2: competition roster / match lineups / private team calendar.
CREATE TABLE "team_competition_roster" (
  "competition_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "added_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("competition_id","team_id","user_id"),
  CONSTRAINT "team_competition_roster_registration_fk" FOREIGN KEY ("competition_id","team_id")
    REFERENCES "competition_teams"("competition_id","team_id") ON DELETE CASCADE,
  CONSTRAINT "team_competition_roster_membership_fk" FOREIGN KEY ("team_id","user_id")
    REFERENCES "team_memberships"("team_id","user_id") ON DELETE CASCADE
);
CREATE INDEX "team_competition_roster_team_idx" ON "team_competition_roster" ("team_id","competition_id");

CREATE TABLE "team_match_lineups" (
  "match_id" uuid NOT NULL REFERENCES "competition_matches"("id") ON DELETE CASCADE,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "starters" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "substitutes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "captain_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("match_id","team_id"),
  CONSTRAINT "team_match_lineup_starters_array" CHECK (jsonb_typeof("starters")='array' AND jsonb_array_length("starters") <= 5),
  CONSTRAINT "team_match_lineup_subs_array" CHECK (jsonb_typeof("substitutes")='array' AND jsonb_array_length("substitutes") <= 25)
);

CREATE TABLE "team_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "kind" varchar(16) NOT NULL CHECK ("kind" IN ('TRAINING','MEETING','FRIENDLY','OTHER')),
  "title" varchar(120) NOT NULL,
  "notes" text,
  "location" varchar(200),
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "team_activity_time_order" CHECK ("starts_at" < "ends_at")
);
CREATE INDEX "team_activities_team_start_idx" ON "team_activities" ("team_id","starts_at");
CREATE TABLE "team_activity_responses" (
  "activity_id" uuid NOT NULL REFERENCES "team_activities"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "availability" varchar(12) NOT NULL CHECK ("availability" IN ('AVAILABLE','UNAVAILABLE','UNSURE')),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("activity_id","user_id")
);
