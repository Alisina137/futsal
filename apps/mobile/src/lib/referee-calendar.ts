import type {LanguageCode} from "@leaguekick/localization";
import type {RefereeMatch,RefereeProfile} from "./api";
import {careerMonthShift,careerPeriod} from "./player-career-view";

export type RefereeCalendarMode="day"|"week"|"month";
export type RefereeAvailabilityPreview="AVAILABLE"|"UNAVAILABLE"|"MISSING_SCHEDULE";

/** Canonical calendar cursors are Gregorian ISO days in the Asia/Kabul time zone.
 * Only their presentation and calendar-period comparison are Solar Hijri for RTL.
 * Match/API timestamps are always left unchanged.
 */
export function refereeKabulDay(value:string|Date):string|null{
  const date=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(date.getTime()))return null;
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Asia/Kabul",calendar:"gregory",numberingSystem:"latn",
    year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(date);
  const part=(type:string)=>parts.find(p=>p.type===type)?.value??"";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function isoDay(date:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
  const parsed=new Date(date+"T12:00:00Z");
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?
    parsed:null;
}
export function refereeShiftDay(day:string,offset:number):string{
  const date=isoDay(day);
  if(!date||!Number.isInteger(offset)||Math.abs(offset)>3660)return day;
  date.setUTCDate(date.getUTCDate()+offset);
  return date.toISOString().slice(0,10);
}
export function refereeWeekStart(day:string,language:LanguageCode){
  const date=isoDay(day);
  if(!date)return day;
  const offset=language==="en"?(date.getUTCDay()+6)%7:(date.getUTCDay()+1)%7;
  return refereeShiftDay(day,-offset);
}
export function refereeCalendarMonthKey(day:string,language:LanguageCode){
  if(!isoDay(day))return null;
  return careerPeriod(day+"T12:00:00Z",language).key;
}
export function refereeCalendarIncludes(
  value:string|Date,anchorDay:string,mode:RefereeCalendarMode,language:LanguageCode,
){
  const matchDay=refereeKabulDay(value);
  if(!matchDay||!isoDay(anchorDay))return false;
  if(mode==="day")return matchDay===anchorDay;
  if(mode==="week")return refereeWeekStart(matchDay,language)===refereeWeekStart(anchorDay,language);
  return refereeCalendarMonthKey(matchDay,language)===refereeCalendarMonthKey(anchorDay,language);
}
/** Clamp Gregorian month ends; Persian months are computed from calendar periods. */
export function refereeCalendarMove(
  anchorDay:string,mode:RefereeCalendarMode,direction:number,language:LanguageCode,
){
  const date=isoDay(anchorDay);
  if(!date||!Number.isInteger(direction)||Math.abs(direction)>24)return anchorDay;
  if(mode==="day")return refereeShiftDay(anchorDay,direction);
  if(mode==="week")return refereeShiftDay(anchorDay,direction*7);
  if(language!=="en")return careerMonthShift(anchorDay,direction);
  const ordinal=date.getUTCDate();
  // Construct the first day of the target month before clamping the ordinal.
  const first=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+direction,1,12));
  const lastDay=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0,12)).getUTCDate();
  first.setUTCDate(Math.min(ordinal,lastDay));
  return first.toISOString().slice(0,10);
}
export function refereeCalendarWeekDays(day:string,language:LanguageCode){
  const start=refereeWeekStart(day,language);
  return Array.from({length:7},(_,index)=>refereeShiftDay(start,index));
}
/** Informational availability preview mirrors server rules; response API remains authoritative.
 * The empty schedule currently means unrestricted availability (legacy behavior);
 * an explicit pause/unavailable toggle is a separate Settings migration.
 */
export function refereeAvailabilityPreview(
  match:Pick<RefereeMatch,"startsAt"|"endsAt">,
  profile:Pick<RefereeProfile,"weeklyAvailability"|"exceptions">,
):RefereeAvailabilityPreview{
  if(!match.startsAt||!match.endsAt)return "MISSING_SCHEDULE";
  const start=new Date(match.startsAt),end=new Date(match.endsAt);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||
    end.getTime()<=start.getTime())return "MISSING_SCHEDULE";
  const day=refereeKabulDay(start);
  if(!day||day!==refereeKabulDay(end))return "UNAVAILABLE";
  const exception=profile.exceptions.find(item=>item.date===day);
  if(exception?.available===false)return "UNAVAILABLE";
  if(exception?.available===true)return "AVAILABLE";
  if(profile.weeklyAvailability.length===0)return "AVAILABLE";
  const timeParts=(value:Date)=>{
    const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kabul",
      hour:"2-digit",minute:"2-digit",hourCycle:"h23",numberingSystem:"latn"})
      .formatToParts(value);
    const field=(type:string)=>p.find(x=>x.type===type)?.value??"00";
    return field("hour")+":"+field("minute");
  };
  const weekday=isoDay(day)!.getUTCDay();
  const begin=timeParts(start),finish=timeParts(end);
  return profile.weeklyAvailability.some(slot=>
    slot.day===weekday&&slot.start<=begin&&slot.end>=finish)?"AVAILABLE":"UNAVAILABLE";
}
