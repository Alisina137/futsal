CREATE TYPE "public"."player_position" AS ENUM('UNSPECIFIED', 'GOALKEEPER', 'FIXO', 'ALA', 'PIVO', 'UNIVERSAL');--> statement-breakpoint
CREATE TYPE "public"."profile_visibility" AS ENUM('PUBLIC', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "public"."team_invitation_status" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."team_member_role" AS ENUM('MANAGER', 'CAPTAIN', 'PLAYER');--> statement-breakpoint
CREATE TYPE "public"."team_membership_status" AS ENUM('ACTIVE', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."team_privacy" AS ENUM('PUBLIC', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "public"."team_status" AS ENUM('ACTIVE', 'ARCHIVED');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'TEAM_INVITATION';--> statement-breakpoint
CREATE TABLE "player_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"public_display_name" varchar(80) NOT NULL,
	"image_url" text,
	"position" "player_position" DEFAULT 'UNSPECIFIED' NOT NULL,
	"visibility" "profile_visibility" DEFAULT 'PUBLIC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"invited_user_id" uuid NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"role" "team_member_role" DEFAULT 'PLAYER' NOT NULL,
	"shirt_number" integer,
	"status" "team_invitation_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_memberships" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "team_member_role" DEFAULT 'PLAYER' NOT NULL,
	"shirt_number" integer,
	"status" "team_membership_status" DEFAULT 'ACTIVE' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_memberships_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"logo_url" text,
	"city" varchar(80) NOT NULL,
	"manager_user_id" uuid NOT NULL,
	"captain_user_id" uuid,
	"status" "team_status" DEFAULT 'ACTIVE' NOT NULL,
	"privacy" "team_privacy" DEFAULT 'PUBLIC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "team_invites_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_captain_user_id_users_id_fk" FOREIGN KEY ("captain_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_profiles_visibility_idx" ON "player_profiles" USING btree ("visibility");--> statement-breakpoint
CREATE UNIQUE INDEX "team_invitations_pending_uq" ON "team_invitations" USING btree ("team_id","invited_user_id") WHERE "team_invitations"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "team_invitations_invited_status_idx" ON "team_invitations" USING btree ("invited_user_id","status");--> statement-breakpoint
CREATE INDEX "team_invitations_team_status_idx" ON "team_invitations" USING btree ("team_id","status");--> statement-breakpoint
CREATE INDEX "team_memberships_user_status_idx" ON "team_memberships" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "team_memberships_team_status_idx" ON "team_memberships" USING btree ("team_id","status");--> statement-breakpoint
CREATE INDEX "teams_manager_idx" ON "teams" USING btree ("manager_user_id");--> statement-breakpoint
CREATE INDEX "teams_city_status_idx" ON "teams" USING btree ("city","status");--> statement-breakpoint
CREATE INDEX "teams_privacy_status_idx" ON "teams" USING btree ("privacy","status");