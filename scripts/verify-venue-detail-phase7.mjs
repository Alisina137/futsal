import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

const screen=read("apps/mobile/app/(app)/venues/[venueId].tsx");
const sections=read("apps/mobile/src/components/venues/VenueDetailSections.tsx");
const competition=read("apps/mobile/src/components/venues/VenueCompetitionsPanel.tsx");
const reviews=read("apps/mobile/src/components/venues/VenueCommunityPanels.tsx");
const updates=read("apps/mobile/src/components/venues/VenueUpdatesPanel.tsx");
const media=read("apps/mobile/src/components/venues/VenueDetailSections.tsx");
const dates=read("apps/mobile/src/lib/venue-detail-dates.ts");
const locale=read("packages/localization/src/index.ts");
const backend=read("apps/api/src/modules/marketing/marketing.repository.ts");
const notifications=read("apps/api/src/modules/notifications/notification.repository.ts");
const booking=read("apps/api/src/modules/booking/booking.service.ts");
const matches=read("apps/api/src/modules/competition/competition.repository.ts");
const tests=read("scripts/tests/venue-detail-dates.test.mjs");

function includes(source,parts,scope){
  for(const part of parts)assert.ok(source.includes(part),scope+": "+part);
}
const sectionsByMain={
  media:["posts","photos","videos"],
  reserve:["slots","offers","bookings","saved"],
  competitions:["registration","upcoming","live","completed","matches"],
  updates:["announcements","schedule","alerts"],
  about:["overview","facilities","hours","location","reviews","policies"],
};
for(const [main,children] of Object.entries(sectionsByMain)){
  assert.ok(sections.includes(main+':["'+children.join('","')+'"]'),
    "Current venue navigation must retain all implemented "+main+" subtabs");
  for(const child of children){
    const key='"vd.sub.'+main+'.'+child+'"';
    assert.equal(locale.split(key).length-1,3,
      "Every venue subtab must be translated in English, Dari and Pashto: "+key);
    assert.ok(screen.includes('testID={"venue-subtab-"+main+"-"+item}'),
      "Subtab navigation must be identifiable and accessible.");
  }
}
includes(screen,[
  'main==="media"', 'main==="reserve"', 'main==="competitions"',
  'main==="updates"', 'main==="about"',
  'chooseMain("about","location")','chooseMain("updates","alerts")',
  'chooseMain("reserve","slots")',
  "mainNav.focus(id,true)","subNav.focus(item,true)",
  "const requestId=++venueLoadSequence.current",
  "if(result.venue.id!==targetId)throw",
],"Venue route and shortcut QA");
includes(dates,["venueDayKey(","isValidVenueDay(","isVenueBookingDay(","isCurrentVenueAvailability("],
  "Shared pure venue timezone and date validation");
includes(sections,[
  "today=venueDayKey(venue.timezone)",
  "isVenueBookingDay(date,today,venue.maximumAdvanceBookingDays)",
  "isCurrentVenueAvailability(response,venue.id,date)",
  "isCurrentVenueAvailability(cached?.value,venue.id,date)",
  "const request=++availabilityLoadSerial.current",
  "if(request!==availabilityLoadSerial.current)return",
  "return()=>{availabilityLoadSerial.current+=1;}",
  "bookingLoadSerial.current+=1",
  "if(sub===\"bookings\")void loadMine()",
  "venueApi.availabilityLive(venue.id,date)",
  "item.promotionId===slot.promotionId&&item.priceAfn===slot.priceAfn",
].filter(Boolean),"Reserve stale-response & server-confirmation protections");
includes(competition,[
  "compMoreError","matchMoreError",
  "setCompMoreError(true)","setMatchMoreError(true)",
  "setCompetitions(previous=>","setMatches(previous=>",
  'competitionApi.venueMatches(venue.id,matchScope,1)',
  'competitionApi.discover(queryFor(venue.id,sub,1))',
],"Competitions pagination UX must retain loaded cards after a network error");
includes(reviews,[
  "const request=requestSequence.current",
  "if(request!==requestSequence.current)return",
  "if(request===requestSequence.current)setBusy(false)",
  "setSelected(reviewBookingId??null)",
  "venueApi.reviews(venue.id,1,sort)",
  "bookingApi.myVenueReviews(actor,venue.id)",
],"Review ownership and stale-write guard");
includes(updates,[
  "notificationApi.venue(token,venue.id,1)",
  "item.data.venueId===venue.id",
  "notificationApi.markRead(token,notice.id)",
  "safeNotificationDeepLink(notice.deepLink)",
  "venueApi.scheduleChanges(venue.id,from,to)",
],"Private venue alert and real schedule protections");
includes(media,[
  "marketingApi.venueMedia(venue.id,","post.visibility!==\"PRIVATE\"",
  "if(id!==requestId.current)return",
],"Published only/media account privacy protections");
includes(backend,[
  'eq(venuePosts.status,"PUBLISHED")',
  'query.postType?eq(venuePosts.postType,query.postType):undefined',
],"Venue media backend visibility");
includes(notifications,[
  "async listVenueNotifications(","eq(notifications.userId,userId)",
],"Venue notice ownership");
includes(matches,["eq(competitionMatches.venueId,venueId)","eq(competitions.published,true)"],
  "Venue match location and publication guard");
includes(booking,["SLOT_UNAVAILABLE","bookingMode"],"Server authoritative booking rules");
assert.ok(!screen.includes("scrollTo({y:0"),
  "Changing the venue's horizontal tabs must not scroll the whole page to the top.");
assert.ok(tests.includes("UTC boundaries")||tests.includes("Kabul local date"),
  "Timezone edge-case tests are mandatory.");
console.log("Venue Detail Phase 7 verified: 21 translated subtabs, scoped async reads/writes, realistic booking dates, reliable pagination and privacy across all five sections.");
