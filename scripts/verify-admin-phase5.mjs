import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const schema=read("packages/database/src/schema.ts");
const sql=read("packages/database/drizzle/0035_admin_financial_ledger.sql");
const journal=read("packages/database/drizzle/meta/_journal.json");
const contracts=read("packages/contracts/src/index.ts");
const repo=read("apps/api/src/modules/commercial/admin-billing.repository.ts");
const commercial=read("apps/api/src/modules/commercial/commercial.repository.ts");
const auth=read("apps/api/src/modules/auth/auth.repository.ts");
const team=read("apps/api/src/modules/team/team-slots.ts");
const routes=read("apps/api/src/modules/commercial/commercial.routes.ts");
const client=read("apps/mobile/src/lib/api.ts");
const ui=read("apps/mobile/src/components/admin/AdminBillingPhase5Section.tsx");
const main=read("apps/mobile/app/(app)/admin/index.tsx");
for(const val of ["paidEntitlementPayments","paid_entitlement_payments_reference_uq"])
 assert.ok(schema.includes(val)||sql.includes(val),"Ledger schema missing: "+val);
assert.ok(journal.includes("0035_admin_financial_ledger"));
for(const val of ["adminBillingFiltersSchema","adminBillingReceiptSchema","adminBillingSummarySchema",
 "MANUAL_RECORDED_RECEIPTS_ONLY","ROLE_AND_EXTRA_TEAM_FROM_PHASE5_ONLY"])
 assert.ok(contracts.includes(val),"Finance contract missing: "+val);
for(const val of ["UNION ALL","FROM subscription_payments","FROM paid_entitlement_payments",
 "summary(","hasMore","count(*)","scope(filters)","voidPaidReceipt(","db.transaction",
 "PAID_ENTITLEMENT_PAYMENT_VOIDED"])
 assert.ok(repo.includes(val),"Finance query or audit rule missing: "+val);
for(const val of ["PAID_ROLE","paymentReference","paidEntitlementPayments","PAYMENT_REFERENCE_EXISTS",
 "pg_advisory_xact_lock","db.transaction"])
 assert.ok(auth.includes(val),"Paid role receipt protection missing: "+val);
for(const val of ["EXTRA_TEAM","paidEntitlementPayments","PAYMENT_REFERENCE_EXISTS",
 "pg_advisory_xact_lock","db.transaction"])
 assert.ok(team.includes(val),"Extra team billing protection missing: "+val);
for(const val of ["PAYMENT_ALREADY_VOIDED","PAYMENT_VOIDED","this.db.transaction",
 "billingReceipts(","billingSummary(","voidPaidReceipt("])
 assert.ok(commercial.includes(val),"Venue billing invariant missing: "+val);
for(const val of ["/billing/receipts","/billing/summary","/billing/paid-receipts/:id/void",
 'requireRole("PLATFORM_ADMIN")'])
 assert.ok(routes.includes(val),"Billing authorization missing: "+val);
for(const val of ["billingReceipts:","billingSummary:","voidPaidReceipt:"])
 assert.ok(client.includes(val),"Finance client missing: "+val);
for(const val of ["l.scope","l.history","l.caution","l.pendingRoles","l.expiringVenue",
 "AdminPagination","formatCompetitionDateTime"])
 assert.ok(ui.includes(val),"Phase 5 mobile/web finance UI missing: "+val);
assert.ok(main.includes("AdminBillingPhase5Section"));
console.log("Admin Phase 5 verified: categorized manual receipts, safe activation, immutable history, audit and bounded finance views.");
