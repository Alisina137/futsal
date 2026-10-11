-- Phase 6: support, moderation and announcements.
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'ADMIN_ANNOUNCEMENT';
ALTER TABLE "social_post_comments" ADD COLUMN IF NOT EXISTS "hidden_at" timestamptz;

CREATE TABLE IF NOT EXISTS "community_reports" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "reporter_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "target_type" varchar(24) NOT NULL CHECK ("target_type" IN ('USER','VENUE','POST','COMMENT','PROMOTION')),
 "target_id" uuid NOT NULL,
 "category" varchar(32) NOT NULL CHECK ("category" IN ('INAPPROPRIATE_CONTENT','HARASSMENT','SPAM','FRAUD','FAKE_VENUE','OTHER')),
 "description" varchar(1500) NOT NULL,
 "status" varchar(24) NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN','REVIEWING','RESOLVED','DISMISSED')),
 "resolution_note" varchar(1500),
 "reviewed_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
 "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "community_reports_status_created_idx" ON "community_reports"("status","created_at");
CREATE INDEX IF NOT EXISTS "community_reports_target_idx" ON "community_reports"("target_type","target_id");
CREATE UNIQUE INDEX IF NOT EXISTS "community_reports_one_open_per_user_target_uq"
 ON "community_reports"("reporter_user_id","target_type","target_id")
 WHERE "status" IN ('OPEN','REVIEWING');

CREATE TABLE IF NOT EXISTS "support_tickets" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "requester_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "category" varchar(32) NOT NULL CHECK ("category" IN ('TECHNICAL','BOOKINGS','PAYMENTS','ACCOUNT','SAFETY','OTHER')),
 "priority" varchar(16) NOT NULL DEFAULT 'NORMAL' CHECK ("priority" IN ('LOW','NORMAL','HIGH','URGENT')),
 "status" varchar(24) NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN','IN_PROGRESS','WAITING_FOR_USER','RESOLVED','CLOSED')),
 "assigned_to_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
 "subject" varchar(160) NOT NULL, "description" varchar(2000) NOT NULL,
 "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
 "closed_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "support_tickets_status_updated_idx" ON "support_tickets"("status","updated_at");
CREATE INDEX IF NOT EXISTS "support_tickets_requester_idx" ON "support_tickets"("requester_user_id","created_at");
CREATE TABLE IF NOT EXISTS "support_ticket_events" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "ticket_id" uuid NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
 "actor_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "action" varchar(32) NOT NULL, "note" varchar(2000) NOT NULL,
 "previous_status" varchar(24), "next_status" varchar(24),
 "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "support_ticket_events_ticket_idx" ON "support_ticket_events"("ticket_id","created_at");
CREATE TABLE IF NOT EXISTS "platform_announcements" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "created_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "title" varchar(160) NOT NULL,"body" varchar(500) NOT NULL,
 "audience" varchar(24) NOT NULL CHECK ("audience" IN ('ALL','USER','ROLE','CITY')),
 "audience_value" varchar(120),
 "status" varchar(24) NOT NULL DEFAULT 'SCHEDULED' CHECK ("status" IN ('SCHEDULED','SENDING','SENT','CANCELLED')),
 "scheduled_at" timestamptz NOT NULL,"started_at" timestamptz,"completed_at" timestamptz,
 "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "platform_announcements_due_idx" ON "platform_announcements"("status","scheduled_at");
CREATE TABLE IF NOT EXISTS "platform_announcement_recipients" (
 "announcement_id" uuid NOT NULL REFERENCES "platform_announcements"("id") ON DELETE CASCADE,
 "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
 "delivered_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY ("announcement_id","user_id")
);
CREATE INDEX IF NOT EXISTS "platform_announcement_recipients_pending_idx"
 ON "platform_announcement_recipients"("announcement_id","delivered_at");