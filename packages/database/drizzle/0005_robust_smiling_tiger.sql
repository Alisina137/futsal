CREATE TYPE "public"."competition_fee_status" AS ENUM('UNPAID', 'PAID', 'WAIVED');--> statement-breakpoint
CREATE TYPE "public"."competition_format" AS ENUM('LEAGUE', 'KNOCKOUT', 'GROUP_KNOCKOUT');--> statement-breakpoint
CREATE TYPE "public"."competition_match_stage" AS ENUM('LEAGUE', 'GROUP', 'KNOCKOUT');--> statement-breakpoint
CREATE TYPE "public"."competition_match_status" AS ENUM('UNSCHEDULED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'POSTPONED', 'CANCELLED', 'CORRECTED');--> statement-breakpoint
CREATE TYPE "public"."competition_registration_status" AS ENUM('INVITED', 'APPLIED', 'PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."competition_status" AS ENUM('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "competition_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"name" varchar(40) NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competition_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"group_id" uuid,
	"stage" "competition_match_stage" NOT NULL,
	"round_number" integer NOT NULL,
	"slot_number" integer NOT NULL,
	"home_team_id" uuid,
	"away_team_id" uuid,
	"venue_id" uuid,
	"area_id" uuid,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"status" "competition_match_status" DEFAULT 'UNSCHEDULED' NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"winner_team_id" uuid,
	"next_match_id" uuid,
	"next_match_side" varchar(4),
	"referee_user_id" uuid,
	"result_entered_by_user_id" uuid,
	"result_entered_at" timestamp with time zone,
	"correction_reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competition_teams" (
	"competition_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"status" "competition_registration_status" DEFAULT 'PENDING' NOT NULL,
	"seed" integer,
	"group_id" uuid,
	"fee_status" "competition_fee_status" DEFAULT 'UNPAID' NOT NULL,
	"applied_by_user_id" uuid,
	"responded_by_user_id" uuid,
	"responded_at" timestamp with time zone,
	"qualified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competition_teams_competition_id_team_id_pk" PRIMARY KEY("competition_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"name" varchar(140) NOT NULL,
	"description" text,
	"format" "competition_format" NOT NULL,
	"status" "competition_status" DEFAULT 'DRAFT' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"max_teams" integer NOT NULL,
	"registration_fee_afn" integer DEFAULT 0 NOT NULL,
	"win_points" integer DEFAULT 3 NOT NULL,
	"draw_points" integer DEFAULT 1 NOT NULL,
	"loss_points" integer DEFAULT 0 NOT NULL,
	"tie_break_order" jsonb DEFAULT '["POINTS","GOAL_DIFFERENCE","GOALS_FOR"]'::jsonb NOT NULL,
	"group_count" integer,
	"qualifiers_per_group" integer,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"material_play_started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_match_stats" (
	"match_id" uuid NOT NULL,
	"player_user_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"appeared" boolean DEFAULT true NOT NULL,
	"goals" integer DEFAULT 0 NOT NULL,
	"assists" integer DEFAULT 0 NOT NULL,
	"yellow_cards" integer DEFAULT 0 NOT NULL,
	"red_cards" integer DEFAULT 0 NOT NULL,
	"clean_sheet" boolean DEFAULT false NOT NULL,
	"player_of_match" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_match_stats_match_id_player_user_id_pk" PRIMARY KEY("match_id","player_user_id")
);
--> statement-breakpoint
ALTER TABLE "competition_groups" ADD CONSTRAINT "competition_groups_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_matches" ADD CONSTRAINT "competition_matches_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_matches" ADD CONSTRAINT "competition_matches_group_id_competition_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."competition_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_matches" ADD CONSTRAINT "competition_matches_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_matches" ADD CONSTRAINT "competition_matches_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_matches" ADD CONSTRAINT "competition_matches_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_matches" ADD CONSTRAINT "competition_matches_area_id_venue_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."venue_areas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_matches" ADD CONSTRAINT "competition_matches_winner_team_id_teams_id_fk" FOREIGN KEY ("winner_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_matches" ADD CONSTRAINT "competition_matches_referee_user_id_users_id_fk" FOREIGN KEY ("referee_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_matches" ADD CONSTRAINT "competition_matches_result_entered_by_user_id_users_id_fk" FOREIGN KEY ("result_entered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_group_id_competition_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."competition_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_applied_by_user_id_users_id_fk" FOREIGN KEY ("applied_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_responded_by_user_id_users_id_fk" FOREIGN KEY ("responded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_match_id_competition_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."competition_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_player_user_id_users_id_fk" FOREIGN KEY ("player_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "competition_groups_name_uq" ON "competition_groups" USING btree ("competition_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "competition_groups_order_uq" ON "competition_groups" USING btree ("competition_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "competition_matches_slot_uq" ON "competition_matches" USING btree ("competition_id","stage","round_number","slot_number","group_id");--> statement-breakpoint
CREATE INDEX "competition_matches_competition_status_idx" ON "competition_matches" USING btree ("competition_id","status");--> statement-breakpoint
CREATE INDEX "competition_matches_area_time_idx" ON "competition_matches" USING btree ("area_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "competition_teams_status_idx" ON "competition_teams" USING btree ("competition_id","status");--> statement-breakpoint
CREATE INDEX "competition_teams_group_idx" ON "competition_teams" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "competitions_venue_status_idx" ON "competitions" USING btree ("venue_id","status");--> statement-breakpoint
CREATE INDEX "competitions_public_idx" ON "competitions" USING btree ("published","status","starts_at");--> statement-breakpoint
CREATE INDEX "player_match_stats_team_idx" ON "player_match_stats" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "player_match_stats_player_idx" ON "player_match_stats" USING btree ("player_user_id");