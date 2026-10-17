import test from "node:test";
import assert from "node:assert/strict";
import {refereeOverviewRecovery} from "../../apps/mobile/src/lib/referee-dashboard-safety.ts";
import {refereeScopedUuid,validOfflineEvent,validRefereeOfflineRecord}
  from "../../apps/mobile/src/lib/referee-offline-safety.ts";
import {refereeSettingsChanged,refereeSettingsIssue}
  from "../../apps/mobile/src/lib/referee-settings.ts";
import {refereeAvailabilityPreview}
  from "../../apps/mobile/src/lib/referee-calendar.ts";

const user="11111111-1111-4111-8111-111111111111";
const other="22222222-2222-4222-8222-222222222222";
const matchId="33333333-3333-4333-8333-333333333333";
const event=()=>({id:"44444444-4444-4444-8444-444444444444",kind:"GOAL",
  side:"HOME",playerUserId:null,assistingUserId:null,period:1,elapsedSeconds:27,details:""});
const record=()=>({version:1,userId:user,matchId,cached:null,pending:[event()],summaryDraft:"Draft"});
const profile=()=>({level:null,experienceYears:4,biography:"",acceptingAssignments:true,
  weeklyAvailability:[{day:6,start:"09:00",end:"13:00"}],exceptions:[]});
const slot={startsAt:"2026-10-17T05:00:00.000Z",endsAt:"2026-10-17T06:00:00.000Z"};
test("Only genuine transport outages allow a private offline overview",()=>{
  assert.equal(refereeOverviewRecovery({code:"NETWORK_ERROR",status:null}),"OFFLINE");
  assert.equal(refereeOverviewRecovery({code:"TIMEOUT",status:null}),"OFFLINE");
  for(const e of [{code:"ACCOUNT_SUSPENDED",status:403},
    {code:"REFEREE_FORBIDDEN",status:403},{code:"HTTP_ERROR",status:401},
    {code:"REQUEST_CANCELLED",status:null},{code:"NETWORK_ERROR",status:403},
    {code:"RATE_LIMITED",status:429},new Error("offline"),null]){
    assert.equal(refereeOverviewRecovery(e),"REJECT");
  }
});
test("Account and match storage keys require complete UUIDs",()=>{
  assert.equal(refereeScopedUuid(user),true);
  assert.equal(refereeScopedUuid("x".repeat(36)),false);
  assert.equal(refereeScopedUuid("-".repeat(36)),false);
  assert.equal(refereeScopedUuid(user+"../other"),false);
  assert.equal(refereeScopedUuid(null),false);
});
test("A legitimate cached match and pending event may be restored",()=>{
  assert.equal(validOfflineEvent(event()),true);
  assert.equal(validRefereeOfflineRecord(record(),user,matchId),true);
  assert.equal(validRefereeOfflineRecord({...record(),cached:{
    match:{id:matchId},report:{matchId},roster:[]}},user,matchId),true);
});
test("Offline history never crosses account or match boundaries",()=>{
  assert.equal(validRefereeOfflineRecord(record(),other,matchId),false);
  assert.equal(validRefereeOfflineRecord(record(),user,other),false);
  assert.equal(validRefereeOfflineRecord({...record(),cached:{
    match:{id:other},report:null,roster:[]}},user,matchId),false);
  assert.equal(validRefereeOfflineRecord({...record(),cached:{
    match:{id:matchId},report:{matchId:other},roster:[]}},user,matchId),false);
});
test("Corrupt or duplicate offline events are rejected rather than silently replayed",()=>{
  const items=[
    {...event(),id:"invalid"},
    {...event(),elapsedSeconds:Infinity},
    {...event(),elapsedSeconds:-1},
    {...event(),period:3},
    {...event(),kind:"BAD"},
    {...event(),details:"x".repeat(401)},
    {...event(),playerUserId:"not-a-uuid"},
    {...event(),side:"UNKNOWN"},
    {...event(),side:null},
  ];
  for(const invalid of items)assert.equal(validOfflineEvent(invalid),false);
  assert.equal(validRefereeOfflineRecord({...record(),pending:[event(),event()]},user,matchId),false);
  assert.equal(validRefereeOfflineRecord({...record(),pending:[{kind:"GOAL"}]},user,matchId),false);
  assert.equal(validRefereeOfflineRecord({...record(),summaryDraft:"x".repeat(2001)},user,matchId),false);
  assert.equal(validRefereeOfflineRecord({...record(),version:2},user,matchId),false);
});
test("Settings pause is stronger than an allowed date; zero weekly days deny by default",()=>{
  assert.equal(refereeAvailabilityPreview(slot,profile()),"AVAILABLE");
  assert.equal(refereeAvailabilityPreview(slot,{...profile(),acceptingAssignments:false,
    exceptions:[{date:"2026-10-17",available:true}]}),"UNAVAILABLE");
  assert.equal(refereeAvailabilityPreview(slot,{...profile(),weeklyAvailability:[]}),"UNAVAILABLE");
  assert.equal(refereeAvailabilityPreview(slot,{...profile(),weeklyAvailability:[],
    exceptions:[{date:"2026-10-17",available:true}]}),"AVAILABLE");
});
test("Unsaved preference edits require explicit save or discard",()=>{
  const original=profile();
  assert.equal(refereeSettingsChanged(original,{...original,acceptingAssignments:false}),true);
  assert.equal(refereeSettingsIssue({...original,weeklyAvailability:[
    {...original.weeklyAvailability[0],end:"08:00"}]}),"weeklyRange");
});
