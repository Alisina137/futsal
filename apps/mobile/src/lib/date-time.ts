import type { LanguageCode } from "@leaguekick/localization";

const localeByLanguage: Record<LanguageCode, string> = {
  "fa-AF": "fa-AF",
  "ps-AF": "ps-AF",
  en: "en-GB",
};

export const AFGHANISTAN_TIME_ZONE = "Asia/Kabul";

export function formatLocalDateTime(
  value: string | Date,
  language: LanguageCode,
  timeZone: string = AFGHANISTAN_TIME_ZONE,
) {
  const parts=formatLocalDateTimeParts(value,language,timeZone);
  return parts.time?parts.date+" · "+parts.time:parts.date;
}

/** Public competition About: date and AM/PM time; no seconds or offset. */
export function formatCompetitionDateTime(value:string|Date,language:LanguageCode):string{
  return formatLocalDateTime(value,language);
}

/** Timezone-correct date and explicit 12-hour English AM/PM clock. */
function clock(value:Date,timeZone:string):string{
  let zone=timeZone||AFGHANISTAN_TIME_ZONE;
  try{
    return new Intl.DateTimeFormat("en-US",{
      timeZone:zone,hour:"2-digit",minute:"2-digit",hour12:true,
    }).format(value).replace(/[\u00a0\u202f]/g," ");
  }catch{
    zone=AFGHANISTAN_TIME_ZONE;
    return new Intl.DateTimeFormat("en-US",{
      timeZone:zone,hour:"2-digit",minute:"2-digit",hour12:true,
    }).format(value).replace(/[\u00a0\u202f]/g," ");
  }
}

/** Separate calendar date and clock; referee schedules include weekday. */
export function formatRefereeScheduleParts(value:string|Date,language:LanguageCode){
  const date=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(date.getTime()))return {date:String(value),time:""};
  return {
    date:new Intl.DateTimeFormat(localeByLanguage[language],{
      timeZone:AFGHANISTAN_TIME_ZONE,calendar:"gregory",
      weekday:"short",year:"numeric",month:"long",day:"numeric",
    }).format(date),
    time:clock(date,AFGHANISTAN_TIME_ZONE),
  };
}
/** The calendar shows its selected Kabul-local period, not an arbitrary anchor time. */
export function formatRefereeCalendarPeriod(value:Date,mode:"day"|"week"|"month",language:LanguageCode){
 const locale=localeByLanguage[language];
 const zone={timeZone:AFGHANISTAN_TIME_ZONE,calendar:"gregory"} as const;
 const parts=new Intl.DateTimeFormat("en-GB",{...zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(value);
 const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 const y=Number(v.year),m=Number(v.month),d=Number(v.day);
 const localDay=(offset:number)=>new Date(Date.UTC(y,m-1,d+offset,12));
 if(mode==="day")return new Intl.DateTimeFormat(locale,{
   ...zone,weekday:"long",day:"numeric",month:"long",year:"numeric",
 }).format(localDay(0));
 if(mode==="month")return new Intl.DateTimeFormat(locale,{
   ...zone,month:"long",year:"numeric",
 }).format(localDay(0));
 const monday=-((new Date(Date.UTC(y,m-1,d)).getUTCDay()+6)%7);
 const start=new Intl.DateTimeFormat(locale,{...zone,day:"numeric",month:"short"}).format(localDay(monday));
 const end=new Intl.DateTimeFormat(locale,{...zone,day:"numeric",month:"short",year:"numeric"}).format(localDay(monday+6));
 return start+" – "+end;
}

export function formatLocalDateTimeParts(
  value: string | Date,
  language: LanguageCode,
  timeZone: string = AFGHANISTAN_TIME_ZONE,
) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime()))return {date:String(value),time:""};
  let zone=timeZone||AFGHANISTAN_TIME_ZONE;
  try{new Intl.DateTimeFormat("en-US",{timeZone:zone}).format(date);}
  catch{zone=AFGHANISTAN_TIME_ZONE;}
  return {
    date:new Intl.DateTimeFormat(localeByLanguage[language],{
      calendar:"gregory",timeZone:zone,
      year:"numeric",month:"short",day:"numeric",
    }).format(date),
    time:clock(date,zone),
  };
}


/**
 * Relative publication times without Intl.RelativeTimeFormat.
 *
 * Android Hermes/Expo Go may not provide this constructor, even when
 * Intl.DateTimeFormat is available. Keep this function safe on those devices
 * and use app-language-specific units (including Dari/Pashto numerals).
 */
type RelativeUnit="minute"|"hour"|"day"|"week"|"month"|"year";

const postTimeUnits:Record<LanguageCode,Record<RelativeUnit,string>>={
  en:{minute:"minute",hour:"hour",day:"day",week:"week",month:"month",year:"year"},
  "fa-AF":{minute:"دقیقه",hour:"ساعت",day:"روز",week:"هفته",month:"ماه",year:"سال"},
  "ps-AF":{minute:"دقیقه",hour:"ساعت",day:"ورځ",week:"اونۍ",month:"میاشت",year:"کال"},
};

function localizedDuration(value:number,unit:RelativeUnit,language:LanguageCode):string{
  if(language==="en"){
    const unitName=postTimeUnits.en[unit];
    return `${value} ${unitName}${value===1?"":"s"} ago`;
  }
  // Avoid reliance on Intl.NumberFormat for lightweight Hermes builds as well.
  const nativeDigits="۰۱۲۳۴۵۶۷۸۹";
  const count=String(value).replace(/[0-9]/g,digit=>nativeDigits[Number(digit)]!);
  const word=postTimeUnits[language][unit];
  const psPlural:Partial<Record<RelativeUnit,string>>={
    day:"ورځې",week:"اونۍ",month:"میاشتې",year:"کاله",hour:"ساعته",minute:"دقیقې",
  };
  return language==="ps-AF"
    ? `${count} ${value===1?word:psPlural[unit]??word} مخکې`
    : `${count} ${word} پیش`;
}

export function formatPostTimeAgo(
  publishedAt:string|Date,
  language:LanguageCode,
  nowMs:number=Date.now(),
):string{
  const published=publishedAt instanceof Date?publishedAt:new Date(publishedAt);
  const value=published.getTime();
  if(!Number.isFinite(value))return String(publishedAt);
  const seconds=Math.max(0,Math.floor((nowMs-value)/1000));
  if(seconds<60)return language==="fa-AF"?"همین حالا":language==="ps-AF"?"همدا اوس":"now";
  if(seconds<3600)return localizedDuration(Math.floor(seconds/60),"minute",language);
  if(seconds<86400)return localizedDuration(Math.floor(seconds/3600),"hour",language);
  if(seconds<604800)return localizedDuration(Math.floor(seconds/86400),"day",language);
  if(seconds<2592000)return localizedDuration(Math.floor(seconds/604800),"week",language);
  if(seconds<31536000)return localizedDuration(Math.floor(seconds/2592000),"month",language);
  return localizedDuration(Math.floor(seconds/31536000),"year",language);
}
