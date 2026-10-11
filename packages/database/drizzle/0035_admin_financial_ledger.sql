-- New role/additional-team activation receipts from Phase 5 onwards.
-- Do not backfill historical role grants as cash received without supporting evidence.
CREATE TABLE IF NOT EXISTS "paid_entitlement_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind" varchar(24) NOT NULL CHECK ("kind" IN ('PAID_ROLE','EXTRA_TEAM')),
  "target_id" uuid NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "role" varchar(24) NOT NULL,
  "amount_afn" integer NOT NULL CHECK ("amount_afn" >= 0),
  "months" integer NOT NULL CHECK ("months" BETWEEN 1 AND 24),
  "period_starts_at" timestamptz NOT NULL,
  "period_ends_at" timestamptz NOT NULL,
  "provider" varchar(40) NOT NULL DEFAULT 'MANUAL',
  "provider_reference" varchar(120) NOT NULL,
  "status" "subscription_payment_status" NOT NULL DEFAULT 'RECORDED',
  "recorded_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "voided_at" timestamptz,
  "voided_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "paid_entitlement_payments_reference_uq"
  ON "paid_entitlement_payments" ("provider","provider_reference");
CREATE INDEX IF NOT EXISTS "paid_entitlement_payments_created_idx"
  ON "paid_entitlement_payments" ("created_at");
CREATE INDEX IF NOT EXISTS "paid_entitlement_payments_user_idx"
  ON "paid_entitlement_payments" ("user_id");
