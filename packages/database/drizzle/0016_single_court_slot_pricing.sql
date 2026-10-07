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
  specific_area.base_price_afn,
  active_area.base_price_afn,
  0
)
FROM venue_timetables AS timetable
LEFT JOIN venue_areas AS specific_area
  ON specific_area.id = period.area_id
LEFT JOIN LATERAL (
  SELECT base_price_afn
  FROM venue_areas
  WHERE venue_id = timetable.venue_id
    AND active = true
  ORDER BY created_at ASC, id ASC
  LIMIT 1
) AS active_area ON true
WHERE period.timetable_id = timetable.id
  AND period.price_afn IS NULL;

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
