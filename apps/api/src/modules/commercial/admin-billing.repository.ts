import type {Database} from "@leaguekick/database";
import {auditLogs,paidEntitlementPayments} from "@leaguekick/database";
import {eq} from "drizzle-orm";
import {sql} from "drizzle-orm";
import type {AdminBillingFilters,AdminBillingReceipt,AdminBillingSummary} from "@leaguekick/contracts";
import {adminBillingReceiptSchema,adminBillingSummarySchema} from "@leaguekick/contracts";
import {errors} from "../../lib/errors.js";

/** Three manual-receipt sources. No booking GMV, free trials, requests, or
 * unverified historic paid-role activations are counted as received cash. */
const base=sql`
WITH receipts AS (
 SELECT sp.id, 'VENUE'::text AS kind,sp.venue_id AS "targetId",
        v.name::text AS "accountName",'Venue subscription'::text AS description,
        sp.amount_afn AS "amountAfn",sp.status::text AS status,
        sp.provider::text AS provider,sp.provider_reference AS "providerReference",
        sp.period_starts_at AS "periodStartsAt",sp.period_ends_at AS "periodEndsAt",
        sp.created_at AS "createdAt",sp.recorded_by_user_id AS "recordedByUserId",
        sp.voided_at AS "voidedAt"
 FROM subscription_payments sp INNER JOIN venues v ON v.id=sp.venue_id
 UNION ALL
 SELECT ep.id,ep.kind::text AS kind,ep.target_id AS "targetId",
        u.display_name::text AS "accountName",ep.role::text AS description,
        ep.amount_afn AS "amountAfn",ep.status::text AS status,
        ep.provider::text AS provider,ep.provider_reference AS "providerReference",
        ep.period_starts_at AS "periodStartsAt",ep.period_ends_at AS "periodEndsAt",
        ep.created_at AS "createdAt",ep.recorded_by_user_id AS "recordedByUserId",
        ep.voided_at AS "voidedAt"
 FROM paid_entitlement_payments ep INNER JOIN users u ON ep.user_id=u.id
)
`;
function scope(filters:AdminBillingFilters){
  const conditions=[sql`true`];
  if(filters.kind)conditions.push(sql`kind=${filters.kind}`);
  if(filters.status)conditions.push(sql`status=${filters.status}`);
  if(filters.q){
    const q="%"+filters.q+"%";
    conditions.push(sql`("accountName" ILIKE ${q} OR description ILIKE ${q}
      OR "providerReference" ILIKE ${q} OR cast("targetId" AS text) ILIKE ${q})`);
  }
  if(filters.from)conditions.push(sql`"createdAt" >= ${new Date(filters.from+"T00:00:00+04:30")}`);
  if(filters.to)conditions.push(sql`"createdAt" < ${new Date(new Date(filters.to+"T00:00:00+04:30").getTime()+86400000)}`);
  return sql.join(conditions,sql` AND `);
}
type ReceiptRow=Omit<AdminBillingReceipt,"createdAt"|"periodStartsAt"|"periodEndsAt"|"voidedAt"> & {
  createdAt:Date;periodStartsAt:Date;periodEndsAt:Date;voidedAt:Date|null;
};
function dto(row:ReceiptRow):AdminBillingReceipt{
  return adminBillingReceiptSchema.parse({...row,
    amountAfn:Number(row.amountAfn),periodStartsAt:row.periodStartsAt.toISOString(),
    periodEndsAt:row.periodEndsAt.toISOString(),createdAt:row.createdAt.toISOString(),
    voidedAt:row.voidedAt?.toISOString()??null});
}
export class DrizzleAdminBillingRepository{
  constructor(private readonly db:Database){}
  async list(filters:AdminBillingFilters){
    const where=scope(filters);
    const [rows,totals]=await Promise.all([
      this.db.execute(sql`${base} SELECT * FROM receipts WHERE ${where}
        ORDER BY "createdAt" DESC,id DESC LIMIT ${filters.pageSize}
        OFFSET ${(filters.page-1)*filters.pageSize}`),
      this.db.execute(sql`${base} SELECT count(*)::int AS total FROM receipts WHERE ${where}`),
    ]);
    const total=Number(totals.rows[0]?.total??0);
    const items=rows.rows.map(row=>dto(row as unknown as ReceiptRow));
    return {items,total,page:filters.page,pageSize:filters.pageSize,
      hasMore:filters.page*filters.pageSize<total};
  }
  async summary(filters:AdminBillingFilters,now:Date):Promise<AdminBillingSummary>{
    // Summary ignores kind/status/search but respects local-date financial period.
    // A selected RECORDED-only tab must not hide voided amounts from totals.
    const {from,to}=filters;
    const where=scope({page:1,pageSize:25,...(from?{from}:{}),...(to?{to}:{})});
    const [rows,pending,expiring]=await Promise.all([
      this.db.execute(sql`${base}
        SELECT kind,status,count(*)::int AS count,coalesce(sum("amountAfn"),0)::float8 AS amount
        FROM receipts WHERE ${where} GROUP BY kind,status`),
      this.db.execute(sql`SELECT
        (SELECT count(*)::int FROM role_subscriptions WHERE status='PENDING') AS roles,
        (SELECT count(*)::int FROM team_extra_subscriptions WHERE status='PENDING') AS extras`),
      this.db.execute(sql`SELECT
        (SELECT count(*)::int FROM venue_subscriptions WHERE status='ACTIVE'
          AND active_until > ${now} AND active_until <= ${new Date(now.getTime()+7*86400000)}) AS venues,
        (SELECT count(*)::int FROM role_subscriptions WHERE status='ACTIVE'
          AND active_until > ${now} AND active_until <= ${new Date(now.getTime()+7*86400000)}) AS roles,
        (SELECT count(*)::int FROM team_extra_subscriptions WHERE status='ACTIVE'
          AND active_until > ${now} AND active_until <= ${new Date(now.getTime()+7*86400000)}) AS extras`),
    ]);
    const kinds=["VENUE","PAID_ROLE","EXTRA_TEAM"] as const;
    let recordedTotalAfn=0,voidedTotalAfn=0;
    const byKind=kinds.map(kind=>{
      const matched=rows.rows.filter(r=>r.kind===kind);
      const recorded=matched.find(r=>r.status==="RECORDED");
      const voided=matched.find(r=>r.status==="VOIDED");
      const recordedAfn=Math.round(Number(recorded?.amount??0));
      const voidedAfn=Math.round(Number(voided?.amount??0));
      recordedTotalAfn+=recordedAfn;voidedTotalAfn+=voidedAfn;
      return {kind,recordedAfn,recordedCount:Number(recorded?.count??0),
        voidedCount:Number(voided?.count??0)};
    });
    return adminBillingSummarySchema.parse({
      period:{...(from?{from}:{}),...(to?{to}:{})},
      recordedTotalAfn,voidedTotalAfn,byKind,
      attention:{
        pendingPaidRoles:Number(pending.rows[0]?.roles??0),
        pendingExtraTeams:Number(pending.rows[0]?.extras??0),
        expiringVenues7d:Number(expiring.rows[0]?.venues??0),
        expiringPaidRoles7d:Number(expiring.rows[0]?.roles??0),
        expiringExtraTeams7d:Number(expiring.rows[0]?.extras??0),
      },
      scope:"MANUAL_RECORDED_RECEIPTS_ONLY",
      historicalCoverage:"ROLE_AND_EXTRA_TEAM_FROM_PHASE5_ONLY",
    });
  }
  async voidPaidReceipt(actorUserId:string,id:string,reason:string,now:Date){
    await this.db.transaction(async tx=>{
      const [payment]=await tx.select().from(paidEntitlementPayments)
        .where(eq(paidEntitlementPayments.id,id)).for("update").limit(1);
      if(!payment)throw errors.badRequest("PAYMENT_NOT_FOUND","Payment record not found.");
      if(payment.status!=="RECORDED")throw errors.conflict("PAYMENT_ALREADY_VOIDED","Receipt already voided.");
      await tx.update(paidEntitlementPayments).set({status:"VOIDED",voidedAt:now,
        voidedByUserId:actorUserId}).where(eq(paidEntitlementPayments.id,id));
      await tx.insert(auditLogs).values({actorUserId,
        action:"PAID_ENTITLEMENT_PAYMENT_VOIDED",targetType:"PAID_ENTITLEMENT_PAYMENT",
        targetId:id,metadata:{kind:payment.kind,reference:payment.providerReference,
          amountAfn:payment.amountAfn,reason,requiresEntitlementReview:true},createdAt:now});
    });
  }
}
