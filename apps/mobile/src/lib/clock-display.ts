/**
 * One visible clock convention for the entire mobile app:
 * two-digit 12-hour clock with an explicit English AM/PM marker.
 *
 * Keep backend 24-hour slot identifiers and ISO UTC payloads unchanged.
 * All timestamps are formatted in the venue's IANA zone (Kabul default),
 * never with a visible GMT/UTC offset. Cache formatters for dense timetables.
 */
export const DEFAULT_APP_TIME_ZONE="Asia/Kabul";
const clocks=new Map<string,Intl.DateTimeFormat>();
function formatter(timeZone:string){
  const zone=timeZone||DEFAULT_APP_TIME_ZONE;
  const cached=clocks.get(zone);
  if(cached)return cached;
  let value:Intl.DateTimeFormat;
  try{
    value=new Intl.DateTimeFormat("en-US",{
      timeZone:zone,hour:"2-digit",minute:"2-digit",hour12:true,
    });
  }catch{
    if(zone!==DEFAULT_APP_TIME_ZONE)return formatter(DEFAULT_APP_TIME_ZONE);
    throw Error("Unable to format Afghanistan clock.");
  }
  if(clocks.size>20)clocks.clear();
  clocks.set(zone,value);
  return value;
}
export function formatAppClock(
  instant:string|Date|null|undefined,
  timeZone:string=DEFAULT_APP_TIME_ZONE,
):string{
  if(!instant)return "—";
  const date=instant instanceof Date?instant:new Date(instant);
  if(!Number.isFinite(date.getTime()))return "—";
  // Replace any narrow no-break spaces used by different Intl engines.
  return formatter(timeZone).format(date).replace(/[\u00a0\u202f]/g," ");
}
/** Strictly a PRESENTATION helper for 24-hour HH:mm strings, not stored values. */
export function formatClock12From24Hour(value:string):string{
  const match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if(!match)return value;
  const hour=Number(match[1]);
  return String((hour%12)||12).padStart(2,"0")+":"+match[2]+" "+(hour<12?"AM":"PM");
}
