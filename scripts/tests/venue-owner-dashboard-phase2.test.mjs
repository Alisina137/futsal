import assert from "node:assert/strict";
import {test} from "node:test";
import {
  computeOwnerOverview,ownerAttentionItems,ownerPerformance,percentage,overviewTabs,
} from "../../apps/mobile/src/lib/owner-dashboard-overview.ts";

const day="2026-10-15";
const now=Date.parse("2026-10-15T08:00:00+04:30");
const iso=h=>new Date(Date.parse("2026-10-15T00:00:00+04:30")+h*3_600_000).toISOString();
const event=(id,type,start,status="CONFIRMED",price=500)=>({
  id,type,startsAt:iso(start),endsAt:iso(start+1),areaName:"Court A",
  title:id,priceAfn:price,bookingStatus:status,
});
const booking=(id,start,status="PENDING")=>({id,startsAt:iso(start),status});
const competition=(id,status)=>({id,status});
const status=(options={})=>({
  venue:{onlineBookingEnabled:options.onlineBookingEnabled??true},
  subscription:{state:options.state??"ACTIVE",activeUntil:options.expires??"2026-12-01T00:00:00Z",trialEndsAt:null},
});
const calendar=(events)=>({
  date:day,availableCount:8,bookedCount:3,revenueAfn:50000,
  events,closed:false,
});
const snapshot=(changes={})=>({
  day:calendar([event("confirmedFuture","ONLINE_BOOKING",12),
    event("offline","MANUAL_BOOKING",13,"CONFIRMED",700),
    event("pendingNotConfirmed","ONLINE_BOOKING",14,"PENDING"),
    event("cancelled","ONLINE_BOOKING",16,"CANCELLED"),
    event("pastAvailable","AVAILABLE",5),
    event("availableFuture","AVAILABLE",15),
    event("promotionFuture","PROMOTION",17),
    event("pastConfirmed","ONLINE_BOOKING",6,"CONFIRMED",300),
    event("match","COMPETITION",18),
  ]),
  pending:[booking("before",5),booking("after",13),booking("cancel",12,"CANCELLED")],
  competitions:[competition("active","IN_PROGRESS"),competition("open","REGISTRATION_OPEN"),
    competition("closed","COMPLETED")],
  analytics:null,failures:[],...changes,
});
const compute=(snap=snapshot(),st=status(),date=day,at=now)=>computeOwnerOverview(snap,st,date,at);

test("Today counts confirmed bookings once and excludes pending/cancelled",()=>{
  const result=compute();
  assert.equal(result.confirmedToday,3);
  assert.equal(result.confirmedBookingValueToday,1500);
  assert.equal(result.pendingCount,1);
  assert.equal(result.activeCompetitionCount,2);
  assert.equal(result.registrationOpenCount,1);
  assert.equal(result.availableToday,2);
  assert.equal(result.upcomingMatchCount,1);
});
test("Today's upcoming events follow time order and hide yesterday, pending, closed or cancelled",()=>{
  const events=compute().upcoming;
  assert.deepEqual(events.map(item=>item.id),["confirmedFuture","offline","match"]);
});
test("past available inventory cannot inflate bookable slots even when daily server count includes it",()=>{
  const result=compute(snapshot({day:calendar([event("old","AVAILABLE",6),event("later","PROMOTION",12)])}));
  assert.equal(result.availableToday,1);
});
test("one confirmed booking is not counted twice if calendar repeats its event",()=>{
  const unique=event("one","ONLINE_BOOKING",12);
  const result=compute(snapshot({day:calendar([unique,unique])}));
  assert.equal(result.confirmedToday,1);
  assert.equal(result.confirmedBookingValueToday,500);
});
test("only current Kabul day is eligible: stale data never appears as zero or today",()=>{
  const stale=compute(snapshot({day:{...calendar([]),date:"2026-10-14"}}));
  assert.equal(stale.confirmedToday,null);
  assert.equal(stale.availableToday,null);
  assert.equal(stale.upcomingMatchCount,null);
  assert.equal(stale.confirmedBookingValueToday,null);
});
test("optional API failure produces explicit unknown metrics, not false zeros",()=>{
  const result=compute(snapshot({day:null,pending:null,competitions:null}));
  assert.equal(result.confirmedToday,null);
  assert.equal(result.pendingCount,null);
  assert.equal(result.activeCompetitionCount,null);
  assert.deepEqual(ownerAttentionItems(result),[]);
});
test("attention routes only actionable tasks in priority order",()=>{
  const result=compute();
  const items=ownerAttentionItems(result);
  assert.deepEqual(items.map(item=>item.key),["pending","registrations"]);
  assert.deepEqual(items.map(item=>item.href),["/owner/bookings","/owner/competitions"]);
});
test("subscription expiring within seven days and paused bookings become actions",()=>{
  const st=status({state:"TRIAL",expires:new Date(now+4*86_400_000).toISOString(),onlineBookingEnabled:false});
  const items=ownerAttentionItems(compute(snapshot(),st));
  assert.deepEqual(items.map(item=>item.key),["pending","subscription","paused","registrations"]);
});
test("expired subscription remains actionable; long-active subscriptions do not",()=>{
  const expired=ownerAttentionItems(compute(snapshot({pending:[],competitions:[]}),status({state:"EXPIRED"})));
  assert.deepEqual(expired.map(item=>item.key),["subscription"]);
  const good=ownerAttentionItems(compute(snapshot({pending:[],competitions:[]}),status()));
  assert.deepEqual(good,[]);
});
test("performance uses authoritative analytics values and distinguishes booking value from payment",()=>{
  const analytics={grossBookingValueAfn:43000,bookingCount:21,occupancyRate:0.42,
    cancellationRate:0.15,onlineBookingShare:0.7,comparison:{
      revenueChangeRate:null,bookingChangeRate:-0.1,occupancyChangeRate:0.15,
    }};
  const result=ownerPerformance(analytics);
  assert.equal(result?.grossBookingValue,43000);
  assert.equal(result?.bookings,21);
  assert.equal(result?.revenueChangeRate,null);
  assert.equal(percentage(result?.occupancy), "42.0%");
  assert.equal(percentage(result?.revenueChangeRate),"—");
  assert.equal(percentage(-0.12),"-12.0%");
  assert.equal(ownerPerformance(null),null);
});
test("subtab defaults and ordering remain Today > Action Center > Performance",()=>{
  assert.deepEqual(overviewTabs,["today","actions","performance"]);
});
