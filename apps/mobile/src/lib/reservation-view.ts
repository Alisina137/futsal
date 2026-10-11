import type {BookingDto} from "@leaguekick/contracts";

export type ReservationGroup="ALL"|"UPCOMING"|"PENDING"|"COMPLETED"|"CANCELLED";
export const reservationGroups:readonly ReservationGroup[]=[
  "ALL","UPCOMING","PENDING","COMPLETED","CANCELLED",
];

export function reservationGroup(item:BookingDto,nowMs=Date.now()):Exclude<ReservationGroup,"ALL">{
  if(item.status==="CANCELLED")return "CANCELLED";
  if(item.status==="PENDING")return "PENDING";
  return Date.parse(item.endsAt)<=nowMs?"COMPLETED":"UPCOMING";
}

export function reservationCounts(items:readonly BookingDto[],nowMs=Date.now()){
  const counts:Record<ReservationGroup,number>={
    ALL:items.length,UPCOMING:0,PENDING:0,COMPLETED:0,CANCELLED:0,
  };
  for(const item of items)counts[reservationGroup(item,nowMs)]++;
  return counts;
}

export function displayReservations(items:readonly BookingDto[],group:ReservationGroup,nowMs=Date.now()):BookingDto[]{
  const priority:Record<Exclude<ReservationGroup,"ALL">,number>={
    UPCOMING:0,PENDING:1,COMPLETED:2,CANCELLED:3,
  };
  return items.filter(item=>group==="ALL"||reservationGroup(item,nowMs)===group)
    .sort((a,b)=>{
      const aGroup=reservationGroup(a,nowMs),bGroup=reservationGroup(b,nowMs);
      if(group==="ALL"&&priority[aGroup]!==priority[bGroup])return priority[aGroup]-priority[bGroup];
      const aTime=Date.parse(a.startsAt),bTime=Date.parse(b.startsAt);
      const aDirection=aGroup==="UPCOMING"||aGroup==="PENDING"?1:-1;
      return aDirection*(aTime-bTime);
    });
}

export function reservationDateKey(startsAt:string):string{
  const date=new Date(startsAt);
  if(!Number.isFinite(date.getTime()))return "";
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Asia/Kabul",year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(date);
  const lookup=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return [lookup.year,lookup.month,lookup.day].join("-");
}
