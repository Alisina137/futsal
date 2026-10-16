/** Calendar and schedule helpers for a manager in Kabul.
 * Date comparisons are made using Kabul civil days, regardless of device time zone.
 * English weeks begin Monday; Dari/Pashto weeks begin Saturday.
 */
const DAY=86_400_000;
const KABUL="Asia/Kabul";
const civilDayFormatter=new Intl.DateTimeFormat("en-GB",{
  timeZone:KABUL,year:"numeric",month:"2-digit",day:"2-digit",
});
const solarMonthFormatter=new Intl.DateTimeFormat("en-u-ca-persian",{
  timeZone:KABUL,year:"numeric",month:"2-digit",
});
function field(parts:Intl.DateTimeFormatPart[],name:Intl.DateTimeFormatPartTypes){
  return parts.find(p=>p.type===name)?.value??"00";
}
export function kabulDay(iso:string){
  const parts=civilDayFormatter.formatToParts(new Date(iso));
  return `${field(parts,"year")}-${field(parts,"month")}-${field(parts,"day")}`;
}
export function calendarMonthKey(iso:string,language:string){
  if(language==="en")return kabulDay(iso).slice(0,7);
  const parts=solarMonthFormatter.formatToParts(new Date(iso));
  return `${field(parts,"year")}-${field(parts,"month")}`;
}
function dayAsUtcNoon(day:string){
  return new Date(day+"T12:00:00Z");
}
export function calendarWeekStart(iso:string,language:string){
  const noon=dayAsUtcNoon(kabulDay(iso));
  const first=language==="en"?1:6;
  const offset=(noon.getUTCDay()-first+7)%7;
  noon.setUTCDate(noon.getUTCDate()-offset);
  return noon.toISOString().slice(0,10);
}
export function isInCalendarPeriod(iso:string,focusIso:string,view:"DAY"|"WEEK"|"MONTH",language:string){
  if(view==="DAY")return kabulDay(iso)===kabulDay(focusIso);
  if(view==="WEEK")return calendarWeekStart(iso,language)===calendarWeekStart(focusIso,language);
  return calendarMonthKey(iso,language)===calendarMonthKey(focusIso,language);
}
export function advanceCalendarDate(iso:string,view:"DAY"|"WEEK"|"MONTH",step:number,language:string){
  const date=dayAsUtcNoon(kabulDay(iso));
  if(view==="DAY"||view==="WEEK"){
    date.setUTCDate(date.getUTCDate()+step*(view==="WEEK"?7:1));
  }else if(language==="en"){
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth()+step);
  }else{
    // Navigate across Persian-calendar month boundaries instead of adding an
    // arbitrary Gregorian month to a Solar Hijri calendar.
    const direction=step>=0?1:-1;
    for(let moved=0;moved<Math.abs(step);moved++){
      let month=calendarMonthKey(date.toISOString(),language);
      if(direction>0){
        do{date.setUTCDate(date.getUTCDate()+1);}
        while(calendarMonthKey(date.toISOString(),language)===month);
      }else{
        do{date.setUTCDate(date.getUTCDate()-1);}
        while(calendarMonthKey(date.toISOString(),language)===month);
        month=calendarMonthKey(date.toISOString(),language);
        while(true){
          const prior=new Date(date);prior.setUTCDate(prior.getUTCDate()-1);
          if(calendarMonthKey(prior.toISOString(),language)!==month)break;
          date.setUTCDate(date.getUTCDate()-1);
        }
      }
    }
  }
  return date;
}
export type ScheduleConflict={kind:"ACTIVITY"|"MATCH";title:string};
export function findScheduleConflicts(input:{startsAt:string;endsAt:string;excludeActivityId:string|null},
  activities:Array<{id:string;title:string;startsAt:string;endsAt:string}>,
  matches:Array<{opponentName:string|null;startsAt:string|null;endsAt:string|null;status:string}>):ScheduleConflict[]{
  const start=Date.parse(input.startsAt),end=Date.parse(input.endsAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return [];
  const overlap=(a:number,b:number)=>start<b&&end>a;
  const conflicts:ScheduleConflict[]=[];
  for(const activity of activities){
    if(activity.id===input.excludeActivityId)continue;
    const a=Date.parse(activity.startsAt),b=Date.parse(activity.endsAt);
    if(Number.isFinite(a)&&Number.isFinite(b)&&overlap(a,b))
      conflicts.push({kind:"ACTIVITY",title:activity.title});
  }
  for(const match of matches){
    if(["CANCELLED","COMPLETED","CORRECTED"].includes(match.status)||!match.startsAt)continue;
    const a=Date.parse(match.startsAt);
    // A missing official match end is unknown; flag the start if it lies
    // inside the proposed activity rather than inventing a match duration.
    const b=match.endsAt?Date.parse(match.endsAt):NaN;
    if(Number.isFinite(a)&&(Number.isFinite(b)?overlap(a,b):a>=start&&a<end))
      conflicts.push({kind:"MATCH",title:match.opponentName??""});
  }
  return conflicts;
}
export function unansweredPlayerCount(memberIds:string[],responseIds:string[]){
  const responded=new Set(responseIds);
  return memberIds.filter(id=>!responded.has(id)).length;
}
export function matchFilterAllows(status:string,filter:string,startsAt:string|null,today:string){
  if(filter==="ALL")return true;
  if(filter==="UPCOMING")return status==="SCHEDULED"&&!!startsAt&&Date.parse(startsAt)>Date.now();
  if(filter==="LIVE")return status==="IN_PROGRESS";
  if(filter==="FINISHED")return ["COMPLETED","CORRECTED"].includes(status);
  if(filter==="POSTPONED")return status==="POSTPONED";
  if(filter==="CANCELLED")return status==="CANCELLED";
  if(filter==="TODAY")return !!startsAt&&kabulDay(startsAt)===today;
  return false;
}
