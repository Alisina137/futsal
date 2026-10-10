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
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(localeByLanguage[language], {
    calendar: "gregory",
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
}


/** User-facing calendar date and clock time with Kabul wall time, no GMT offset,
 * timezone abbreviation or seconds. Use in public competition About. */
export function formatCompetitionDateTime(value:string|Date,language:LanguageCode):string{
  const date=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(date.getTime()))return String(value);
  const locale=localeByLanguage[language];
  const options={timeZone:AFGHANISTAN_TIME_ZONE,calendar:"gregory"} as const;
  const day=new Intl.DateTimeFormat(locale,{
    ...options,year:"numeric",month:"short",day:"numeric",
  }).format(date);
  const time=new Intl.DateTimeFormat(locale,{
    ...options,hour:"numeric",minute:"2-digit",
  }).format(date);
  return `${day} · ${time}`;
}

export function formatLocalDateTimeParts(
  value: string | Date,
  language: LanguageCode,
  timeZone: string = AFGHANISTAN_TIME_ZONE,
) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return { date: String(value), time: "" };
  }

  const locale = localeByLanguage[language];

  return {
    date: new Intl.DateTimeFormat(locale, {
      calendar: "gregory",
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(date),
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
