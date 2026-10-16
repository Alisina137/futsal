/** Owner booking search uses one filter bar; no redundant section tabs. */
export const ownerBookingStatusOptions=["ALL","PENDING","CONFIRMED","HISTORY","CANCELLED"] as const;
export type OwnerBookingStatusFilter=(typeof ownerBookingStatusOptions)[number];

/** Confirmed shows current/future bookings; History contains expired confirmed
 * bookings. All and Pending/Cancelled remain searchable without date bias. */
export function ownerBookingStatusScope(status:OwnerBookingStatusFilter):"ALL"|"ACTIVE"|"HISTORY"{
  if(status==="CONFIRMED")return "ACTIVE";
  if(status==="HISTORY")return "HISTORY";
  return "ALL";
}
export const ownerBookingStatusThemes={
  ALL:{background:"#EAF1FF",border:"#BDD2FF",text:"#1D4ED8"},
  PENDING:{background:"#FFFBEB",border:"#FCD34D",text:"#92400E"},
  CONFIRMED:{background:"#E8F7EF",border:"#86D2A4",text:"#146B39"},
  HISTORY:{background:"#F1F5F9",border:"#CBD5E1",text:"#475569"},
  CANCELLED:{background:"#FEF2F2",border:"#FCA5A5",text:"#B91C1C"},
} as const;

/** Validation remains a server-compatible Gregorian ISO calendar day.
 * DatePicker renders Persian date labels when applicable, but returns ISO. */
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
