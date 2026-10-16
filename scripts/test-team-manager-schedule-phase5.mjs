import assert from "node:assert/strict";
import {
  kabulDay,calendarWeekStart,calendarMonthKey,isInCalendarPeriod,
  advanceCalendarDate,findScheduleConflicts,unansweredPlayerCount,matchFilterAllows,
} from "../apps/mobile/src/lib/team-manager-schedule.ts";
const iso="2026-10-16T20:00:00Z"; // Saturday 00:30 in Kabul
assert.equal(kabulDay(iso),"2026-10-17","UTC rollover must use Kabul");
assert.equal(calendarWeekStart(iso,"fa"),"2026-10-17","RTL week begins Saturday");
assert.equal(calendarWeekStart(iso,"ps"),"2026-10-17","Pashto week begins Saturday");
assert.equal(calendarWeekStart(iso,"en"),"2026-10-12","English week begins Monday");
assert.equal(isInCalendarPeriod("2026-10-18T12:00:00Z",iso,"WEEK","en"),true);
assert.equal(isInCalendarPeriod("2026-10-18T12:00:00Z",iso,"WEEK","fa"),true);
assert.equal(isInCalendarPeriod("2026-10-16T12:00:00Z",iso,"WEEK","fa"),false);
const nov=advanceCalendarDate(iso,"MONTH",1,"en");
assert.equal(kabulDay(nov.toISOString()).slice(0,7),"2026-11");
for(const lang of ["fa","ps"]){
  const next=advanceCalendarDate(iso,"MONTH",1,lang);
  const prev=advanceCalendarDate(iso,"MONTH",-1,lang);
  assert.notEqual(calendarMonthKey(next.toISOString(),lang),calendarMonthKey(iso,lang));
  assert.notEqual(calendarMonthKey(prev.toISOString(),lang),calendarMonthKey(iso,lang));
}
const dateA="2099-01-12T10:00:00Z",dateB="2099-01-12T11:00:00Z";
const activities=[{id:"one",title:"Training",startsAt:dateA,endsAt:dateB}];
const matches=[{opponentName:"Rivals",startsAt:"2099-01-12T10:30:00Z",endsAt:null,status:"SCHEDULED"}];
const base={startsAt:"2099-01-12T10:20:00Z",endsAt:"2099-01-12T10:40:00Z",excludeActivityId:null};
assert.deepEqual(findScheduleConflicts(base,activities,matches).map(x=>x.kind),["ACTIVITY","MATCH"]);
assert.equal(findScheduleConflicts({...base,excludeActivityId:"one"},activities,matches).length,1);
assert.equal(findScheduleConflicts({startsAt:"2099-01-12T14:00:00Z",
 endsAt:"2099-01-12T15:00:00Z",excludeActivityId:null},activities,matches).length,0);
assert.equal(unansweredPlayerCount(["a","b","c"],["a","c"]),1);
assert.equal(matchFilterAllows("POSTPONED","UPCOMING",dateA,"2099-01-12"),false);
assert.equal(matchFilterAllows("POSTPONED","POSTPONED",dateA,"2099-01-12"),true);
assert.equal(matchFilterAllows("IN_PROGRESS","LIVE",dateA,"2099-01-12"),true);
assert.equal(matchFilterAllows("CORRECTED","FINISHED",dateA,"2099-01-12"),true);
assert.equal(matchFilterAllows("CANCELLED","UPCOMING",dateA,"2099-01-12"),false);
console.log("Team Manager Phase 5 calendar behavior passed: Kabul rollover, locale week starts, solar months, conflicts, no-reply counters and match status separation.");
