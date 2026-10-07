CREATE TYPE "venue_timetable_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
--> statement-breakpoint
CREATE TABLE "venue_timetables" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "venue_id" uuid NOT NULL REFERENCES "venues"("id") ON DELETE cascade,
  "name" varchar(120) NOT NULL DEFAULT 'Weekly timetable',
  "status" "venue_timetable_status" NOT NULL DEFAULT 'DRAFT',
  "effective_from" varchar(10) NOT NULL,
  "effective_until" varchar(10),
  "default_slot_duration_minutes" integer NOT NULL DEFAULT 90,
  "buffer_minutes" integer NOT NULL DEFAULT 0,
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "published_at" timestamp with time zone,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "venue_timetables_venue_status_idx" ON "venue_timetables" USING btree ("venue_id","status");
--> statement-breakpoint
CREATE INDEX "venue_timetables_effective_idx" ON "venue_timetables" USING btree ("venue_id","effective_from","effective_until");
--> statement-breakpoint
CREATE TABLE "venue_timetable_periods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "timetable_id" uuid NOT NULL REFERENCES "venue_timetables"("id") ON DELETE cascade,
  "area_id" uuid REFERENCES "venue_areas"("id") ON DELETE cascade,
  "day_of_week" integer NOT NULL,
  "starts_at" time NOT NULL,
  "ends_at" time NOT NULL
);
--> statement-breakpoint
CREATE INDEX "venue_timetable_periods_timetable_day_idx" ON "venue_timetable_periods" USING btree ("timetable_id","day_of_week");
--> statement-breakpoint
CREATE INDEX "venue_timetable_periods_area_idx" ON "venue_timetable_periods" USING btree ("area_id");
--> statement-breakpoint
CREATE TABLE "venue_timetable_exceptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "venue_id" uuid NOT NULL REFERENCES "venues"("id") ON DELETE cascade,
  "area_id" uuid REFERENCES "venue_areas"("id") ON DELETE cascade,
  "date" varchar(10) NOT NULL,
  "is_closed" boolean NOT NULL DEFAULT false,
  "periods" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "note" varchar(240),
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "venue_timetable_exceptions_venue_date_idx" ON "venue_timetable_exceptions" USING btree ("venue_id","date");
--> statement-breakpoint
CREATE INDEX "venue_timetable_exceptions_area_idx" ON "venue_timetable_exceptions" USING btree ("area_id");
