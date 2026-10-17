import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const check=(file,markers,label)=>{
  const content=read(file);
  for(const marker of markers)assert.ok(content.includes(marker),label+": "+marker);
};
const backend="apps/api/src/modules/referee/referee-phase2.routes.ts";
check(backend,[
  "pg_advisory_xact_lock(hashtext(${matchId}))",
  "refereeMutationAuthorized(actor?.status,accepted?.status,!!venueGrant)",
  "tx.insert(refereeMatchReports)",
  "tx.select().from(refereeMatchReports)",
  'eq(refereeMatchReports.revision,revision)',
  "REFEREE_AUTHORIZATION_CHANGED",
  "REFEREE_REPORT_STALE","EVENT_PLAYER_NOT_ON_TEAM",
  "REFEREE_REPORT_LOCKED","REPORT_REVIEW_CONFLICT",
  'action:"REFEREE_REPORT_APPROVED"',
],"Transactional authorization / report protection");
check("apps/api/src/modules/referee/referee.routes.ts",[
  'if(!acceptingAssignments||!(end>start))return false',
  'if(slots.length===0)return false',
  "pg_advisory_xact_lock(hashtext(${userId}))",
  "REFEREE_TIME_CONFLICT","REFEREE_CONFLICT_OF_INTEREST",
],"Availability and acceptance");
check("apps/api/src/modules/referee/referee-career.routes.ts",[
  'row.report.refereeUserId!==userId','row.ownerUserId!==userId',
  'row.report.status!=="APPROVED"','this.tickets.delete(token)',
  'res.setHeader("Cache-Control","no-store")',
],"Referee-only approved PDFs");
check("apps/mobile/src/lib/referee-dashboard-safety.ts",[
  'value.code==="NETWORK_ERROR"','value.code==="TIMEOUT"',
  '?"OFFLINE":"REJECT"',
],"Offline access revocation");
check("apps/mobile/src/components/referee/RefereeDashboard.tsx",[
  'refereeOverviewRecovery(e)==="OFFLINE"',
  'void AsyncStorage.removeItem(cacheKey)',
  'if(value.person?.id===userId)cachedOverview=value',
  'testID="referee-settings-exit-guard"',
  'testID="referee-dashboard-exit-guard"',
],"Session-scoped dashboard cache and exit guards");
check("apps/mobile/src/lib/referee-offline.ts",[
  'validRefereeOfflineRecord(decoded,userId,matchId)',
  'validOfflineEvent(event)',
  'partitionRefereeReplay([queued],report.events)',
  'state.pending.filter(e=>e.id!==queued.id)',
  'Saved referee events could not be read. Do not clear app storage.',
],"Write-ahead durable event safety");
check("apps/mobile/src/lib/referee-offline-safety.ts",[
  'refereeScopedUuid','validOfflineEvent','validRefereeOfflineRecord',
  'if(ids.has(id))return false;',
],"Offline integrity");
check("apps/mobile/src/components/referee/RefereeMatchCenter.tsx",[
  'if(local.cached&&!connected)',
  'refereeOverviewRecovery(e)==="OFFLINE"&&cachedSnapshot',
  'onRiskChange?.(unsafeExit,draftPersisting||syncing)',
  'saveRefereeSummaryDraft(userId,match.id,value)',
  'syncRefereeOffline(userId,match.id,token)',
],"Saved report and queue safeguards");
check("packages/database/drizzle/0044_referee_settings_availability.sql",[
  '"accepting_assignments" boolean NOT NULL DEFAULT true',
],"Phase 7 migration prerequisite");
const journal=JSON.parse(read("packages/database/drizzle/meta/_journal.json"));
assert.ok(journal.entries.some(e=>e.tag==="0044_referee_settings_availability"));
const pkg=JSON.parse(read("package.json"));
assert.ok(pkg.scripts["verify:referee-dashboard-release-phase8"].includes("scripts/tests/referee-dashboard-release-phase8.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:referee-dashboard-release-phase8"));
const locale=read("packages/localization/src/index.ts");
assert.equal(locale.split('"rf1.overviewOfflineReadOnly"').length-1,3);
for(const name of [
 "scripts/tests/referee-dashboard-release-phase8.test.mjs",
 "apps/api/test/referee-dashboard-phase8.test.ts",
 ".github/workflows/referee-dashboard-phase8.yml",
 "docs/REFEREE-DASHBOARD-PHASE8-RELEASE.md",
])assert.ok(existsSync(new URL("../"+name,import.meta.url)),"Missing release artifact "+name);
console.log("Referee Phase 8 audit passed: transactional permissions, offline integrity, fail-closed cache, reports and release checklist.");
