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
 * Post timestamps express elapsed time since publication, not the absolute
 * date/time. Uses device clock (rather than any fixed time zone) and Intl so
 * numbers and units follow the active English, Dari or Pashto app language.
 * Never show a future "in X" label when clocks differ slightly.
 */
export function formatPostTimeAgo(
  publishedAt:string|Date,
  language:LanguageCode,
  nowMs:number=Date.now(),
):string{
  const published=publishedAt instanceof Date?publishedAt:new Date(publishedAt);
  const value=published.getTime();
  if(!Number.isFinite(value))return String(publishedAt);
  const seconds=Math.max(0,Math.floor((nowMs-value)/1000));
  const locale=localeByLanguage[language];
  const formatter=new Intl.RelativeTimeFormat(locale,{numeric:"always",style:"long"});
  if(seconds<60)return new Intl.RelativeTimeFormat(locale,{numeric:"auto"}).format(0,"second");
  if(seconds<3600)return formatter.format(-Math.floor(seconds/60),"minute");
  if(seconds<86400)return formatter.format(-Math.floor(seconds/3600),"hour");
  if(seconds<604800)return formatter.format(-Math.floor(seconds/86400),"day");
  if(seconds<2592000)return formatter.format(-Math.floor(seconds/604800),"week");
  if(seconds<31536000)return formatter.format(-Math.floor(seconds/2592000),"month");
  return formatter.format(-Math.floor(seconds/31536000),"year");
}
