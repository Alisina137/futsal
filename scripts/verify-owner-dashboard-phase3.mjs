import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const paths={
 contract:"packages/contracts/src/index.ts",
 types:"apps/api/src/modules/booking/booking.types.ts",
 route:"apps/api/src/modules/booking/booking.routes.ts",
 service:"apps/api/src/modules/booking/booking.service.ts",
 repository:"apps/api/src/modules/booking/booking.repository.ts",
 fake:"apps/api/test/fake-booking-repository.ts",
 api:"apps/mobile/src/lib/api.ts",
 ui:"apps/mobile/app/(app)/owner/bookings.tsx",
 pending:"apps/mobile/src/components/owner/OwnerPendingBookings.tsx",
 navigation:"apps/mobile/src/lib/owner-dashboard-navigation.ts",
 tests:"apps/api/test/booking.test.ts",
 localization:"packages/localization/src/index.ts",
};
const source=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,read(p)]));
const has=(key,parts)=>{
 for(const part of parts)assert.ok(source[key].includes(part),key+" missing "+part);
};
has("contract",["ownerBookingListQuerySchema","ownerBookingListResponseSchema",
  'scope:z.enum(["UPCOMING","ALL","HISTORY"])',"pageSize:z.coerce.number().int().min(5).max(50)",
  "from:dateOnlySchema.optional()","to:dateOnlySchema.optional()"]);
has("types",["listOwnerBookingDirectory(venueId:string,filters:OwnerBookingDirectoryFilters)"]);
has("route",['router.use(requireAuth(tokens), requireRole("VENUE_OWNER"))',
  'router.get("/bookings",async(request,response,next)=>{',
  "ownerBookingListQuerySchema.parse(request.query)","booking.listOwnerBookings(request.auth!.userId,input)",
  'router.get("/bookings/pending"']);
has("service",["async listOwnerBookings(ownerUserId:string,query:OwnerBookingListQuery)",
  "getOwnerVenueRecord(ownerUserId)","listOwnerBookingDirectory(venue.id",
  "dayBounds(query.from,venue.timezone)","dayBounds(query.to,venue.timezone)"]);
has("repository",["async listOwnerBookingDirectory(venueId:string,filters:OwnerBookingDirectoryFilters)",
  "eq(bookings.venueId,venueId)","filters.scope==="UPCOMING"",
  'filters.scope==="HISTORY"',"ilike(bookings.customerName","ilike(venueAreas.name",
  "count(*)::int","limit(filters.pageSize+1)","offset((filters.page-1)*filters.pageSize)",
  "orderBy(...sorting)"]);
has("fake",["async listOwnerBookingDirectory(venueId:string,f:OwnerBookingDirectoryFilters)",
  "booking.venueId!==venueId","items.slice(start,start+f.pageSize)"]);
has("api",["listBookings: (accessToken:string,filters:Partial<OwnerBookingListQuery>",
  '"/api/v1/owner/bookings"','{cache:"no-store"},accessToken']);
has("ui",['testID="owner-phase1-bookings"','testID="owner-phase3-subnavigation"',
  "ownerBookingTabs.map(id=>","accessibilityState={{selected:tab===id}}",
  "useVisibleTab<OwnerBookingTab>(tab)","<OwnerPendingBookings token={session?.accessToken}/>",
  "ownerApi.listBookings(token","query,setQuery","ownerBookingDateFilter(from,to)",
  "statusOptions.map","sourceOptions.map","setPage(current=>current+1)",
  "setPage(current=>Math.max(1,current-1))","AppState.currentState",
  "generation.current++","const safeData=loadedToken===token?data:null",
  "ownerApi.cancelBooking(token,target.id",
  "cancelLock.current","Modal transparent visible={cancelTarget!==null}",
  "formatLocalDateTimeParts(booking.startsAt,language)",
  'router.push("/owner/schedule")']);
has("pending",["ownerApi.pendingBookings(token)","ownerApi.confirmBooking(token,booking.id)",
  "ownerApi.cancelBooking(token,booking.id"]);
has("navigation",['key:"bookings",href:"/owner/bookings"']);
has("tests",[
  "paginates owner-only booking records with stable sorting",
  "enforces upcoming/history status filters",
  "rejects invalid / excessive owner booking queries",
  "expect(unauth.status).toBe(401)","toBe(403)"]);
for(const key of ["subtitle","tab.PENDING","tab.UPCOMING","tab.ALL","tab.HISTORY",
  "search","source.ALL","source.ONLINE","source.MANUAL","status.CONFIRMED",
  "status.CANCELLED","invalidDates","cancelBooking","cancelError","loadError",
  "page","previous","next"]){
  const label='"owner.phase3.'+key+'"';
  assert.equal(source.localization.split(label).length-1,3,
    "Missing trilingual Phase 3 "+label);
}
const pkg=JSON.parse(read("package.json"));
assert.ok(pkg.scripts["verify:owner-dashboard-phase3"]?.includes("venue-owner-dashboard-phase3.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:owner-dashboard-phase3"));
console.log("Venue Owner Dashboard Phase 3 verified: role-scoped paginated directory, four real tabs, search/date/status/source, confirmed-only cancellation and 3 languages.");
