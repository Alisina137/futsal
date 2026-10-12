import type {AvailabilitySlotDto,PublicVenueDto} from "@leaguekick/contracts";
import {formatAppClock} from "./clock-display";

export function localVenueDate(date:Date=new Date()){
  const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kabul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const values=Object.fromEntries(p.map(part=>[part.type,part.value]));
  return values.year+"-"+values.month+"-"+values.day;
}
export function addVenueDays(date:string,days:number){
  const start=Date.parse(date+"T12:00:00Z");
  return new Date(start+days*86400000).toISOString().slice(0,10);
}
export function venueDateLabel(date:string,locale="en-GB"){
  return new Intl.DateTimeFormat(locale,{timeZone:"UTC",weekday:"short",day:"numeric",month:"short",year:"numeric"})
    .format(new Date(date+"T12:00:00Z"));
}
export function venueSlotLabel(slot:AvailabilitySlotDto,venue:PublicVenueDto){
  return formatAppClock(slot.startsAt,venue.timezone);
}
export function venueDistanceKm(a:{latitude:number;longitude:number},
  b:{latitude:number|null;longitude:number|null}){
  if(b.latitude===null||b.longitude===null)return null;
  const rad=(n:number)=>n*Math.PI/180;
  const deltaLat=rad(b.latitude-a.latitude),deltaLon=rad(b.longitude-a.longitude);
  const h=Math.sin(deltaLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(deltaLon/2)**2;
  return 6371.0088*2*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));
}