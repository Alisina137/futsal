-- Earlier team-profile founded_on check used double-escaped \d inside a SQL
-- string. PostgreSQL treated it as a literal escape, rejecting normal dates.
-- Use a portable POSIX numeric range in the existing constraint.
ALTER TABLE "team_manager_profiles"
  DROP CONSTRAINT IF EXISTS "team_profile_founded_on_format";--> statement-breakpoint
ALTER TABLE "team_manager_profiles"
  ADD CONSTRAINT "team_profile_founded_on_format"
  CHECK ("founded_on" IS NULL OR "founded_on" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
