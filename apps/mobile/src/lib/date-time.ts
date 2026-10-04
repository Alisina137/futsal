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
