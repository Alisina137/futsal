import type {
  VenueAboutSub,VenueCompetitionSub,VenueMainTab,VenueMediaSub,
  VenueReserveSub,VenueUpdatesSub,
} from "../components/venues/VenueDetailSections";

export type VenueDetailSubtabState={
  media:VenueMediaSub;
  reserve:VenueReserveSub;
  competitions:VenueCompetitionSub;
  updates:VenueUpdatesSub;
  about:VenueAboutSub;
};
export type VenueDetailNavigationState={
  main:VenueMainTab;
  sub:VenueDetailSubtabState;
};

/** New venue/page sessions start at Media > Posts unless a deep link overrides. */
export function initialVenueNavigation(bookingDeepLink:boolean,reviewBookingId?:string):VenueDetailNavigationState{
  return {
    main:bookingDeepLink?"reserve":reviewBookingId?"about":"media",
    sub:{
      media:"posts",reserve:"slots",competitions:"registration",
      updates:"announcements",about:reviewBookingId&&!bookingDeepLink?"reviews":"overview",
    },
  };
}

/** Main-tab taps preserve prior subtabs; explicit shortcuts may override. */
export function switchVenueMain<T extends VenueMainTab>(
  current:VenueDetailNavigationState,main:T,target?:VenueDetailSubtabState[T],
):VenueDetailNavigationState{
  return {main,sub:target?{...current.sub,[main]:target}:current.sub};
}

export function switchVenueSub<T extends VenueMainTab>(
  current:VenueDetailNavigationState,main:T,target:VenueDetailSubtabState[T],
):VenueDetailNavigationState{
  if(current.main!==main)return current;
  return {...current,sub:{...current.sub,[main]:target}};
}
