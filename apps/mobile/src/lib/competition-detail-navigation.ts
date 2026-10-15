/** Single source of truth for competition profile main and contextual sub-navigation. */
export const competitionProfileMainTabs=[
  "HOME","MATCHES","STANDINGS","STATS","TEAMS","MEDIA","ABOUT",
] as const;
export type CompetitionDetailTab=typeof competitionProfileMainTabs[number];
export const competitionProfileSubtabs={
  HOME:["OVERVIEW","LIVE","HIGHLIGHTS"],
  MATCHES:["UPCOMING","LIVE","RESULTS","ALL"],
  STANDINGS:["LEAGUE","GROUPS","KNOCKOUT"],
  STATS:["TEAMS","PLAYERS","FAIR_PLAY"],
  TEAMS:["PARTICIPANTS","REGISTRATION","MY_PARTICIPATION"],
  MEDIA:["UPDATES","PHOTOS"],
  ABOUT:["INFORMATION","RULES","PRIZES","VENUE"],
} as const;
export type CompetitionDetailSubtab<T extends CompetitionDetailTab=CompetitionDetailTab>=
  (typeof competitionProfileSubtabs)[T][number];
export type CompetitionDetailNavigation={
  main:CompetitionDetailTab;
  sub:Record<CompetitionDetailTab,string>;
};
const defaults:Record<CompetitionDetailTab,string>={
  HOME:"OVERVIEW",MATCHES:"ALL",STANDINGS:"LEAGUE",STATS:"PLAYERS",
  TEAMS:"PARTICIPANTS",MEDIA:"UPDATES",ABOUT:"INFORMATION",
};

export function allowedCompetitionSubtabs(
  main:CompetitionDetailTab,
  format:"LEAGUE"|"KNOCKOUT"|"GROUP_KNOCKOUT",
  options:{hasParticipation?:boolean;registrationOpen?:boolean}={},
):readonly string[]{
  const all:readonly string[]=competitionProfileSubtabs[main];
  if(main==="STANDINGS")return format==="LEAGUE"?["LEAGUE"]:
    format==="KNOCKOUT"?["KNOCKOUT"]:["GROUPS","KNOCKOUT"];
  if(main==="TEAMS")return ["PARTICIPANTS",
    ...(options.registrationOpen?["REGISTRATION"]:[]),
    ...(options.hasParticipation?["MY_PARTICIPATION"]:[])];
  return all;
}
const clean=(value:string|string[]|undefined):string|undefined=>
  typeof value==="string"?value:Array.isArray(value)?value[0]:undefined;
export function requestedCompetitionNavigation(
  requestedMain?:string|string[],
  requestedSub?:string|string[],
  format:"LEAGUE"|"KNOCKOUT"|"GROUP_KNOCKOUT"="LEAGUE",
):CompetitionDetailNavigation{
  const incoming=clean(requestedMain);
  const main:CompetitionDetailTab=incoming==="RESULTS"?"MATCHES":
    competitionProfileMainTabs.find(value=>value===incoming)??"HOME";
  const candidates=allowedCompetitionSubtabs(main,format,{
    hasParticipation:true,registrationOpen:true,
  });
  const target=clean(requestedSub);
  const legacy=incoming==="RESULTS"?"RESULTS":undefined;
  const defaultSub=main==="STANDINGS"?
    format==="KNOCKOUT"?"KNOCKOUT":format==="GROUP_KNOCKOUT"?"GROUPS":"LEAGUE":defaults[main];
  return {main,sub:{...defaults,[main]:candidates.includes(target??"")?target!:
    legacy??defaultSub}};
}
export function chooseCompetitionMain(
  current:CompetitionDetailNavigation,main:CompetitionDetailTab,
):CompetitionDetailNavigation{
  return {main,sub:current.sub};
}
export function chooseCompetitionSubtab(
  current:CompetitionDetailNavigation,main:CompetitionDetailTab,sub:string,
  available:readonly string[],
):CompetitionDetailNavigation{
  if(current.main!==main||!available.includes(sub))return current;
  return {...current,sub:{...current.sub,[main]:sub}};
}
export function resolvedCompetitionSubtab(
  current:CompetitionDetailNavigation,main:CompetitionDetailTab,
  available:readonly string[],
):string{
  return available.includes(current.sub[main]??"")?current.sub[main]!:available[0]??"";
}
