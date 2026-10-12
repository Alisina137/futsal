import type {BookingDto,VenueTimelineSlotDto} from "@leaguekick/contracts";

// Ownership comes only from the authenticated user's private booking endpoint.
export function ownActiveVenueBookings(bookings:readonly BookingDto[],venueId:string,
  userId:string):BookingDto[]{
  return bookings.filter(item=>item.venueId===venueId&&
    item.playerUserId===userId&&item.status!=="CANCELLED");
}

export function findOwnBookingForSlot(
  bookings:readonly BookingDto[],
  slot:Pick<VenueTimelineSlotDto,"areaId"|"startsAt"|"endsAt">,
):BookingDto|undefined{
  const start=Date.parse(slot.startsAt),end=Date.parse(slot.endsAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end)return undefined;
  const candidate=bookings.filter(item=>item.areaId===slot.areaId&&item.status!=="CANCELLED");
  return candidate.find(item=>Date.parse(item.startsAt)===start) ??
    candidate.find(item=>Date.parse(item.startsAt)<end&&Date.parse(item.endsAt)>start);
}
