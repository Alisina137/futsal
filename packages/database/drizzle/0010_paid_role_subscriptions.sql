DO $$ BEGIN
  CREATE TYPE "paid_role_subscription_status" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_subscriptions" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "role" "user_role" NOT NULL,
  "status" "paid_role_subscription_status" NOT NULL DEFAULT 'PENDING',
  "monthly_price_afn" integer NOT NULL,
  "requested_at" timestamp with time zone NOT NULL DEFAULT now(),
  "active_until" timestamp with time zone,
  "activated_at" timestamp with time zone,
  "activated_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "payment_reference" varchar(120),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "role_subscriptions_pk" PRIMARY KEY ("user_id","role"),
  CONSTRAINT "role_subscriptions_paid_role_check" CHECK ("role" IN ('VENUE_OWNER','TEAM_MANAGER'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_subscriptions_status_idx" ON "role_subscriptions" ("status","requested_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_subscriptions_active_until_idx" ON "role_subscriptions" ("active_until");
--> statement-breakpoint
INSERT INTO "role_subscriptions" (
  "user_id","role","status","monthly_price_afn","requested_at","active_until","activated_at","updated_at"
)
SELECT
  ur."user_id",
  ur."role",
  'ACTIVE'::"paid_role_subscription_status",
  CASE WHEN ur."role" = 'VENUE_OWNER' THEN 1000 ELSE 300 END,
  ur."assigned_at",
  now() + interval '30 days',
  now(),
  now()
FROM "user_roles" ur
WHERE ur."role" IN ('VENUE_OWNER','TEAM_MANAGER')
ON CONFLICT ("user_id","role") DO NOTHING;
