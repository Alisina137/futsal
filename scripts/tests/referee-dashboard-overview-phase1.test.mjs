import test from "node:test";
import assert from "node:assert/strict";
import {refereeAttentionItems} from "../../apps/mobile/src/lib/referee-overview.ts";

const NOW=Date.parse("2026-10-17T08:00:00Z");
const at=minutes=>new Date(NOW+minutes*60_000).toISOString();
const match=(id,overrides={})=>({
  id,startsAt:at(90),authorized:true,responseStatus:"PENDING",
  matchStatus:"SCHEDULED",reportStatus:null,reportStartedAt:null,
  homeTeamName:"Home",awayTeamName:"Away",venueName:"Court",
  ...overrides,
});
test("Only future authorized pending invitations need an acceptance decision",()=>{
  const items=refereeAttentionItems([
    match("future"),match("expired",{startsAt:at(-1)}),
    match("revoked",{authorized:false}),match("declined",{responseStatus:"DECLINED"}),
  ],NOW);
  assert.deepEqual(items.map(item=>item.key),["PENDING:future"]);
});
test("Confirmed matches surface a kickoff reminder only in the next 24 hours",()=>{
  const items=refereeAttentionItems([
    match("soon",{responseStatus:"ACCEPTED"}),
    match("later",{responseStatus:"ACCEPTED",startsAt:at(25*60)}),
    match("started",{responseStatus:"ACCEPTED",reportStartedAt:at(-3)}),
    match("past",{responseStatus:"ACCEPTED",startsAt:at(-1)}),
  ],NOW);
  assert.deepEqual(items.map(item=>item.key),["IMMINENT:soon"]);
});
test("Returned reports get attention; approved and submitted reports do not",()=>{
  const items=refereeAttentionItems([
    match("returned",{responseStatus:"ACCEPTED",matchStatus:"COMPLETED",
      reportStatus:"CHANGES_REQUESTED"}),
    match("approved",{responseStatus:"ACCEPTED",matchStatus:"COMPLETED",
      reportStatus:"APPROVED"}),
    match("sent",{responseStatus:"ACCEPTED",matchStatus:"COMPLETED",
      reportStatus:"SUBMITTED"}),
  ],NOW);
  assert.deepEqual(items.map(item=>item.key),["CORRECTION:returned"]);
});
test("Offline event warnings survive permission revocation without exposing other match IDs",()=>{
  const items=refereeAttentionItems([
    match("revoked",{authorized:false,responseStatus:"ACCEPTED"}),
    match("mine",{responseStatus:"ACCEPTED"}),
  ],NOW,{"revoked":3,"mine":2,"other-player":99});
  assert.deepEqual(items.filter(item=>item.kind==="UNSYNCED").map(item=>[item.match.id,item.unsyncedCount]),
    [["revoked",3],["mine",2]]);
  assert.ok(!items.some(item=>item.key.includes("other-player")));
});
test("Critical offline and correction alerts sort before pending invitations and match reminders",()=>{
  const items=refereeAttentionItems([
    match("pending",{startsAt:at(30)}),
    match("soon",{responseStatus:"ACCEPTED",startsAt:at(60)}),
    match("returned",{responseStatus:"ACCEPTED",matchStatus:"COMPLETED",
      reportStatus:"CHANGES_REQUESTED"}),
  ],NOW,{"soon":1});
  assert.deepEqual(items.map(item=>item.kind),
    ["UNSYNCED","CORRECTION","PENDING","IMMINENT"]);
});
test("Dashboard summaries are pure and never modify API response arrays",()=>{
  const list=Object.freeze([Object.freeze(match("first")),Object.freeze(match("second"))]);
  const first=refereeAttentionItems(list,NOW);
  const second=refereeAttentionItems(list,NOW);
  assert.deepEqual(first,second);
  assert.equal(list[0].id,"first");
});
