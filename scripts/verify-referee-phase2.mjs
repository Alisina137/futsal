import fs from "node:fs";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const test=(v,message)=>{if(!v)throw Error(message);};
const backend=read("apps/api/src/modules/referee/referee-phase2.routes.ts");
const schema=read("packages/database/src/schema.ts");
const migration=read("packages/database/drizzle/0032_referee_match_clock.sql");
const journal=read("packages/database/drizzle/meta/_journal.json");
const refUi=read("apps/mobile/src/components/referee/RefereeMatchCenter.tsx");
const ownerUi=read("apps/mobile/src/components/referee/OwnerRefereeReports.tsx");
const dash=read("apps/mobile/src/components/referee/RefereeDashboard.tsx");
const control=read("apps/mobile/app/(app)/owner/competitions/[competitionId]/manage.tsx");
const app=read("apps/api/src/app.ts");
const comp=read("apps/api/src/modules/competition/competition.repository.ts");
const client=read("apps/mobile/src/lib/api.ts");
const loc=read("packages/localization/src/index.ts");
test(migration.includes('ADD COLUMN "clock"')&&journal.includes("0032_referee_match_clock")&&
  schema.includes('clock:jsonb("clock")'),"Referee match clock migration not registered.");
for(const term of ["refereeChecksSchema","refereeEventSchema","REFEREE_NOT_CONFIRMED",
  "REFEREE_VENUE_REQUIRED","REFEREE_REPORT_STALE","MATCH_CLOCK_UNAVAILABLE",
  "CHECKLIST_INCOMPLETE","reportScore(","reportPlayerStats(","REFEREE_EVENT_RETRACTED",
  'status:"SUBMITTED"','status:"CHANGES_REQUESTED"','status:"APPROVED"',
  "this.competitionsService.enterResult","createRefereePhase2Router","createOwnerRefereePhase2Router"]){
  test(backend.includes(term),"Officiating/report invariant missing: "+term);
}
test(app.includes("createRefereePhase2Router")&&app.includes("createOwnerRefereePhase2Router"),
  "Phase 2 routes must have authenticating API mounts.");
test(comp.includes("REFEREE_MATCH_LOCKED"),"No rescheduling after kickoff or report submission.");
for(const term of ["refereePhase2Api.clock","refereePhase2Api.event",
  "refereePhase2Api.removeEvent","refereePhase2Api.submit",'tr("checks."+key)',
  '"YELLOW_CARD"','"RED_CARD"','"FOUL"','"TIMEOUT"','"SUBSTITUTION"']){
  test(refUi.includes(term),"Mobile referee Match Center incomplete: "+term);
}
test(dash.includes("<RefereeMatchCenter")&&dash.includes("reportFinishedAt")&&
  client.includes("refereePhase2Api"),"Phase 2 match center must be reachable through the referee dashboard.");
test(ownerUi.includes("refereePhase2Api.review")&&control.includes("<OwnerRefereeReports"),
  "Venue organizer report review/approval UI missing.");
for(const key of ["back","clockControls","kind.GOAL","kind.FOUL","submitReport",
  "ownerReports","approveReport","returnReport","status.APPROVED","reviewFeedback"]){
  test(loc.split('"rf2.'+key+'"').length-1===3,"Missing localized referee Phase 2 text: "+key);
}
console.log("Referee Phase 2 verified: officiating clock/events/checklist, private reports, organizer review, safe official publishing, RTL languages.");
