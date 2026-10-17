import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const screen=read("apps/mobile/src/components/referee/RefereeDashboard.tsx");
const helper=read("apps/mobile/src/lib/referee-overview.ts");
const service=read("apps/api/src/modules/referee/referee.routes.ts");
const locales=read("packages/localization/src/index.ts");
const pkg=JSON.parse(read("package.json"));
const nav=screen.slice(screen.indexOf("const tabs:"),screen.indexOf("const days="));
assert.deepEqual([...nav.matchAll(/\{id:"([a-z]+)",icon:/g)].map(x=>x[1]),
  ["overview","assignments","center","stats","settings"]);
for(const text of [
  'assignments:["pending","confirmed","calendar","history"]',
  'center:["upcoming","live","reports"]',
  'stats:["overview","history","performance"]',
  'settings:["profile","availability","venues","notifications"]',
  'testID="referee-overview-identity"',
  'testID="referee-overview-kpis"',
  'testID="referee-overview-attention"',
  'testID="referee-overview-refresh"',
  'testID="referee-overview-show-more"',
  'attention.slice(0,attentionLimit)',
  'setOfflineChecking(Boolean(userId&&data))',
  'refereeAttentionItems(assignments,Date.now(),offlineCounts)',
  'readRefereeOffline(userId,match.id)',
  'setOfflineScanError(entries.some(([,count])=>count<0))',
  'setActiveCenterMatch(item.match);choose("center")',
  'const data=storedData?.person.id===userId?storedData:null',
  'if(activeActor.current!==actor)return',
  'onRefresh={()=>setRefresh(value=>value+1)}',
  'flexDirection:isRTL?"row-reverse":"row"',
])assert.ok(screen.includes(text),"Referee Phase 1 missing: "+text);
for(const part of [
  'if(unsyncedCount>0)',
  'if(!match.authorized)continue',
  'match.reportStatus==="CHANGES_REQUESTED"',
  'start-nowMs<=24*60*60*1000',
  'PRIORITY[a.kind]-PRIORITY[b.kind]',
])assert.ok(helper.includes(part),"Referee attention logic: "+part);
assert.ok(service.includes('stats:{total:matches.length,upcoming:upcoming.length,pending:pending.length,'),
  "Total assignments must include all assigned matches, not repeat completed.");
assert.ok(service.includes('completed:completed.length'),
  "Completed assignments must remain a separate KPI.");
for(const key of [
  "rf1.stat.total","rf1.overview.attentionTitle","rf1.overview.allClear",
  "rf1.overview.invitation","rf1.overview.kickoffSoon","rf1.overview.reportCorrection",
  "rf1.overview.unsynced","rf1.overview.offlineScanError",
  "rf1.overview.additionalActions","rf1.overview.review","rf1.overview.refresh",
  "rf1.overview.showMore","rf1.overview.checkingOffline",
])assert.equal(locales.split('"'+key+'"').length-1,3,"Missing English/Dari/Pashto "+key);
assert.ok(pkg.scripts["verify:referee-dashboard-overview-phase1"]
  .includes("scripts/tests/referee-dashboard-overview-phase1.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:referee-dashboard-overview-phase1"));
console.log("Referee dashboard Overview Phase 1 source and localization verification passed.");
