/** Client-side boundaries for venue-owner historical analytics requests.
 * Server permissions and date-range validation remain authoritative. */
export type OwnerAnalyticsRangeError="INVALID"|"INVERTED"|"FUTURE"|"TOO_LONG";

function dateMs(value:string):number|null{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const parsed=Date.parse(value+"T00:00:00.000Z");
  if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==value)return null;
  return parsed;
}

/** Inclusive from/to, limited to 366 calendar days ending no later than today. */
export function validateOwnerAnalyticsRange(
  from:string,to:string,today:string,
):OwnerAnalyticsRangeError|null{
  const first=dateMs(from),last=dateMs(to),end=dateMs(today);
  if(first===null||last===null||end===null)return "INVALID";
  if(last<first)return "INVERTED";
  if(last>end)return "FUTURE";
  if((last-first)/86_400_000>365)return "TOO_LONG";
  return null;
}
