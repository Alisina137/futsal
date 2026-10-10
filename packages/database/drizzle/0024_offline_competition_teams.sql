-- Offline competition participants have no public team account until admin handover.
-- The venue owner is the interim manager; teams retain the same ID on claiming.
ALTER TABLE "teams" ADD COLUMN "offline_venue_id" uuid REFERENCES "venues"("id") ON DELETE RESTRICT;
ALTER TABLE "teams" ADD COLUMN "claimed_at" timestamptz;
ALTER TABLE "teams" ADD CONSTRAINT "teams_claim_needs_offline_venue_check"
  CHECK ("claimed_at" IS NULL OR "offline_venue_id" IS NOT NULL);
CREATE INDEX "teams_offline_venue_idx" ON "teams" ("offline_venue_id", "claimed_at");
