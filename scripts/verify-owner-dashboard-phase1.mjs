import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const routes=read("apps/mobile/src/lib/owner-dashboard-navigation.ts");
const nav=read("apps/mobile/src/components/owner/OwnerTopNav.tsx");
const subnav=read("apps/mobile/src/components/owner/OwnerManagementSubNav.tsx");
const layout=read("apps/mobile/app/(app)/owner/_layout.tsx");
const dashboard=read("apps/mobile/app/(app)/dashboard.tsx");
const overview=read("apps/mobile/src/components/owner/OwnerDashboard.tsx");
const overviewRoute=read("apps/mobile/app/(app)/owner/overview.tsx");
const rootRoute=read("apps/mobile/app/(app)/owner/index.tsx");
const bookings=read("apps/mobile/app/(app)/owner/bookings.tsx");
const pending=read("apps/mobile/src/components/owner/OwnerPendingBookings.tsx");
const subscription=read("apps/mobile/app/(app)/role-subscriptions/[role].tsx");
const l10n=read("packages/localization/src/index.ts");
const pkg=JSON.parse(read("package.json"));
const must=(source,markers,context)=>{
  for(const marker of markers)assert.ok(source.includes(marker),
    "Venue Owner Phase 1 "+context+" missing "+marker);
};
must(routes,['"overview",href:"/owner/overview"','"bookings",href:"/owner/bookings"',
  '"schedule",href:"/owner/schedule"','"competitions",href:"/owner/competitions"',
  '"media",href:"/owner/posts"','"analysis",href:"/owner/analytics"',
  '"settings",href:"/owner/settings"','"/owner/manual-teams"','"/owner/promotions"',
  'return "overview";','path.startsWith(root+"/")','ownerRememberableSectionRoute',
],"7-section route mapping");
must(nav,['testID="owner-phase1-main-nav"','ownerDashboardSections.map(item=>',
  'const active=ownerSectionForPath(pathname)','accessibilityRole="tab"',
  'accessibilityState={{selected}}','flexDirection:isRTL?"row-reverse":"row"',
  'const lastUser=useRef(session?.user.id);',
  'lastRoute.current={};','ownerRememberableSectionRoute(pathname)',
  'router.replace(route)','scrollTo({x,y:0,animated})',
],"active/RTL/identity-safe navigation");
must(subnav,['testID="owner-phase1-subnav"','ownerDashboardSubsections[section]',
  'ownerSecondaryRoute(pathname)','accessibilityState={{selected}}',
  'router.replace(item.href)','scrollTo({',
],"working nested routes");
must(layout,['<AppHeader/>','<OwnerTopNav/>','<OwnerManagementSubNav/>',
  '<TimetableSubNav/>','<Slot/>','!session.user.roles.includes("VENUE_OWNER")',
  '<Redirect href="/dashboard"/>'],"persistent owner shell and role gate");
assert.equal(layout.split("<OwnerTopNav/>").length-1,1,
  "Owner nav must mount exactly once per owner layout.");
must(dashboard,['if(preferred==="VENUE_OWNER"&&roles.includes("VENUE_OWNER"))return <Redirect href="/owner/overview"/>;',
  'if(roles.includes("VENUE_OWNER"))return <Redirect href="/owner/overview"/>;',
  'if(roles.includes("REFEREE"))return <RefereeDashboard/>;',
  'if(roles.includes("PLATFORM_ADMIN"))return <Redirect href="/admin"/>;'],
  "role dashboard resolution");
must(subscription,['role === "VENUE_OWNER" ? "/owner/overview" : "/teams"'],
  "subscription dashboard CTA");
must(rootRoute,['<Redirect href="/owner/overview"/>'],"root redirect");
must(overviewRoute,['<OwnerDashboard/>'],"Overview route");
must(overview,['<Screen embedded>','useFocusEffect','const generation=useRef(0)',
  'if(request!==generation.current)return;',
  'const current=loaded?.token===token?loaded:null;',
  'testID="owner-phase1-overview"','ownerApi.pendingBookings(token)',
  'testID={`owner-phase1-shortcut-${item.key}`}',
  '/owner/bookings','/owner/schedule','/owner/competitions','/owner/analytics',
  'owner.phase1.quickAccess'],
  "Overview with real requests/status");
assert.ok(!overview.includes("<OwnerTopNav")&&!overview.includes("showHeader"),
  "Overview must not remount shared owner navigation or header.");
must(bookings,['testID="owner-phase1-bookings"','<Screen embedded>',
  'testID="owner-booking-status-filters"',
  'ownerApi.confirmBooking(token,target.booking.id)',
  'ownerApi.cancelBooking(token,target.booking.id',
  'router.push("/owner/schedule")'],
  "unified bookings search and pending decision actions");
must(pending,['ownerApi.pendingBookings(token)','ownerApi.confirmBooking(token,booking.id)',
  'ownerApi.cancelBooking(token,booking.id',
  'sequence.current++','loadedToken===token?bookings:[]'],
  "reuse of authoritative booking decisions");
for(const k of [
  "owner.dashboardNav.overview","owner.dashboardNav.bookings","owner.dashboardNav.marketing",
  "owner.dashboardSubnav.allCompetitions","owner.dashboardSubnav.offlineTeams",
  "owner.dashboardSubnav.posts","owner.dashboardSubnav.promotions",
  "owner.phase1.quickAccess","owner.phase1.bookingsSubtitle","owner.phase1.openCalendar",
])assert.equal(l10n.split('"'+k+'"').length-1,3,
  "English/Dari/Pashto missing "+k);
assert.ok(pkg.scripts["verify:owner-dashboard-phase1"]?.includes("venue-owner-dashboard-phase1.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:owner-dashboard-phase1"));
console.log("Venue Owner Dashboard Phase 1: Overview, bookings, seven sections, functional subtabs, private role boundary and translations verified.");
