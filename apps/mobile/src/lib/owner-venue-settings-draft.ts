import type {OwnerVenueSettingsDto,VenueAmenity} from "@leaguekick/contracts";

export type OwnerVenueSettingsDraft={
  publicPhone:string;whatsappPhone:string;latitude:string;longitude:string;
  courtName:string;duration:string;basePrice:string;
  bookingMode:"INSTANT"|"APPROVAL";onlineBookingEnabled:boolean;
  noticeMinutes:string;advanceDays:string;cancellationPolicy:string;
  amenities:VenueAmenity[];houseRules:string;
};

/** Detect actual local edits without relying on object identity or amenity ordering.
 * Do not silently reload/overwrite these draft inputs when returning from another owner screen. */
export function ownerVenueSettingsDirty(
  saved:OwnerVenueSettingsDto,draft:OwnerVenueSettingsDraft,
):boolean{
  const normalize=(value:string)=>value.trim();
  return normalize(draft.publicPhone)!==normalize(saved.publicPhone)
    ||normalize(draft.whatsappPhone)!==normalize(saved.whatsappPhone??"")
    ||normalize(draft.latitude)!==(saved.latitude===null?"":String(saved.latitude))
    ||normalize(draft.longitude)!==(saved.longitude===null?"":String(saved.longitude))
    ||normalize(draft.courtName)!==saved.court.name
    ||draft.duration!==String(saved.court.defaultSessionDurationMinutes)
    ||draft.basePrice!==String(saved.court.basePriceAfn)
    ||draft.bookingMode!==saved.bookingMode
    ||draft.onlineBookingEnabled!==saved.onlineBookingEnabled
    ||draft.noticeMinutes!==String(saved.minimumBookingNoticeMinutes)
    ||draft.advanceDays!==String(saved.maximumAdvanceBookingDays)
    ||normalize(draft.cancellationPolicy)!==saved.cancellationPolicy
    ||normalize(draft.houseRules)!==(saved.houseRules??"")
    ||[...draft.amenities].sort().join("|")!==[...saved.amenities].sort().join("|");
}
