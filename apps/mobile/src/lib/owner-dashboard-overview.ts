import type {
  BookingDto,CompetitionListItemDto,OwnerAnalyticsResponse,
  OwnerOnboardingStatus,VenueCalendarDay,VenueCalendarEvent,
} from "@leaguekick/contracts";

export type OverviewTab="today"|"actions"|"performance";
export const overviewTabs:readonly OverviewTab[]=["today","actions","performance"];

export type OverviewSnapshot={
  day:VenueCalendarDay|null;
  pending:BookingDto[]|null;
  competitions:CompetitionListItemDto[]|null;
  analytics:OwnerAnalyticsResponse|null;
  failures:readonly ("calendar"|"pending"|"competitions"|"analytics")[];
};

const isBooking=(event:VenueCalendarEvent)=>event.type==="ONLINE_BOOKING"||event.type==="MANUAL_BOOKING";
const confirmed=(event:VenueCalendarEvent)=>isBooking(event)&&event.bookingStatus==="CONFIRMED";
export const activeCompetitionStatus=(status:string)=>[
  "REGISTRATION_OPEN","REGISTRATION_CLOSED","SCHEDULED","IN_PROGRESS",
].includes(status);

export function computeOwnerOverview(
  snapshot:OverviewSnapshot,status:OwnerOnboardingStatus,dayKey:string,nowMs:number,
){
  // Calendar is venue-scoped and already evaluates closures, reserved inventory
  // and promotions on the server. Do not infer bookable slots from opening hours.
  const day=snapshot.day?.date===dayKey?snapshot.day:null;
  const bookings=day?.events.filter(confirmed)??[];
  const uniqueBookings=[...new Map(bookings.map(item=>[item.id,item])).values()];
  const upcoming=(day?.events??[])
    .filter(event=>event.startsAt&&Date.parse(event.startsAt)>=nowMs
      &&(confirmed(event)||event.type==="COMPETITION"))
    .sort((a,b)=>Date.parse(a.startsAt!)-Date.parse(b.startsAt!));
  const livePending=snapshot.pending===null?null:snapshot.pending
    .filter(booking=>booking.status==="PENDING"&&Date.parse(booking.startsAt)>nowMs);
  const active=snapshot.competitions===null?null:
    snapshot.competitions.filter(item=>activeCompetitionStatus(item.status));
  const expiration=status.subscription.activeUntil??status.subscription.trialEndsAt;
  const endsAt=expiration?Date.parse(expiration):NaN;
  const expiringSoon=(status.subscription.state==="TRIAL"||status.subscription.state==="ACTIVE")
    &&Number.isFinite(endsAt)&&endsAt>=nowMs&&endsAt-nowMs<=7*86_400_000;

  return {
    confirmedToday:day?uniqueBookings.length:null,
    availableToday:day?day.availableCount:null,
    confirmedBookingValueToday:day?uniqueBookings.reduce(
      (sum,event)=>sum+(event.priceAfn??0),0):null,
    upcoming,
    upcomingMatchCount:day?upcoming.filter(event=>event.type==="COMPETITION").length:null,
    pendingCount:livePending?.length??null,
    activeCompetitionCount:active?.length??null,
    registrationOpenCount:active?.filter(item=>item.status==="REGISTRATION_OPEN").length??null,
    expiringSoon,
    ended:status.subscription.state==="EXPIRED"||status.subscription.state==="CANCELLED",
    onlineBookingPaused:!status.venue?.onlineBookingEnabled,
  };
}

export type OwnerAttention={
  key:"pending"|"subscription"|"paused"|"registrations";
  amount?:number;
  href:"/owner/bookings"|"/owner/subscription"|"/owner/settings"|"/owner/competitions";
  tone:"warning"|"info";
};

export function ownerAttentionItems(
  result:ReturnType<typeof computeOwnerOverview>,
):OwnerAttention[]{
  const items:OwnerAttention[]=[];
  if(result.pendingCount!==null&&result.pendingCount>0)
    items.push({key:"pending",amount:result.pendingCount,href:"/owner/bookings",tone:"warning"});
  if(result.ended||result.expiringSoon)
    items.push({key:"subscription",href:"/owner/subscription",tone:"warning"});
  if(result.onlineBookingPaused)
    items.push({key:"paused",href:"/owner/settings",tone:"warning"});
  if(result.registrationOpenCount!==null&&result.registrationOpenCount>0)
    items.push({key:"registrations",amount:result.registrationOpenCount,
      href:"/owner/competitions",tone:"info"});
  return items;
}

/** Null means unavailable/unmeasurable, never a fabricated 0% change. */
export function percentage(value:number|null|undefined):string{
  return value===null||value===undefined||!Number.isFinite(value)?"—":
    `${(100*value).toFixed(1)}%`;
}
export function ownerPerformance(analytics:OwnerAnalyticsResponse|null){
  return analytics===null?null:{
    grossBookingValue:analytics.grossBookingValueAfn,
    bookings:analytics.bookingCount,
    occupancy:analytics.occupancyRate,
    cancellations:analytics.cancellationRate,
    onlineShare:analytics.onlineBookingShare,
    revenueChangeRate:analytics.comparison.revenueChangeRate,
    bookingChangeRate:analytics.comparison.bookingChangeRate,
    occupancyChangeRate:analytics.comparison.occupancyChangeRate,
  };
}
