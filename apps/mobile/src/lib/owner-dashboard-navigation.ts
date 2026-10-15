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
  ],
} as const;

const inPath=(path:string,root:string)=>path===root||path.startsWith(root+"/");

export function ownerSectionForPath(path:string):OwnerDashboardSection{
  if(path==="/dashboard"||path==="/owner"||inPath(path,"/owner/overview"))return "overview";
  if(inPath(path,"/owner/bookings"))return "bookings";
  if(inPath(path,"/owner/schedule")||inPath(path,"/owner/timetable")||
     inPath(path,"/owner/manual-booking")||inPath(path,"/owner/block-time"))return "schedule";
  if(inPath(path,"/owner/competitions")||inPath(path,"/owner/manual-teams"))return "competitions";
  if(inPath(path,"/owner/posts")||inPath(path,"/owner/promotions"))return "media";
  if(inPath(path,"/owner/analytics"))return "analysis";
  if(inPath(path,"/owner/settings")||inPath(path,"/owner/onboarding")||
     inPath(path,"/owner/subscription")||inPath(path,"/owner/referees"))return "settings";
  return "overview";
}

/** Remember only real, section-level subtab routes, never private detail URLs. */
export type OwnerRememberableRoute=OwnerSectionRoute|"/owner/manual-teams"|"/owner/promotions";
export function ownerRememberableSectionRoute(path:string):OwnerRememberableRoute|null{
  if(path==="/owner/manual-teams"||path==="/owner/promotions")return path;
  return ownerDashboardSections.find(item=>item.href===path)?.href??null;
}
export function ownerSectionRoot(section:OwnerDashboardSection):OwnerSectionRoute{
  return ownerDashboardSections.find(item=>item.key===section)!.href;
}
export function ownerSecondaryRoute(path:string):"competitions"|"media"|null{
  if(inPath(path,"/owner/competitions")||inPath(path,"/owner/manual-teams"))return "competitions";
  if(inPath(path,"/owner/posts")||inPath(path,"/owner/promotions"))return "media";
  return null;
}
export function ownerSubsectionRoute(
  path:string,section:"competitions"|"media",
):string{
  if(section==="competitions")return inPath(path,"/owner/manual-teams")?"offline":"all";
  return inPath(path,"/owner/promotions")?"promotions":"posts";
}
