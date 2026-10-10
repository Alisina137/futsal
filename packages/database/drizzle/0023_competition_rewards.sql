-- Announced team and individual prizes (not assigned winners).
ALTER TABLE "competitions" ADD COLUMN "rewards" jsonb NOT NULL DEFAULT '[]'::jsonb;
