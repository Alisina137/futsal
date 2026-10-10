-- Store a private per-account fallback location for nearby venues.
ALTER TABLE "users"
  ADD COLUMN "default_latitude" double precision,
  ADD COLUMN "default_longitude" double precision;
ALTER TABLE "users" ADD CONSTRAINT "users_default_location_pair_ck" CHECK
  (("default_latitude" IS NULL AND "default_longitude" IS NULL) OR
   ("default_latitude" IS NOT NULL AND "default_longitude" IS NOT NULL AND
    "default_latitude" BETWEEN -90 AND 90 AND
    "default_longitude" BETWEEN -180 AND 180));
