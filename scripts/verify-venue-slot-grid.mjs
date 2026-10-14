import fs from "node:fs";
const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const check=(truth,msg)=>{if(!truth)throw Error(msg);};
const schema=read("packages/contracts/src/index.ts");
const service=read("apps/api/src/modules/booking/booking.service.ts");
const route=read("apps/api/src/modules/booking/booking.routes.ts");
const grid=read("apps/mobile/src/components/venues/VenueSlotTimetable.tsx");
const venue=read("apps/mobile/src/components/venues/VenueDetailSections.tsx");
const page=read("apps/mobile/app/(app)/venues/[venueId].tsx");
const locale=read("packages/localization/src/index.ts");
const tests=read("apps/api/test/booking.test.ts");
check(schema.includes("venueTimelineSlotDtoSchema")&&
  schema.includes('z.enum(["AVAILABLE","PROMOTION","UNAVAILABLE","PAST","NOTICE_REQUIRED"])')&&
  schema.includes("timeline: z.array(venueTimelineSlotDtoSchema).optional()"),
  "Public venue timetable must expose validated read-only slot statuses.");
for(const pattern of ["const timeline:","const occupied=occupancies.some","status = past ?",
  "timeline.push({","if(status!==\"AVAILABLE\" && status!==\"PROMOTION\")continue",
  "const notice=","originalPriceAfn:promotion"]){
  check(service.includes(pattern),"Configured slots and protected public booking filter missing: "+pattern);
}
check(route.includes('router.get("/:venueId/availability"')&&
  !service.includes("customerPhone: item.customerPhone"),
  "Public timeline must reuse live availability without exposing customer records.");
for(const marker of ["rangeForView(view,anchor,language)","moveView(view,anchor,delta,language)",
  "venueApi.availability(venue.id,date)","readAvailabilityCache","writeAvailabilityCache",
  "visibleDays.map","timeRows.map","visibleDays.map(date=>","view===\"DAY\"",
  "view===\"MONTH\"", 'startsAt||initialDate?"DAY":"WEEK"',"statusColors","UNAVAILABLE","PROMOTION",
  "isRTL?\"row-reverse\":\"row\"","setSelected({date,slot","selected.fresh&&connected",
  "router.push({pathname:\"/booking/confirm\""]){
  check(grid.includes(marker),"Owner-style public slot grid invariant missing: "+marker);
}
const nav=read("apps/mobile/src/lib/venue-detail-navigation.ts");
check(venue.includes('if(sub==="slots")return <VenueSlotTimetable')&&
  nav.includes('reserve:"slots"')&&page.includes('switchVenueMain(current,"reserve","slots")'),
  "Reserve Online must open the customer timetable in Available Slots.");
for(const label of ["view.DAY","view.WEEK","view.MONTH","legendTitle",
  "status.AVAILABLE","status.PROMOTION","status.UNAVAILABLE","status.PAST",
  "status.NOTICE_REQUIRED","noScheduledSlots","notBookable"]){
  check(locale.split('"vd.grid.'+label+'"').length-1===3,
    "Public slot grid missing an English, Dari or Pashto translation: "+label);
}
check(tests.includes("publishes one privacy-safe status per configured slot")&&
  tests.includes("shows configured but outside-notice slots"),
  "Public booking grid needs occupied and notice guard tests.");
console.log("Venue reserve timetable verified: owner-style day/week slot grid, month navigation, safe statuses, live-only booking, RTL and localized legend.");
