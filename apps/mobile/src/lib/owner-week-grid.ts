import type {VenueCalendarDay} from "@leaguekick/contracts";

/** The venue calendar uses Kabul civil time. Sharing a single formatter keeps
 * large seven-day grids responsive on Android: Intl.DateTimeFormat construction
 * is expensive when repeated per event, row and date. */
const clockFormatter=new Intl.DateTimeFormat("en-GB",{
  timeZone:"Asia/Kabul",hour:"2-digit",minute:"2-digit",hourCycle:"h23",
});
export function ownerCalendarClock(value:string):string{
  return clockFormatter.format(new Date(value));
}

export type MissingWeekCellKind="CLOSED"|"CONTINUES"|"UNSCHEDULED";

/** The weekly matrix uses the union of start times across different weekdays.
 * A blank start cell may be closed, covered by an ongoing interval, or simply
 * not scheduled. None of these is a bookable or independently editable slot.
 * Keep these statuses explicit rather than generating fake events. */
export function missingWeekCellKind(
  day:Pick<VenueCalendarDay,"closed"|"events">,
  localStartTime:string,
):MissingWeekCellKind{
  if(day.closed)return "CLOSED";
  return day.events.some(event=>
    Boolean(event.startsAt&&event.endsAt)&&
    ownerCalendarClock(event.startsAt!)<localStartTime&&
    ownerCalendarClock(event.endsAt!)>localStartTime
  )?"CONTINUES":"UNSCHEDULED";
}
