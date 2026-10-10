import fs from "node:fs";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const assert=(v,msg)=>{if(!v)throw Error(msg);};
const schema=read("packages/database/src/schema.ts");
const journal=read("packages/database/drizzle/meta/_journal.json");
const sql=read("packages/database/drizzle/0031_referee_dashboard.sql");
const api=read("apps/api/src/modules/referee/referee.routes.ts");
const booking=read("apps/api/src/modules/competition/competition.repository.ts");
const screen=read("apps/mobile/src/components/referee/RefereeDashboard.tsx");
const route=read("apps/mobile/app/(app)/dashboard.tsx");
const client=read("apps/mobile/src/lib/api.ts");
const loc=read("packages/localization/src/index.ts");
const owner=read("apps/api/src/app.ts");
assert(journal.includes("0031_referee_dashboard")&&schema.includes("refereeMatchResponses")&&
  schema.includes("refereeProfiles")&&sql.includes('CREATE TABLE "referee_match_responses"'),
  "Referee phase 1 schema and migration missing.");
assert(booking.includes("tx.insert(refereeMatchResponses)")&&booking.includes('status:"PENDING"'),
  "Organizer assignment must create a pending appointment in scheduling transaction.");
for(const term of ["pg_advisory_xact_lock","REFEREE_TIME_CONFLICT","REFEREE_CONFLICT_OF_INTEREST",
  "availabilityAllows","WITHDRAW_REQUESTED","REFEREE_VENUE_REQUIRED","refereeProfileSchema",
  "organizerAssignments","eq(refereeMatchResponses.refereeUserId,userId)"]){
  assert(api.includes(term),"Referee access or appointment invariant missing: "+term);
}
assert(owner.includes("createRefereeRouter")&&owner.includes("createOwnerRefereeReportRouter"),
  "Authenticated referee and owner status routes must be wired.");
assert(screen.includes("tabs.map(")&&screen.includes("subTabs[main]")&&
  screen.includes('flexDirection:isRTL?"row-reverse":"row"')&&
  screen.includes("refereeApi.updateProfile")&&screen.includes("refereeApi.respond"),
  "Five-tab localized referee dashboard or real controls missing.");
assert(route.includes("<RefereeDashboard/>")&&client.includes("export const refereeApi"),
  "Referee main dashboard must use the typed real API.");
for(const key of ["nav.overview","nav.assignments","nav.center","nav.stats","nav.settings",
  "settings.availability","assignments.pending","center.live","stats.performance","status.ACCEPTED"]){
  assert(loc.split('"rf1.'+key+'"').length-1===3,"Missing referee locale: "+key);
}
const career=read("apps/mobile/src/components/referee/RefereeCareerPanel.tsx");
const dateTime=read("apps/mobile/src/lib/date-time.ts");
assert(screen.includes('flexBasis:"46%"')&&career.includes('flexBasis:"46%"')&&
  screen.includes('flexWrap:"wrap"')&&career.includes('flexWrap:"wrap"')&&
  screen.includes('minHeight:112')&&career.includes('minHeight:112'),
  "Referee overview and career statistics must render in two readable columns.");
assert(screen.includes("formatRefereeCalendarPeriod(calendarAnchor,calendarView,language)")&&
  screen.includes("styles.calendarPeriodPanel")&&screen.includes("styles.calendarControls")&&
  !screen.includes("fmt(calendarAnchor.toISOString())")&&
  dateTime.includes("formatRefereeCalendarPeriod")&&
  dateTime.includes("AFGHANISTAN_TIME_ZONE"),
  "Calendar must show the selected Kabul calendar period separately from navigation.");
assert(screen.includes("formatRefereeScheduleParts(value,language)")&&
  career.includes("formatRefereeScheduleParts(item.finishedAt,language)")&&
  screen.includes('tr("calendar.kabulTime")'),
  "Referee appointment cards must display date/time separately in Kabul time.");
for(const key of ["rf1.calendar.selectedPeriod","rf1.calendar.kabulTime","rf3.kabulTime"]){
  assert(loc.split('"'+key+'"').length-1===3,"Missing localized referee date label: "+key);
}
console.log("Referee Phase 1 verified: five tabs, RTL, appointments, 2x2 metric cards and readable Kabul calendar.");
