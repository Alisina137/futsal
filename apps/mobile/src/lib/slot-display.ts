/** Shared compact timetable-slot display. The venue's clock is authoritative,
 * regardless of device timezone, calendar language, or system 24-hour settings.
 * A single timetable mounts many tiles: constructing a new Intl formatter for
 * every tile and every accessibility label can stall Android's JS thread. */
const formatterCache=new Map<string,Intl.DateTimeFormat>();
export function formatSlotStartTime(startsAt:string,timeZone:string):string{
  const date=new Date(startsAt);
  if(!Number.isFinite(date.getTime()))return "—";
  try{
    let formatter=formatterCache.get(timeZone);
    if(!formatter){
      formatter=new Intl.DateTimeFormat("en-US",{
        timeZone,hour:"2-digit",minute:"2-digit",hour12:true,
      });
      if(formatterCache.size>=12)formatterCache.clear();
      formatterCache.set(timeZone,formatter);
    }
    return formatter.format(date);
  }catch{return "—";}
}

/** Compact tile-only currency label (full booking totals still use AFN). */
export function formatSlotTilePrice(priceAfn:number|null|undefined):string{
  return priceAfn===null||priceAfn===undefined?"—":String(priceAfn)+" AF";
}
