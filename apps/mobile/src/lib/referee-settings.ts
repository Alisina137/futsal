import type {LanguageCode} from "@leaguekick/localization";
import type {RefereeProfile} from "./api";
import {refereeCalendarMonthKey,refereeShiftDay,refereeWeekStart} from "./referee-calendar.ts";

const validDate=(day:string)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
  const parsed=new Date(day+"T12:00:00Z");
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===day;
};
export type RefereeSettingsIssue="years"|"weeklyRange"|"duplicateDay"|"date"|"duplicateDate"|"limit"|null;

/** Keep a strict and deterministic draft shape; never turn invalid inputs into valid values silently. */
export function normalizeRefereeSettings(profile:RefereeProfile):RefereeProfile{
  return {...profile,acceptingAssignments:profile.acceptingAssignments!==false,
    level:profile.level?.trim()||null,biography:profile.biography?.trim()||null,
    weeklyAvailability:[...profile.weeklyAvailability].sort((a,b)=>a.day-b.day),
    exceptions:[...profile.exceptions].sort((a,b)=>a.date.localeCompare(b.date))};
}
export function refereeSettingsIssue(profile:RefereeProfile):RefereeSettingsIssue{
  if(!Number.isInteger(profile.experienceYears)||profile.experienceYears<0||
     profile.experienceYears>70||(profile.level?.length??0)>60||
     (profile.biography?.length??0)>500)return "years";
  if(typeof profile.acceptingAssignments!=="boolean"||
     profile.weeklyAvailability.length>7||profile.exceptions.length>100)return "limit";
  const days=new Set<number>();
  for(const slot of profile.weeklyAvailability){
    if(!Number.isInteger(slot.day)||slot.day<0||slot.day>6||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.start)||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.end)||
      slot.start>=slot.end)return "weeklyRange";
    if(days.has(slot.day))return "duplicateDay";
    days.add(slot.day);
  }
  const dates=new Set<string>();
  for(const exception of profile.exceptions){
    if(!validDate(exception.date)||typeof exception.available!=="boolean")return "date";
    if(dates.has(exception.date))return "duplicateDate";
    dates.add(exception.date);
  }
  return null;
}
export function refereeSettingsChanged(saved:RefereeProfile,draft:RefereeProfile){
  return JSON.stringify(normalizeRefereeSettings(saved))!==
    JSON.stringify(normalizeRefereeSettings(draft));
}

/** Solar/Gregorian month cells are canonical ISO dates and never converted in the API. */
export function refereeExceptionMonth(anchorDay:string,language:LanguageCode){
  const key=refereeCalendarMonthKey(anchorDay,language);
  if(!key)return {cells:[],monthKey:""};
  let first=anchorDay;
  for(let i=0;i<32;i++){
    const before=refereeShiftDay(first,-1);
    if(refereeCalendarMonthKey(before,language)!==key)break;
    first=before;
  }
  let last=first;
  for(let i=0;i<32;i++){
    const after=refereeShiftDay(last,1);
    if(refereeCalendarMonthKey(after,language)!==key)break;
    last=after;
  }
  const firstGridDay=refereeWeekStart(first,language);
  return {monthKey:key,cells:Array.from({length:42},(_,index)=>{
    const date=refereeShiftDay(firstGridDay,index);
    return {date,inMonth:date>=first&&date<=last};
  })};
}
