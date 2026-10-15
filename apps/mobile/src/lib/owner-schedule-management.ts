import type {VenueCalendarDay,VenueCalendarEvent,VenueCalendarEventType} from "@leaguekick/contracts";

/** These are venue-local Gregorian calendar keys, not device/UTC dates. */
export function validOwnerScheduleDate(value:string):boolean{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+"T00:00:00.000Z");
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function validOwnerBlockInterval(date:string,start:string,end:string):boolean{
  return validOwnerScheduleDate(date)
    &&/^([01]\d|2[0-3]):[0-5]\d$/.test(start)
    &&/^([01]\d|2[0-3]):[0-5]\d$/.test(end)
    &&start<end;
}
export function filteredOwnerCalendarDays(
  days:readonly VenueCalendarDay[],type:"ALL"|VenueCalendarEventType,
):VenueCalendarDay[]{
  if(type==="ALL")return [...days];
  // Keep all the authoritative server aggregates unchanged, because filters
  // are only applied in Day/Week, never in Month or financial summary cards.
  return days.map(day=>({...day,events:day.events.filter(event=>event.type===type)}));
}
export function ownerBlockedEvents(days:readonly VenueCalendarDay[]){
  return days.flatMap(day=>day.events
    .filter(event=>event.type==="BLOCKED"&&event.startsAt&&event.endsAt)
    .map(event=>({day:day.date,event})))
    .sort((a,b)=>a.event.startsAt!.localeCompare(b.event.startsAt!));
}
export function ownerBlockOverlaps(
  events:readonly VenueCalendarEvent[],areaId:string,startMs:number,endMs:number,
  excludeBlockId?:string|null,
):boolean{
  // Preflight only; the backend rechecks all writes atomically.
  return events.some(event=>{
    if(event.type!=="ONLINE_BOOKING"&&event.type!=="MANUAL_BOOKING"
      &&event.type!=="COMPETITION"&&event.type!=="BLOCKED")return false;
    if(event.type==="BLOCKED"&&event.id===excludeBlockId)return false;
    if(event.areaId!==null&&event.areaId!==areaId)return false;
    if(!event.startsAt||!event.endsAt)return false;
    return Date.parse(event.startsAt)<endMs&&Date.parse(event.endsAt)>startMs;
  });
}
