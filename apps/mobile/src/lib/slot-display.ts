/** Shared compact timetable-slot display. The venue's clock is authoritative,
 * regardless of device timezone, calendar language, or system 24-hour settings. */
export function formatSlotStartTime(startsAt:string,timeZone:string):string{
  const date=new Date(startsAt);
  if(!Number.isFinite(date.getTime()))return "—";
  try{
    return new Intl.DateTimeFormat("en-US",{
      timeZone,hour:"numeric",minute:"2-digit",hour12:true,
    }).format(date);
  }catch{return "—";}
}

/** Compact tile-only currency label (full booking totals still use AFN). */
export function formatSlotTilePrice(priceAfn:number|null|undefined):string{
  return priceAfn===null||priceAfn===undefined?"—":String(priceAfn)+" AF";
}
