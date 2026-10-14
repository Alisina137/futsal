-- Optional owner-reported public amenity details. Existing venues have no declared amenities.
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "amenities" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "house_rules" text;
