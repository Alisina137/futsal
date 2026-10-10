-- One active paid Team Manager role covers a single non-offline team.
-- Legacy owners with multiple teams are temporarily credited through their existing
-- prepaid role end date; future renewal of EACH additional team requires payment.
CREATE TABLE "team_extra_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "team_id" uuid UNIQUE REFERENCES "teams"("id") ON DELETE SET NULL,
  "status" "paid_role_subscription_status" NOT NULL DEFAULT 'PENDING',
  "monthly_price_afn" integer NOT NULL DEFAULT 300,
  "requested_at" timestamptz NOT NULL DEFAULT now(),
  "active_until" timestamptz,
  "activated_at" timestamptz,
  "activated_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "payment_reference" varchar(120),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "team_extra_subscriptions_user_idx" ON "team_extra_subscriptions" ("user_id","status");
CREATE INDEX "team_extra_subscriptions_status_idx" ON "team_extra_subscriptions" ("status","requested_at");
WITH ranked AS (
 SELECT t.id,t.manager_user_id,r.active_until,r.monthly_price_afn,
 row_number() OVER (PARTITION BY t.manager_user_id ORDER BY t.created_at,t.id) AS rank
 FROM "teams" t
 LEFT JOIN "role_subscriptions" r ON r.user_id=t.manager_user_id AND r.role='TEAM_MANAGER'
 WHERE t.status='ACTIVE' AND (t.offline_venue_id IS NULL OR t.claimed_at IS NOT NULL)
)
INSERT INTO "team_extra_subscriptions"("user_id","team_id","status","monthly_price_afn",
 "requested_at","active_until","activated_at","payment_reference")
SELECT manager_user_id,id,
 CASE WHEN active_until>now() THEN 'ACTIVE'::paid_role_subscription_status ELSE 'EXPIRED'::paid_role_subscription_status END,
 COALESCE(monthly_price_afn,300),now(),active_until,now(),'LEGACY_TEAM_BACKFILL'
FROM ranked WHERE rank>1;
