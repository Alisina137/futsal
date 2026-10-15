/** UI tab intent and safe date-filter validation, independent of device TZ. */
export const ownerBookingTabs=["PENDING","UPCOMING","ALL","HISTORY"] as const;
export type OwnerBookingTab=(typeof ownerBookingTabs)[number];

export function ownerBookingScope(tab:OwnerBookingTab):"UPCOMING"|"ALL"|"HISTORY"|null{
  if(tab==="PENDING")return null;
  return tab==="UPCOMING"?"UPCOMING":tab==="HISTORY"?"HISTORY":"ALL";
}
export function validBookingDay(value:string):boolean{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+"T00:00:00.000Z");
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function ownerBookingDateFilter(from:string,to:string):{
  valid:boolean;from?:string;to?:string;
}{
  const a=from.trim(),b=to.trim();
  if((a&&!validBookingDay(a))||(b&&!validBookingDay(b))||(a&&b&&a>b))return{valid:false};
  return{valid:true,...(a?{from:a}:{}),...(b?{to:b}:{})};
}
