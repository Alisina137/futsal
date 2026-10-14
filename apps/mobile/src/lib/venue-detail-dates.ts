/** Pure calendar-day helpers used by a venue's booking-date input and shortcuts.
 * Return Gregorian YYYY-MM-DD, never a UTC timestamp presented as a local day. */
export function venueDayKey(timeZone:string,now:Date=new Date()):string{
  let formatter:Intl.DateTimeFormat;
  try{
    formatter=new Intl.DateTimeFormat("en-GB",{
      timeZone,calendar:"gregory",year:"numeric",month:"2-digit",day:"2-digit",
    });
  }catch{
    formatter=new Intl.DateTimeFormat("en-GB",{
      timeZone:"Asia/Kabul",calendar:"gregory",
      year:"numeric",month:"2-digit",day:"2-digit",
    });
  }
  const parts=Object.fromEntries(formatter.formatToParts(now).map(part=>[part.type,part.value]));
  return parts.year+"-"+parts.month+"-"+parts.day;
}

/** Reject invalid calendar dates rather than letting Date.parse normalize them. */
export function isValidVenueDay(day:string):boolean{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
  const value=new Date(day+"T12:00:00.000Z");
  return Number.isFinite(value.getTime())&&value.toISOString().slice(0,10)===day;
}
export function isVenueBookingDay(day:string,today:string,advanceDays:number):boolean{
  if(!isValidVenueDay(day)||!isValidVenueDay(today)||
      !Number.isInteger(advanceDays)||advanceDays<0)return false;
  const offset=(Date.parse(day+"T12:00:00Z")-Date.parse(today+"T12:00:00Z"))/86400000;
  return Number.isInteger(offset)&&offset>=0&&offset<=advanceDays;
}
