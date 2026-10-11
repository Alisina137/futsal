import type {Database} from "@leaguekick/database";
import {auditLogs} from "@leaguekick/database";
import {and,desc,eq,gte,ilike,lt,or,sql} from "drizzle-orm";
import type {AdminAuditFilter,AdminAuditLogDto,AdminDiagnostics} from "@leaguekick/contracts";
import {errors} from "../../lib/errors.js";

const localStart=(date:string)=>new Date(date+"T00:00:00+04:30");
function restrictMetadata(value:Record<string,unknown>):Record<string,unknown>{
  // Audit actors can inspect IDs, state changes and named changed fields.
  // Free-form notes, credentials, phone numbers, URLs and payment reference
  // bodies are deliberately excluded, including from CSV exports.
  const allow=new Set(["status","previousStatus","nextStatus","role","targetType","months",
    "amountAfn","periodStartsAt","periodEndsAt","hours","action","changedKeys",
    "previousPriority","nextPriority","kind","state","previousState",
    "reasonCode","newMonthlyPriceAfn","oldMonthlyPriceAfn",
    "newAnnualPriceAfn","oldAnnualPriceAfn","newTrialDurationHours",
    "oldTrialDurationHours","featureFlagKeys","notificationTemplateKeys"]);
  return Object.fromEntries(Object.entries(value).filter(([key,v])=>
    allow.has(key)&&(v===null||typeof v==="string"||typeof v==="number"
      ||typeof v==="boolean"||Array.isArray(v)&&v.every(x=>typeof x==="string"))));
}
function auditDto(row:typeof auditLogs.$inferSelect):AdminAuditLogDto{
  return {id:row.id,actorUserId:row.actorUserId,action:row.action,
    targetType:row.targetType,targetId:row.targetId,
    metadata:restrictMetadata(row.metadata),createdAt:row.createdAt.toISOString()};
}
function escaped(value:unknown){
  const str=String(value??"").replace(/[\r\n]+/g," ");
  // Prevent spreadsheet-formula execution on exported audit data.
  const safe=/^[\s]*[=+\-@]/.test(str)?"'"+str:str;
  return '"'+safe.replace(/"/g,'""')+'"';
}
export class DrizzleAdminGovernanceRepository{
  constructor(private readonly db:Database){}
  private where(filter:AdminAuditFilter){
    return and(
      filter.action?ilike(auditLogs.action,"%"+filter.action+"%"):undefined,
      filter.targetType?eq(auditLogs.targetType,filter.targetType):undefined,
      filter.actorId?eq(auditLogs.actorUserId,filter.actorId):undefined,
      filter.q?or(ilike(auditLogs.action,"%"+filter.q+"%"),
        ilike(auditLogs.targetType,"%"+filter.q+"%"),
        ilike(auditLogs.targetId,"%"+filter.q+"%")):undefined,
      filter.from?gte(auditLogs.createdAt,localStart(filter.from)):undefined,
      filter.to?lt(auditLogs.createdAt,new Date(localStart(filter.to).getTime()+86400000)):undefined,
    );
  }
  async auditPage(filter:AdminAuditFilter){
    const where=this.where(filter);
    const [rows,totals]=await Promise.all([
      this.db.select().from(auditLogs).where(where)
        .orderBy(desc(auditLogs.createdAt),desc(auditLogs.id))
        .limit(filter.pageSize).offset((filter.page-1)*filter.pageSize),
      this.db.select({n:sql<number>`count(*)::int`}).from(auditLogs).where(where),
    ]);
    const total=Number(totals[0]?.n??0);
    return {items:rows.map(auditDto),total,page:filter.page,pageSize:filter.pageSize,
      hasMore:filter.page*filter.pageSize<total};
  }
  async csv(filter:AdminAuditFilter){
    if(!filter.from||!filter.to||localStart(filter.to).getTime()-localStart(filter.from).getTime()>31*86400000)
      throw errors.badRequest("AUDIT_EXPORT_PERIOD_REQUIRED",
        "A start and end date spanning at most 31 days are required for CSV export.");
    const where=this.where(filter);
    const rows=await this.db.select().from(auditLogs).where(where)
      .orderBy(desc(auditLogs.createdAt),desc(auditLogs.id)).limit(1001);
    if(rows.length>1000)throw errors.conflict("AUDIT_EXPORT_TOO_LARGE",
      "Too many events for a single export. Use a shorter date range.");
    const header=["id","createdAt","actorUserId","action","targetType","targetId"];
    return [header.map(escaped).join(","),...rows.map(row=>{
      const dto=auditDto(row);
      return [dto.id,dto.createdAt,dto.actorUserId,dto.action,
        dto.targetType,dto.targetId].map(escaped).join(",");
    })].join("\r\n")+"\r\n";
  }
  async diagnostics(now:Date):Promise<AdminDiagnostics>{
    // Check required migration tables rather than reporting "ready" from a
    // successful TCP connection to a database with a stale schema.
    const expected=["audit_logs","platform_settings","admin_cases",
      "paid_entitlement_payments","community_reports","support_tickets",
      "platform_announcements","platform_announcement_recipients","notification_deliveries"];
    const checks=[];
    const present=sql.join(expected.map(name=>
      sql`(CASE WHEN to_regclass(${name}) IS NOT NULL THEN 1 ELSE 0 END)`),sql` + `);
    const result=await this.db.execute(sql`SELECT (${present})::int AS present_count`);
    const count=Number(result.rows[0]?.present_count??0);
    const schemaReady=count===expected.length;
    checks.push({key:"database_schema",state:schemaReady?"PASS" as const:"ATTENTION" as const,
      detail:schemaReady?"Required admin tables present":`Required admin tables: ${count}/${expected.length} present; run reviewed migrations`});
    let unresolvedReports=0,openSupportTickets=0,scheduledAnnouncements=0,failedPushDeliveries=0;
    if(schemaReady){
      const metrics=await this.db.execute(sql`SELECT
        (SELECT count(*)::int FROM community_reports WHERE status IN ('OPEN','REVIEWING')) AS reports,
        (SELECT count(*)::int FROM support_tickets WHERE status NOT IN ('CLOSED','RESOLVED')) AS tickets,
        (SELECT count(*)::int FROM platform_announcements WHERE status IN ('SCHEDULED','SENDING')) AS announcements,
        (SELECT count(*)::int FROM notification_deliveries
          WHERE channel='PUSH' AND status='FAILED') AS failed_push`);
      unresolvedReports=Number(metrics.rows[0]?.reports??0);
      openSupportTickets=Number(metrics.rows[0]?.tickets??0);
      scheduledAnnouncements=Number(metrics.rows[0]?.announcements??0);
      failedPushDeliveries=Number(metrics.rows[0]?.failed_push??0);
      checks.push({key:"support_and_reports",
        state:unresolvedReports+openSupportTickets>0?"ATTENTION" as const:"PASS" as const,
        detail:`${unresolvedReports} reports and ${openSupportTickets} support tickets need review`});
      checks.push({key:"scheduled_campaigns",
        state:"PASS" as const,detail:`${scheduledAnnouncements} scheduled or sending`});
      checks.push({key:"failed_push",
        state:failedPushDeliveries?"ATTENTION" as const:"PASS" as const,
        detail:`${failedPushDeliveries} failed push deliveries`});
    }else checks.push({key:"queued_work",
      state:"UNKNOWN" as const,detail:"Queue health unavailable until schema migration completes"});
    checks.push({key:"push_sender",state:"UNKNOWN" as const,
      detail:"External push delivery worker is not included; pending is not sent"});
    checks.push({key:"backup_restore",state:"UNKNOWN" as const,
      detail:"Backups and isolated restore tests require operator evidence; not automatically verified"});
    checks.push({key:"staging_qa",state:"UNKNOWN" as const,
      detail:"Manual end-to-end, mobile RTL, payment, security and incident rollback QA required"});
    return {generatedAt:now.toISOString(),releaseGate:"MANUAL_APPROVAL_REQUIRED",
      checks,counts:{unresolvedReports,openSupportTickets,scheduledAnnouncements,failedPushDeliveries}};
  }
}
