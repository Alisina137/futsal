export type TimetableCalendarView = "MONTH" | "WEEK" | "DAY";

export function todayKabul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kabul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year: year ?? 0, month: month ?? 1, day: day ?? 1 };
}

export function addDays(value: string, amount: number) {
  const { year, month, day } = parts(value);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

export function addMonths(value: string, amount: number) {
  const { year, month, day } = parts(value);
  const target = new Date(Date.UTC(year, month - 1 + amount, 1));
  const maxDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, maxDay));
  return target.toISOString().slice(0, 10);
}

export function startOfWeek(value: string) {
  const { year, month, day } = parts(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return addDays(value, -mondayOffset);
}

export function monthGridRange(value: string) {
  const { year, month } = parts(value);
  const first = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  const from = startOfWeek(first);
  return { from, to: addDays(from, 41) };
}

export function rangeForView(view: TimetableCalendarView, value: string) {
  if (view === "DAY") return { from: value, to: value };
  if (view === "WEEK") {
    const from = startOfWeek(value);
    return { from, to: addDays(from, 6) };
  }
  return monthGridRange(value);
}

export function moveView(view: TimetableCalendarView, value: string, direction: -1 | 1) {
  if (view === "DAY") return addDays(value, direction);
  if (view === "WEEK") return addDays(value, direction * 7);
  return addMonths(value, direction);
}

export function formatCalendarDate(value: string, language: "fa-AF" | "ps-AF" | "en", options?: Intl.DateTimeFormatOptions) {
  const locale = language === "en" ? "en-GB" : language;
  const instant = new Date(`${value}T12:00:00+04:30`);
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Kabul",
    calendar: "gregory",
    ...(options ?? { month: "short", day: "numeric" }),
  }).format(instant);
}

export function formatCalendarTime(value: string, language: "fa-AF" | "ps-AF" | "en") {
  const locale = language === "en" ? "en-GB" : language;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Kabul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
