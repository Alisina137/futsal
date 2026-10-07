export type TimetableCalendarView = "MONTH" | "WEEK" | "DAY";
export type TimetableCalendarLanguage = "fa-AF" | "ps-AF" | "en";

const KABUL_TIME_ZONE="Asia/Kabul";

export function todayKabul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KABUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year: year ?? 0, month: month ?? 1, day: day ?? 1 };
}

function dateAtNoon(value:string){
  return new Date(`${value}T12:00:00+04:30`);
}

export function addDays(value: string, amount: number) {
  const { year, month, day } = parts(value);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

function dayDistance(from:string,to:string){
  const a=parts(from);
  const b=parts(to);
  return Math.round((Date.UTC(b.year,b.month-1,b.day)-Date.UTC(a.year,a.month-1,a.day))/86_400_000);
}

function addGregorianMonths(value: string, amount: number) {
  const { year, month, day } = parts(value);
  const target = new Date(Date.UTC(year, month - 1 + amount, 1));
  const maxDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, maxDay));
  return target.toISOString().slice(0, 10);
}

export function usesSolarHijri(language:TimetableCalendarLanguage){
  return language!=="en";
}

function displayCalendarParts(value:string,language:TimetableCalendarLanguage){
  const calendar=usesSolarHijri(language)?"persian":"gregory";
  const formatter=new Intl.DateTimeFormat(`en-US-u-ca-${calendar}-nu-latn`,{
    timeZone:KABUL_TIME_ZONE,
    year:"numeric",
    month:"numeric",
    day:"numeric",
  });
  const values=Object.fromEntries(
    formatter.formatToParts(dateAtNoon(value))
      .filter((part)=>part.type!=="literal")
      .map((part)=>[part.type,part.value]),
  );
  return {
    year:Number(values.year),
    month:Number(values.month),
    day:Number(values.day),
  };
}

function firstOfDisplayMonth(value:string,language:TimetableCalendarLanguage){
  if(!usesSolarHijri(language)){
    const {year,month}=parts(value);
    return `${String(year).padStart(4,"0")}-${String(month).padStart(2,"0")}-01`;
  }

  let cursor=value;
  for(let attempt=0;attempt<32;attempt+=1){
    if(displayCalendarParts(cursor,language).day===1)return cursor;
    cursor=addDays(cursor,-1);
  }
  return value;
}

function nextDisplayMonthFirst(value:string,language:TimetableCalendarLanguage){
  const first=firstOfDisplayMonth(value,language);
  if(!usesSolarHijri(language))return addGregorianMonths(first,1);
  // Solar Hijri months are at most 31 days. Jump beyond the current month,
  // then walk back to day 1 of the next Solar Hijri month.
  return firstOfDisplayMonth(addDays(first,32),language);
}

function previousDisplayMonthFirst(value:string,language:TimetableCalendarLanguage){
  const first=firstOfDisplayMonth(value,language);
  if(!usesSolarHijri(language))return addGregorianMonths(first,-1);
  return firstOfDisplayMonth(addDays(first,-1),language);
}

function moveDisplayMonth(value:string,direction:-1|1,language:TimetableCalendarLanguage){
  const current=displayCalendarParts(value,language);
  const targetFirst=direction===1
    ?nextDisplayMonthFirst(value,language)
    :previousDisplayMonthFirst(value,language);
  const nextAfterTarget=nextDisplayMonthFirst(targetFirst,language);
  const targetLength=dayDistance(targetFirst,nextAfterTarget);
  return addDays(targetFirst,Math.min(current.day,targetLength)-1);
}

export function weekStartsOn(language:TimetableCalendarLanguage){
  // JS weekday convention: Sunday 0 ... Saturday 6.
  return language==="en"?1:6;
}

export function orderedWeekdays(language:TimetableCalendarLanguage){
  const first=weekStartsOn(language);
  return Array.from({length:7},(_,index)=>(first+index)%7);
}

export function startOfWeek(value: string,language:TimetableCalendarLanguage) {
  const { year, month, day } = parts(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  const first=weekStartsOn(language);
  const offset=(date.getUTCDay()-first+7)%7;
  return addDays(value,-offset);
}

export function monthGridRange(value:string,language:TimetableCalendarLanguage) {
  const first=firstOfDisplayMonth(value,language);
  const from=startOfWeek(first,language);
  return { from, to:addDays(from,41) };
}

export function rangeForView(
  view:TimetableCalendarView,
  value:string,
  language:TimetableCalendarLanguage,
) {
  if(view==="DAY")return {from:value,to:value};
  if(view==="WEEK"){
    const from=startOfWeek(value,language);
    return {from,to:addDays(from,6)};
  }
  return monthGridRange(value,language);
}

export function moveView(
  view:TimetableCalendarView,
  value:string,
  direction:-1|1,
  language:TimetableCalendarLanguage,
) {
  if(view==="DAY")return addDays(value,direction);
  if(view==="WEEK")return addDays(value,direction*7);
  return moveDisplayMonth(value,direction,language);
}

export function isSameDisplayMonth(
  value:string,
  anchor:string,
  language:TimetableCalendarLanguage,
){
  const a=displayCalendarParts(value,language);
  const b=displayCalendarParts(anchor,language);
  return a.year===b.year&&a.month===b.month;
}

export function formatCalendarDate(
  value:string,
  language:TimetableCalendarLanguage,
  options?:Intl.DateTimeFormatOptions,
) {
  const locale=language==="en"?"en-GB":language;
  return new Intl.DateTimeFormat(locale,{
    timeZone:KABUL_TIME_ZONE,
    calendar:usesSolarHijri(language)?"persian":"gregory",
    ...(options??{month:"short",day:"numeric"}),
  }).format(dateAtNoon(value));
}

export function formatCalendarTime(value:string,language:TimetableCalendarLanguage) {
  const locale=language==="en"?"en-GB":language;
  return new Intl.DateTimeFormat(locale,{
    timeZone:KABUL_TIME_ZONE,
    hour:"2-digit",
    minute:"2-digit",
    hourCycle:"h23",
  }).format(new Date(value));
}
