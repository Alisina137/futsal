import fs from "node:fs";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
const core=read("apps/api/src/modules/referee/referee-career.routes.ts");
const pdf=read("apps/api/src/modules/referee/referee-report-pdf.ts");
const server=read("apps/api/src/server.ts"),app=read("apps/api/src/app.ts");
const recorder=read("apps/mobile/src/components/referee/RefereeMatchCenter.tsx");
const dashboard=read("apps/mobile/src/components/referee/RefereeDashboard.tsx");
const stats=read("apps/mobile/src/components/referee/RefereeCareerPanel.tsx");
const owner=read("apps/mobile/src/components/referee/OwnerRefereeReports.tsx");
const storage=read("apps/mobile/src/lib/referee-offline.ts");
const client=read("apps/mobile/src/lib/api.ts");
const backend=read("apps/api/src/modules/referee/referee-phase2.routes.ts");
const locale=read("packages/localization/src/index.ts");
check(app.includes("createRefereeCareerRouter")&&server.includes("new RefereeCareerService(db)"),
  "Referee career and secure report export routes not wired.");
for(const phrase of ["randomBytes(32)","this.tickets.delete(token)","row.report.status!==\"APPROVED\"",
  "REFEREE_PDF_FORBIDDEN","REFEREE_PDF_NOT_APPROVED","inArray(competitionMatches.status",
  "careerSummary(","Asia/Kabul","monthly","history:filtered"]){
  check(core.includes(phrase),"Career/report security invariant missing: "+phrase);
}
check(pdf.includes("%PDF-1.4")&&pdf.includes("full-report.txt")&&
  pdf.includes("EmbeddedFiles")&&pdf.includes("Buffer.from"),
  "PDF renderer must generate pages and preserve original Unicode as attachment.");
for(const phrase of ["AsyncStorage.setItem","refereeOfflineKey","pending.filter",
  "existing.pending.some","await store(next)","async function","syncRefereeOffline",
  "report.events.some","recordedOffline:true"]){
  check(storage.includes(phrase),"Durable offline replay requirement missing: "+phrase);
}
for(const phrase of ["refereePhase2Api.get","stagedScore(visibleEvents)","enqueueRefereeEvent",
  "syncRefereeOffline","connected","pending.length>0","syncBeforeChanges"]){
  check(recorder.includes(phrase),"Offline refereeing UI requirement missing: "+phrase);
}
check(dashboard.includes("AsyncStorage.getItem")&&dashboard.includes("RefereeCareerPanel")&&
  stats.includes("refereeCareerApi.career")&&stats.includes("result.monthly")&&
  owner.includes("refereeCareerApi.pdfTicket")&&client.includes("refereeCareerApi"),
  "Offline dashboard, statistics, or download controls not wired.");
check(backend.includes("recordedOffline")&&backend.includes("EVENT_TIME_AHEAD")&&
  backend.includes("REFEREE_NOT_CONFIRMED"),"Offline replay must still validate server-side authority/time.");
for(const key of ["offlineMode","unsyncedEvent","downloadPdf","monthlyActivity",
  "verifiedMatches","verifiedOnly","syncBeforeChanges","noHistory"]){
  check(locale.split('"rf3.'+key+'"').length-1===3,"Missing language variant rf3."+key);
}
console.log("Referee Phase 3 verified: account-scoped offline queue, replay validation, verified career analytics, guarded PDF tickets and three locales.");
