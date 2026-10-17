-- Referee Phase 7: explicit accepting/paused status. An empty weekly schedule now means unavailable.
ALTER TABLE "referee_profiles" ADD COLUMN IF NOT EXISTS "accepting_assignments" boolean NOT NULL DEFAULT true;
