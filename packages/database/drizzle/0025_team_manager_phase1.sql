-- Team Manager phase 1 only: profile/settings and offline guest roster.
CREATE TABLE "team_manager_profiles" (
  "team_id" uuid PRIMARY KEY REFERENCES "teams"("id") ON DELETE CASCADE,
  "province" varchar(80),
  "district" varchar(80),
  "description" text,
  "founded_on" varchar(10),
  "primary_color" varchar(7),
  "secondary_color" varchar(7),
  "contact_phone" varchar(24),
  "home_venue_id" uuid REFERENCES "venues"("id") ON DELETE SET NULL,
  "allow_join_requests" boolean NOT NULL DEFAULT true,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "team_profile_founded_on_format" CHECK ("founded_on" IS NULL OR "founded_on" ~ '^\\d{4}-\\d{2}-\\d{2}$')
);
CREATE TABLE "team_guest_players" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "name" varchar(100) NOT NULL,
  "position" "player_position" NOT NULL DEFAULT 'UNSPECIFIED',
  "shirt_number" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "team_guest_jersey_check" CHECK ("shirt_number" IS NULL OR ("shirt_number" BETWEEN 1 AND 99))
);
CREATE INDEX "team_guest_players_team_idx" ON "team_guest_players" ("team_id");
