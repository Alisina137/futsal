import type {AvailabilitySlotDto,PublicVenueDto,VenueDirectoryFilters,VenueDirectoryResult} from "@leaguekick/contracts";

const rad=(n:number)=>n*Math.PI/180;
function kilometers(a:number,b:number,c:number,d:number){
  const x=Math.sin(rad(c-a)/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2;
  return 6371.0088*2*Math.atan2(Math.sqrt(Math.min(1,x)),Math.sqrt(Math.max(0,1-x)));
}
const minutes=(clock:string)=>Number(clock.slice(0,2))*60+Number(clock.slice(3,5));
/** Date-specific availability already excludes occupied, expired-notice and past slots. */
export function venueDirectoryRow(
  venue:PublicVenueDto, slots:AvailabilitySlotDto[], filters:VenueDirectoryFilters, followerCount=0,
):VenueDirectoryResult|null{
  const formatter=new Intl.DateTimeFormat("en-GB",{
    timeZone:venue.timezone,hour:"2-digit",minute:"2-digit",hourCycle:"h23",
  });
  const from=filters.startTime?minutes(filters.startTime):0;
  const to=filters.endTime?minutes(filters.endTime):1439;
  const matches=slots.filter(slot=>{
    const parts=Object.fromEntries(formatter.formatToParts(new Date(slot.startsAt)).map(p=>[p.type,p.value]));
    const time=(Number(parts.hour)%24)*60+Number(parts.minute);
    return time>=from&&time<=to&&
      (filters.minPriceAfn===undefined||slot.priceAfn>=filters.minPriceAfn)&&
      (filters.maxPriceAfn===undefined||slot.priceAfn<=filters.maxPriceAfn);
  });
  if((filters.availableOnly||filters.minPriceAfn!==undefined||filters.maxPriceAfn!==undefined)&&!matches.length)return null;
  const distanceKm=filters.latitude===undefined||filters.longitude===undefined||
    venue.latitude===null||venue.longitude===null?null:
    kilometers(filters.latitude,filters.longitude,venue.latitude,venue.longitude);
  return {venue,availableCount:matches.length,
    lowestPriceAfn:matches.length?Math.min(...matches.map(slot=>slot.priceAfn)):null,
    earliestStartsAt:matches[0]?.startsAt??null,
    distanceKm,followerCount};
}
export function rankVenueDirectory(rows:VenueDirectoryResult[],sort:VenueDirectoryFilters["sort"]){
  const nullLast=(a:number|null,b:number|null)=>a===null?(b===null?0:1):b===null?-1:a-b;
  const name=(a:VenueDirectoryResult,b:VenueDirectoryResult)=>
    a.venue.name.localeCompare(b.venue.name)||a.venue.id.localeCompare(b.venue.id);
  return rows.sort((a,b)=>{
    switch(sort){
      case "nearest":return nullLast(a.distanceKm,b.distanceKm)||name(a,b);
      case "lowestPrice":return nullLast(a.lowestPriceAfn,b.lowestPriceAfn)||name(a,b);
      case "mostFollowed":return b.followerCount-a.followerCount||name(a,b);
      case "availableSoonest":return (a.earliestStartsAt??"z").localeCompare(b.earliestStartsAt??"z")||name(a,b);
      default:return Number(b.availableCount>0)-Number(a.availableCount>0)
        ||nullLast(a.distanceKm,b.distanceKm)
        ||(a.earliestStartsAt??"z").localeCompare(b.earliestStartsAt??"z")
        ||name(a,b);
    }
  });
}
