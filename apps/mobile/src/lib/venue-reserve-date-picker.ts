import {addDays,isSameDisplayMonth,monthGridRange,moveView,
  type TimetableCalendarLanguage} from "./timetable-calendar";
import {isVenueBookingDay} from "./venue-detail-dates";

export type VenuePickerDay={
  date:string;
  currentMonth:boolean;
  enabled:boolean;
};

/** A pure, local-calendar month matrix. Stored/returned dates remain
 * Gregorian YYYY-MM-DD for the venue availability API. */
export function venuePickerMonthDays(
  anchor:string,today:string,advanceDays:number,language:TimetableCalendarLanguage,
):VenuePickerDay[]{
  const {from}=monthGridRange(anchor,language);
  return Array.from({length:42},(_,index)=>{
    const date=addDays(from,index);
    return {
      date,
      currentMonth:isSameDisplayMonth(date,anchor,language),
      enabled:isVenueBookingDay(date,today,advanceDays),
    };
  });
}

/** Disable navigation only when a whole adjacent month has no bookable day.
 * Using the same-day month cursor alone would hide an available month end. */
export function venuePickerCanMoveMonth(
  anchor:string,direction:-1|1,today:string,advanceDays:number,
  language:TimetableCalendarLanguage,
):boolean{
  const target=moveView("MONTH",anchor,direction,language);
  return venuePickerMonthDays(target,today,advanceDays,language)
    .some(day=>day.currentMonth&&day.enabled);
}
