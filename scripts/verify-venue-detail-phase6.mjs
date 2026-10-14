import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const a=read("apps/mobile/src/components/venues/VenueDetailSections.tsx");
const b=read("apps/mobile/src/components/venues/VenueUpdatesPanel.tsx");
const c=read("apps/api/src/modules/timetable/timetable.service.ts");
const d=read("apps/api/src/modules/notifications/notification.repository.ts");
const e=read("apps/api/src/modules/booking/booking.routes.ts");
const f=read("apps/api/src/modules/notifications/notification.routes.ts");
const g=read("packages/localization/src/index.ts");
const ensure=(source,parts)=>parts.forEach(p=>assert.ok(source.includes(p),"Missing "+p));
ensure(a,['updates:["announcements","schedule","alerts"]',
  'postType=sub==="announcements"?"ANNOUNCEMENT"',
  "<VenueUpdatesPanel venue={venue}"]);
ensure(b,["venueApi.scheduleChanges(venue.id,from,to)",
  "notificationApi.venue(token,venue.id,1)",
  "notificationApi.markRead(token,notice.id)",
  "safeNotificationDeepLink(notice.deepLink)",
  "publishNotificationUnread(token,count.unreadCount)",
  "formatClock12From24Hour(period.startsAt)"]);
ensure(c,["async publicScheduleChanges(","recordForDate(timetables,item.date)","if(span<0||span>30)"]);
ensure(d,["async listVenueNotifications(","eq(notifications.userId,userId)","channel='IN_APP'",
  "notifications.data}->>'venueId'"]);
ensure(e,['router.get("/:venueId/schedule-changes"']);
ensure(f,['router.get("/venues/:venueId"']);
for(const key of ["vd.sub.updates.schedule","vd6.scheduleTitle","vd6.personalAlerts",
  "vd6.globalSettingsNote","vd6.readAndOpen"])
  assert.equal(g.split('"'+key+'"').length-1,3,"Missing EN/Dari/Pashto "+key);
console.log("Venue Detail Phase 6 verified");
