-- One venue-owner account represents exactly one active court.
-- Preserve historical extra courts but deactivate them instead of deleting records
-- referenced by bookings, competitions, blocks, promotions, or history.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY venue_id
      ORDER BY active DESC, created_at ASC, id ASC
    ) AS position
  FROM venue_areas
)
UPDATE venue_areas AS area
SET active = false,
    updated_at = now()
FROM ranked
WHERE area.id = ranked.id
  AND ranked.position > 1
  AND area.active = true;

CREATE UNIQUE INDEX IF NOT EXISTS venue_areas_one_active_per_venue_uq
  ON venue_areas (venue_id)
  WHERE active = true;

ALTER TABLE venue_timetable_periods
  ADD COLUMN IF NOT EXISTS price_afn integer;

-- Existing schedules inherit the current court base price. Area-specific legacy
-- periods prefer their own historical court price.
UPDATE venue_timetable_periods AS period
SET price_afn = COALESCE(
  (
    SELECT area.base_price_afn
    FROM venue_areas AS area
    WHERE area.id = period.area_id
    LIMIT 1
  ),
  (
    SELECT area.base_price_afn
    FROM venue_timetables AS timetable
    INNER JOIN venue_areas AS area
      ON area.venue_id = timetable.venue_id
    WHERE timetable.id = period.timetable_id
    ORDER BY area.active DESC, area.created_at ASC, area.id ASC
    LIMIT 1
  ),
  0
)
WHERE period.price_afn IS NULL;

ALTER TABLE venue_timetable_periods
  ALTER COLUMN price_afn SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'venue_timetable_periods_price_nonnegative'
  ) THEN
    ALTER TABLE venue_timetable_periods
      ADD CONSTRAINT venue_timetable_periods_price_nonnegative
      CHECK (price_afn >= 0);
  END IF;
END $$;
