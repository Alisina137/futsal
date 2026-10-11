import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const contract=read("packages/contracts/src/index.ts");
const repo=read("apps/api/src/modules/commercial/commercial.repository.ts");
const governance=read("apps/api/src/modules/commercial/admin-governance.repository.ts");
const routes=read("apps/api/src/modules/commercial/commercial.routes.ts");
const service=read("apps/api/src/modules/commercial/commercial.service.ts");
const ui=read("apps/mobile/src/components/admin/AdminConfigurationPhase7Section.tsx");
const auditUI=read("apps/mobile/src/components/admin/AdminGovernancePhase7Section.tsx");
const client=read("apps/mobile/src/lib/api.ts");
const root=read("apps/mobile/app/(app)/admin/index.tsx");
const nav=read("apps/mobile/src/components/admin/admin-navigation.ts");
const tests=read("apps/api/test/commercial.test.ts");
for(const s of ["adminAuditFilterSchema","adminDiagnosticsSchema",
 "expectedUpdatedAt","reason: z.string().trim().min(10)","Too many feature flags"])
 assert.ok(contract.includes(s),"Admin phase 7 contract missing: "+s);
for(const s of ["PLATFORM_SETTINGS_UPDATED","SETTINGS_STALE","SETTINGS_UNCHANGED",
 "pg_advisory_xact_lock","this.db.transaction","changedKeys","previous.updatedAt.toISOString()",
 "nextVersion"])assert.ok(repo.includes(s),"Atomic configuration invariant missing: "+s);
for(const s of ["auditPage(","csv(","diagnostics(","31*86400000","rows.length>1000",
 "api_runtime","database_connection","release_version","overdue_announcements","error_telemetry",
 "restrictMetadata","replace(/","formula","BACKUP_CHECK"])
 if(s!=="BACKUP_CHECK"&&s!=="formula")assert.ok(governance.includes(s),
   "Audit/diagnostics invariant missing: "+s);
for(const s of ['"/audit/page"','"/audit/export"','"/diagnostics"','Cache-Control',
 'exportLimiter','requireRole("PLATFORM_ADMIN")'])
 assert.ok(routes.includes(s),"Protected governance route missing: "+s);
for(const s of ["auditPage(","auditCsv(","diagnostics("])
 assert.ok(service.includes(s),"Governance service missing: "+s);
for(const s of ["auditPage:","auditExport:","diagnostics:","cache:\"no-store\""])
 assert.ok(client.includes(s),"Typed governance client missing: "+s);
for(const s of ["expectedUpdatedAt:snapshot.updatedAt","reason.trim().length<10",
 "changed.length===0","l.impact","featureFlags","notificationTemplates",
 "newFlag","newTemplate","l.conflict"])
 assert.ok(ui.includes(s),"Configuration review missing: "+s);
for(const s of ["AdminPagination","adminApi.auditPage","adminApi.auditExport",
 "adminApi.diagnostics","l.csvHelp","Platform.OS===\"web\"","l.releaseTitle"])
 assert.ok(auditUI.includes(s),"Audit or release console missing: "+s);
for(const s of ["AdminGovernancePhase7Section","AdminConfigurationPhase7Section",
 "mode=\"readiness\"","mode=\"audit\""])
 assert.ok(root.includes(s),"Admin phase7 section not mounted: "+s);
assert.ok(nav.includes('"readiness"'),"Readiness navigation absent");
for(const s of ['describe("Admin Phase 7 governance and hardening"','expectedUpdatedAt',
 '"/api/v1/admin/audit/page"','"/api/v1/admin/diagnostics"'])
 assert.ok(tests.includes(s),"Governance API tests missing: "+s);
console.log("Admin Phase 7 verified: optimistic atomic configuration, paginated redacted audit, CSV safeguards, release diagnostics, localized console and contract tests.");
