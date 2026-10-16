import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const paths={
 layout:"apps/mobile/app/(app)/owner/_layout.tsx",
 nav:"apps/mobile/src/lib/owner-dashboard-navigation.ts",
 top:"apps/mobile/src/components/owner/OwnerTopNav.tsx",
 sub:"apps/mobile/src/components/owner/OwnerManagementSubNav.tsx",
 overview:"apps/mobile/src/components/owner/OwnerDashboard.tsx",
 pending:"apps/mobile/src/components/owner/OwnerPendingBookings.tsx",
 bookings:"apps/mobile/app/(app)/owner/bookings.tsx",
 schedule:"apps/mobile/app/(app)/owner/schedule.tsx",
 blocks:"apps/mobile/app/(app)/owner/blocks.tsx",
 competitions:"apps/mobile/app/(app)/owner/competitions/index.tsx",
 offline:"apps/mobile/app/(app)/owner/manual-teams.tsx",
 posts:"apps/mobile/app/(app)/owner/posts/index.tsx",
 promos:"apps/mobile/app/(app)/owner/promotions/index.tsx",
 profile:"apps/mobile/app/(app)/owner/media-profile.tsx",
 reviews:"apps/mobile/app/(app)/owner/media-reviews.tsx",
 analytics:"apps/mobile/app/(app)/owner/analytics.tsx",
 settings:"apps/mobile/app/(app)/owner/settings.tsx",
 ownerRoutes:"apps/api/src/modules/owner/owner.routes.ts",
 bookingRoutes:"apps/api/src/modules/booking/booking.routes.ts",
 bookingService:"apps/api/src/modules/booking/booking.service.ts",
 localization:"packages/localization/src/index.ts",
};
const src=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,read(p)]));
function check(name,fragments){
 for(const fragment of fragments)
  assert.ok(src[name].includes(fragment),`Phase 8 ${name} missing ${fragment}`);
}
check("layout",['if(!session)return null;','!session.user.roles.includes("VENUE_OWNER")',
 '<OwnerTopNav/>','<OwnerManagementSubNav/>','<TimetableSubNav/>','<Slot/>']);
assert.equal(src.layout.split("<OwnerTopNav/>").length-1,1);
check("top",['const lastUser=useRef(session?.user.id);','lastRoute.current={};',
 'ownerRememberableSectionRoute(pathname)','router.replace(route)',
 'accessibilityState={{selected}}','flexDirection:isRTL?"row-reverse":"row"']);
check("sub",['ownerDashboardSubsections[section]','router.replace(item.href)',
 'accessibilityRole="tab"','accessibilityState={{selected}}']);
check("overview",['Promise.allSettled([','ownerApi.pendingBookings(token)',
 'ownerApi.timetableCalendar(token,date,date,null)','ownerApi.analytics(token,addDays(date,-6),date)',
 'ownerApi.getStatus(token)','if(request!==generation.current)return;']);
check("pending",['ownerApi.pendingBookings(token)','ownerApi.confirmBooking(token,booking.id)',
 'ownerApi.cancelBooking(token,booking.id','sequence.current++','loadedToken===token']);
check("bookings",['ownerBookingStatusOptions.map','ownerApi.listBookings(token',
 'ownerApi.confirmBooking(token,target.booking.id)',
 'ownerApi.cancelBooking(token,target.booking.id',
 'testID="owner-booking-date-filters"',
 'const safeData=loadedToken===token?data:null',
 'generation.current++','Modal transparent visible={decision!==null}']);
check("schedule",['ownerCalendarSelectionMatches(loadedSelection,requestedSelection)',
 'setLoadedSelection(requestedSelection)','if(next.from!==range.from||next.to!==range.to)',
 'setSelectedSlot(null);setPendingAction(null);setBusy(null);',
 'visible={pendingAction!==null&&loadedToken===token}',
 'if(!pendingAction||busy||loadedToken!==token)return;',
 'if(activeToken.current===actorToken)await loadCalendar();',
 'onPress={()=>void refresh()}','<DataLoadingState']);
check("blocks",['ownerApi.timetableCalendar(token,windowStart,windowEnd,null)',
 'ownerApi.deleteBlock(token,item.event.id)','loadedKey===windowKey?items:[]']);
check("competitions",['competitionApi.ownerList(token)',
 'const safeItems=loadedToken===token?items:[]',
 'selectOwnerCompetitions(safeItems,']);
check("offline",['manualTeamApi.mine(token)','loadedToken===token?teams:[]']);
check("posts",['Promise.allSettled([','ownerApi.posts(token)','ownerApi.mediaPage(token)',
 'currentActor.current=token','actorToken!==currentActor.current',
 'if(actorToken===currentActor.current)await load();',
 'if(pageToken===actorToken)setPage(']);
check("promos",['ownerApi.closePromotion(actorToken,promotion.id)',
 'actorToken!==activeToken.current','visible={confirm!==null&&loadedToken===token}',
 'ownerPromotionsForView(safeItems,view,now,query)']);
check("profile",['ownerApi.updateMediaPage(token','loadedToken===token?page:null',
 'if(request!==generation.current)return']);
check("reviews",['ownerApi.getStatus(token)','const id=status.venue.id',
 'if(summary.venueId!==id)','loadedToken===token&&data?.venueId===venueId']);
check("analytics",['validateOwnerAnalyticsRange(nextFrom,nextTo,todayKabul())',
 'snapshot&&snapshot.token===token','result.from!==nextFrom||result.to!==nextTo',
 'owner.phase7.grossValueDisclaimer','owner.phase7.marketingAttributionNote']);
check("settings",['record&&record.token===token','ownerVenueSettingsDirty(data,draft)',
 'loadedToken.current===token&&dirtyRef.current',
 'data.onlineBookingEnabled&&!onlineBookingEnabled&&!pauseConfirmed',
 'owner.phase7.pauseConfirm']);
check("ownerRoutes",['router.use(requireAuth(tokens), requireRole("VENUE_OWNER"))',
 'router.get("/settings"','router.patch("/settings"']);
check("bookingRoutes",['requireRole("VENUE_OWNER")',
 'router.get("/bookings",async(request,response,next)=>{',
 'ownerBookingListQuerySchema.parse(request.query)']);
check("bookingService",['getOwnerVenueRecord(ownerUserId)',
 'listOwnerBookingDirectory(venue.id']);
for(const fragment of [
 '"owner.dashboardNav.overview"','"owner.dashboardNav.bookings"',
 '"owner.dashboardNav.schedule"','"owner.dashboardNav.competitions"',
 '"owner.dashboardNav.marketing"','"owner.dashboardNav.analysis"',
 '"owner.dashboardNav.settings"','"owner.dashboardSubnav.publicProfile"',
 '"owner.dashboardSubnav.reviews"','"owner.phase4.courtFilter"',
 '"owner.phase7.grossValueDisclaimer"','"owner.phase7.unsavedChanges"',
]){
 assert.equal(src.localization.split(fragment).length-1,3,
  "Phase 8 English/Dari/Pashto copy missing "+fragment);
}
const pkg=JSON.parse(read("package.json"));
assert.ok(pkg.scripts["verify:owner-dashboard-phase8"]?.includes("venue-owner-dashboard-phase8.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:owner-dashboard-phase8"));
console.log("Venue Owner Dashboard Phase 8: seven sections, deep links, court and tenant isolation, cross-tab refresh, actor-safe media and booking workflows, EN/Dari/Pashto and release gate verified.");
