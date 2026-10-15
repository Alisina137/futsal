/** Stable owner dashboard route map. Only sections owned by the venue owner
 * shell belong here; competition details retain their own management tabs. */
export const ownerDashboardSections=[
  {key:"overview",href:"/owner/overview",labelKey:"owner.dashboardNav.overview",icon:"grid-outline"},
  {key:"bookings",href:"/owner/bookings",labelKey:"owner.dashboardNav.bookings",icon:"receipt-outline"},
  {key:"schedule",href:"/owner/schedule",labelKey:"owner.dashboardNav.schedule",icon:"calendar-outline"},
  {key:"competitions",href:"/owner/competitions",labelKey:"owner.dashboardNav.competitions",icon:"trophy-outline"},
  {key:"media",href:"/owner/posts",labelKey:"owner.dashboardNav.marketing",icon:"images-outline"},
  {key:"analysis",href:"/owner/analytics",labelKey:"owner.dashboardNav.analysis",icon:"stats-chart-outline"},
  {key:"settings",href:"/owner/settings",labelKey:"owner.dashboardNav.settings",icon:"settings-outline"},
] as const;

export type OwnerDashboardSection=(typeof ownerDashboardSections)[number]["key"];
export type OwnerSectionRoute=(typeof ownerDashboardSections)[number]["href"];

export const ownerDashboardSubsections={
  competitions:[
    {key:"all",href:"/owner/competitions",labelKey:"owner.dashboardSubnav.allCompetitions"},
    {key:"offline",href:"/owner/manual-teams",labelKey:"owner.dashboardSubnav.offlineTeams"},
  ],
  media:[
    {key:"posts",href:"/owner/posts",labelKey:"owner.dashboardSubnav.posts"},
    {key:"promotions",href:"/owner/promotions",labelKey:"owner.dashboardSubnav.promotions"},
    {key:"profile",href:"/owner/media-profile",labelKey:"owner.dashboardSubnav.publicProfile"},
    {key:"reviews",href:"/owner/media-reviews",labelKey:"owner.dashboardSubnav.reviews"},
  ],
} as const;

const inPath=(path:string,root:string)=>path===root||path.startsWith(root+"/");

export function ownerSectionForPath(path:string):OwnerDashboardSection{
  if(path==="/dashboard"||path==="/owner"||inPath(path,"/owner/overview"))return "overview";
  if(inPath(path,"/owner/bookings"))return "bookings";
  if(inPath(path,"/owner/schedule")||inPath(path,"/owner/timetable")||
     inPath(path,"/owner/manual-booking")||inPath(path,"/owner/block-time")||
     inPath(path,"/owner/blocks"))return "schedule";
  if(inPath(path,"/owner/competitions")||inPath(path,"/owner/manual-teams"))return "competitions";
  if(inPath(path,"/owner/posts")||inPath(path,"/owner/promotions")||
     inPath(path,"/owner/media-profile")||inPath(path,"/owner/media-reviews"))return "media";
  if(inPath(path,"/owner/analytics"))return "analysis";
  if(inPath(path,"/owner/settings")||inPath(path,"/owner/onboarding")||
     inPath(path,"/owner/subscription")||inPath(path,"/owner/referees"))return "settings";
  return "overview";
}

/** Remember only real, section-level subtab routes, never private detail URLs. */
export type OwnerRememberableRoute=OwnerSectionRoute|"/owner/manual-teams"|"/owner/promotions"|
  "/owner/media-profile"|"/owner/media-reviews";
export function ownerRememberableSectionRoute(path:string):OwnerRememberableRoute|null{
  if(path==="/owner/manual-teams"||path==="/owner/promotions"||
     path==="/owner/media-profile"||path==="/owner/media-reviews")return path;
  return ownerDashboardSections.find(item=>item.href===path)?.href??null;
}
export function ownerSectionRoot(section:OwnerDashboardSection):OwnerSectionRoute{
  return ownerDashboardSections.find(item=>item.key===section)!.href;
}
export function ownerSecondaryRoute(path:string):"competitions"|"media"|null{
  if(inPath(path,"/owner/competitions")||inPath(path,"/owner/manual-teams"))return "competitions";
  if(inPath(path,"/owner/posts")||inPath(path,"/owner/promotions")||
     inPath(path,"/owner/media-profile")||inPath(path,"/owner/media-reviews"))return "media";
  return null;
}
export function ownerSubsectionRoute(
  path:string,section:"competitions"|"media",
):string{
  if(section==="competitions")return inPath(path,"/owner/manual-teams")?"offline":"all";
  if(inPath(path,"/owner/promotions"))return "promotions";
  if(inPath(path,"/owner/media-profile"))return "profile";
  if(inPath(path,"/owner/media-reviews"))return "reviews";
  return "posts";
}
