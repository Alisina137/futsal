-- Server-authoritative referee match clock. No official result is published until organizer approval.
ALTER TABLE "referee_match_reports" ADD COLUMN "clock" jsonb NOT NULL DEFAULT '{"elapsedSeconds":0,"period":1,"runningSince":null}'::jsonb;
