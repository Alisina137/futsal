import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const files={
 nav:"apps/mobile/src/components/owner/timetable/TimetableSubNav.tsx",
 routes:"apps/mobile/src/lib/owner-dashboard-navigation.ts",
 calendar:"apps/mobile/app/(app)/owner/schedule.tsx",
 blocks:"apps/mobile/app/(app)/owner/blocks.tsx",
 editor:"apps/mobile/app/(app)/owner/block-time.tsx",
 helper:"apps/mobile/src/lib/owner-schedule-management.ts",
 existing:"apps/mobile/app/(app)/owner/timetable/exceptions.tsx",
 weekly:"apps/mobile/app/(app)/owner/timetable/weekly.tsx",
 service:"apps/api/src/modules/timetable/timetable.service.ts",
 booking:"apps/api/src/modules/booking/booking.repository.ts",
 translations:"packages/localization/src/index.ts",
};
const src=Object.fromEntries(Object.entries(files).map(([key,p])=>[key,read(p)]));
const check=(key,items)=>items.forEach(value=>assert.ok(src[key].includes(value),key+" missing "+value));
check("nav",[
  'key:"calendar"','key:"weekly"','key:"special"','key:"blocks"',
  'href:"/owner/blocks"','pathname==="/owner/blocks"',
  'pathname.startsWith("/owner/block-time")','accessibilityState={{selected}}',
  'testID={`owner-phase4-subtab-${item.key}`}',
]);
check("routes",['inPath(path,"/owner/blocks")','inPath(path,"/owner/block-time")']);
check("calendar",[
  'testID="owner-phase4-court-filter"','testID="owner-phase4-status-filters"',
  'ownerApi.getStatus(token)','setSelectedAreaId(null)',
  'setSelectedType("ALL")','ownerApi.timetableCalendar(token,range.from,range.to,selectedAreaId)',
  'const displayedCalendar=loadedToken===token&&ownerCalendarSelectionMatches(loadedSelection,requestedSelection)?calendar:null;',
  'filteredOwnerCalendarDays(displayedCalendar?.days??[],selectedType)',
  'setLoadedSelection(requestedSelection)',
  'if(next.from!==range.from||next.to!==range.to)',
  'loadedToken===token?<SlotManager',
  'visible={pendingAction!==null&&loadedToken===token}',
  'days={visibleDays}','day={filteredSelectedDay}',
  'days={displayedCalendar.days}','Summary day={selectedDay}',
  'view!=="MONTH"','const [pendingAction,setPendingAction]',
  'setPendingAction({kind:"cancel",id})','setPendingAction({kind:"unblock",id})',
  'Modal visible={pendingAction!==null}','slotPaletteFor(event)',
  'useFocusEffect(useCallback(()=>',
]);
check("blocks",[
  'testID="owner-phase4-blocked-times"','ownerApi.timetableCalendar(token,windowStart,windowEnd,null)',
  "const WINDOW_DAYS=30","ownerBlockedEvents(result.days)",
  'testID={`owner-phase4-block-${event.id}`}',
  'setWindowStart(value=>addDays(value,-WINDOW_DAYS))',
  'setWindowStart(value=>addDays(value,WINDOW_DAYS))',
  'returnTo:"blocks"','ownerApi.deleteBlock(token,item.event.id)',
  'Modal visible={confirm!==null}','writeLock.current','if(id!==generation.current)return',
  'const visible=loadedKey===windowKey?items:[]',
  'useFocusEffect(useCallback(()=>',
]);
check("editor",[
  'validOwnerBlockInterval(date,start,end)','ownerBlockOverlaps(day.events,areaId,Date.parse(input.startsAt)',
  'ownerApi.timetableCalendar(token,date,date,areaId)',
  'ownerApi.updateBlock(token,blockId,input)','ownerApi.createBlock(token,input)',
  'returnTo=params.returnTo==="blocks"?"/owner/blocks":null',
  'if(returnTo)router.replace(returnTo)','SLOT_UNAVAILABLE',
]);
check("helper",[
  'validOwnerScheduleDate','validOwnerBlockInterval',
  'filteredOwnerCalendarDays','ownerBlockedEvents','ownerBlockOverlaps',
  'event.type==="BLOCKED"&&event.id===excludeBlockId',
]);
check("existing",['TIMETABLE_EXCEPTION_DELETE_CONFLICT','ownerApi.deleteTimetableException']);
check("weekly",['result.conflicts.length','ownerApi.publishTimetable']);
check("service",['span > 41','AREA_NOT_AVAILABLE','listOccupancies(venue.id']);
check("booking",['createBlockAtomic','updateBlockAtomic','pg_advisory_xact_lock']);
const keys=[
  "schedule.subnav.blocks","owner.phase4.blocksSubtitle","owner.phase4.dateWindow",
  "owner.phase4.addBlock","owner.phase4.noBlocks","owner.phase4.blocksLoadError",
  "owner.phase4.unblockError","owner.phase4.unblockTitle","owner.phase4.unblockConfirm",
  "owner.phase4.cancelBookingTitle","owner.phase4.cancelBookingConfirm",
  "owner.phase4.invalidInterval","owner.phase4.courtFilter","owner.phase4.allCourts",
  "owner.phase4.statusFilter","owner.phase4.allStatuses",
];
for(const key of keys)assert.equal(src.translations.split('"'+key+'"').length-1,3,
  "Must provide EN / Dari / Pashto: "+key);
const pkg=JSON.parse(read("package.json"));
assert.ok(pkg.scripts["verify:owner-dashboard-phase4"]?.includes("venue-owner-dashboard-phase4.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:owner-dashboard-phase4"));
console.log("Venue Owner Dashboard Phase 4 verified: real Schedule subtabs, court/type filters, authenticated block inventory, safe confirmation, server conflict authority, RTL translations.");
