-- Player Dashboard Phase 1: private career preferences and active default team.
CREATE TABLE "player_dashboard_preferences" (
 "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
 "default_team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
 "biography" varchar(500),
 "province" varchar(80),
 "district" varchar(80),
 "secondary_position" "player_position",
 "preferred_foot" varchar(8),
 "updated_at" timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT "player_dashboard_foot_check" CHECK ("preferred_foot" IS NULL OR "preferred_foot" IN ('LEFT','RIGHT','BOTH'))
);
CREATE INDEX "player_dashboard_default_team_idx" ON "player_dashboard_preferences" ("default_team_id");
