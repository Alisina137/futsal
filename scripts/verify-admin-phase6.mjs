import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const schema=read("packages/database/src/schema.ts");
const migration=read("packages/database/drizzle/0036_admin_trust_support.sql");
const journal=read("packages/database/drizzle/meta/_journal.json");
const contracts=read("packages/contracts/src/index.ts");
const service=read("apps/api/src/modules/trust/admin-trust.service.ts");
const routes=read("apps/api/src/modules/trust/admin-trust.routes.ts");
const app=read("apps/api/src/app.ts");
const server=read("apps/api/src/server.ts");
const publicComments=read("apps/api/src/modules/marketing/marketing.repository.ts");
const screen=read("apps/mobile/app/(app)/admin/index.tsx");
const support=read("apps/mobile/app/(app)/support.tsx");
const ui=read("apps/mobile/src/components/admin/AdminTrustPhase6Section.tsx");
const api=read("apps/mobile/src/lib/api.ts");
for(const s of ["communityReports","supportTickets","supportTicketEvents",
 "platformAnnouncements","platformAnnouncementRecipients","hiddenAt","ADMIN_ANNOUNCEMENT"])
 assert.ok(schema.includes(s),"Phase 6 table/field missing: "+s);
for(const s of ["CREATE TABLE IF NOT EXISTS \"community_reports\"","support_ticket_events",
 "platform_announcement_recipients","notification_type","hidden_at"])
 assert.ok(migration.includes(s),"Phase 6 migration missing: "+s);
assert.ok(journal.includes("0036_admin_trust_support"));
for(const s of ["adminReportCreateSchema","adminReportReviewSchema","supportTicketCreateSchema",
 "supportTicketUpdateSchema","adminAnnouncementCreateSchema","adminDeliveryRetrySchema"])
 assert.ok(contracts.includes(s),"Phase 6 input contract missing: "+s);
for(const s of ["requireRole(\"PLATFORM_ADMIN\")","createUserTrustRouter",
 "createAdminTrustRouter","/delivery-health/:id/requeue"])
 assert.ok(routes.includes(s),"Protected trust route missing: "+s);
for(const s of ["moderation(","submitReport(","reviewReport(","createTicket(",
 "updateTicket(","announce(","dispatchDue(","notificationDeliveries","onConflictDoNothing",
 "auditLogs","this.db.transaction","requeuePush("])
 assert.ok(service.includes(s),"Trust service invariant missing: "+s);
assert.ok(app.includes('app.use("/api/v1/trust"')&&
 app.includes('app.use("/api/v1/admin",createAdminTrustRouter'));
assert.ok(server.includes("trustTimer=setInterval")&&server.includes("clearInterval(trustTimer)"));
assert.ok(publicComments.includes('isNull(socialPostComments.hiddenAt)'),
 "Hidden comments must be excluded from all public reads.");
for(const s of ['section==="reports"','section==="announcements"','AdminTrustPhase6Section'])
 assert.ok(screen.includes(s),"Trust section is not mounted: "+s);
for(const s of ["moderation","reports","support","announcements","deliveries",
 "AdminPagination","l.retryInfo"])
 assert.ok(ui.includes(s),"Trust UI missing: "+s);
assert.ok(support.includes("trustApi.createTicket")&&support.includes("trustApi.report"));
assert.ok(api.includes("adminTrustApi=")&&api.includes("trustApi="));
console.log("Admin Phase 6 verified: moderated content, reports, tickets, scheduled in-app campaigns and safe delivery requeue.");
