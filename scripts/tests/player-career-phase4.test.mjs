import test from "node:test";
import assert from "node:assert/strict";
import {careerPeriod,careerDateTime,careerResults,careerMonthlyTrend,careerPersonalBest}
  from "../../apps/mobile/src/lib/player-career-view.ts";
const row=(matchId,recordedAt,goals,assists,result="WIN")=>({
  matchId,recordedAt,goals,assists,result,
});
test("Kabul calendar respects midnight rollover and Solar Hijri year",()=>{
  const edge="2025-12-31T20:20:00Z";
  assert.equal(careerPeriod(edge,"en").key,"2026-01");
  // March 21, 2025 is early 1404 in the Persian calendar.
  const solar=careerPeriod("2025-03-21T12:00:00Z","fa-AF");
  assert.equal(solar.year,"1404");
  assert.equal(careerPeriod("2025-03-21T12:00:00Z","ps-AF").year,"1404");
  assert.match(careerDateTime(edge,"en"),/2026/);
  assert.match(careerDateTime(edge,"fa-AF"),/۱۴۰۴|۱۴۰۵|1404|1405/);
});
test("history sorting, outcome filtering, and match deduplication",()=>{
  const rows=[
    row("1","2025-01-03T12:00:00Z",2,1,"WIN"),
    row("2","2025-01-04T12:00:00Z",0,0,"LOSS"),
    row("1","2025-01-03T12:00:00Z",2,1,"WIN"),
    row("3","2025-01-05T12:00:00Z",1,3,"DRAW"),
  ];
  assert.deepEqual(careerResults(rows,"ALL").map(x=>x.matchId),["3","2","1"]);
  assert.deepEqual(careerResults(rows,"WIN").map(x=>x.matchId),["1"]);
  assert.deepEqual(careerPersonalBest(rows),{goals:2,assists:3});
});
test("Kabul monthly chart aggregates distinct official appearances",()=>{
 const rows=[
  row("1","2025-12-31T18:30:00Z",2,1),
  row("2","2025-12-31T20:30:00Z",1,2),
  row("2","2025-12-31T20:30:00Z",1,2),
 ];
 assert.deepEqual(careerMonthlyTrend(rows,"goals","en"),[
  {key:"2025-12",value:2},{key:"2026-01",value:1},
 ]);
 assert.deepEqual(careerMonthlyTrend(rows,"matches","en"),[
  {key:"2025-12",value:1},{key:"2026-01",value:1},
 ]);
});
