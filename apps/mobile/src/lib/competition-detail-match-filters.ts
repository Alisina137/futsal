import type {CompetitionMatchDto} from "@leaguekick/contracts";

/** A filter remains selected when users move between Matches subtabs. */
export type CompetitionMatchDatePreset="ALL"|"TODAY"|"TOMORROW"|"NEXT_7_DAYS";
export type CompetitionMatchPreferences={
  teamId:string;
  stage:"ALL"|CompetitionMatchDto["stage"];
  round:number|null;
  group:string;
  date:CompetitionMatchDatePreset;
};
export const emptyCompetitionMatchPreferences:CompetitionMatchPreferences={
  teamId:"ALL",stage:"ALL",round:null,group:"ALL",date:"ALL",
};

const dayKey=(iso:string):string|null=>{
  const ms=Date.parse(iso);
  if(!Number.isFinite(ms))return null;
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Kabul",year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(new Date(ms));
  const part=(name:string)=>parts.find(entry=>entry.type===name)?.value;
  const yyyy=part("year"),mm=part("month"),dd=part("day");
  return yyyy&&mm&&dd?`${yyyy}-${mm}-${dd}`:null;
};
/** Date windows are Kabul-calendar days rather than server-local/UTC days. */
export function matchFitsDatePreset(
  startsAt:string|null,preset:CompetitionMatchDatePreset,now:Date=new Date(),
):boolean{
  if(preset==="ALL")return true;
  if(!startsAt)return false;
  const today=dayKey(now.toISOString()),fixture=dayKey(startsAt);
  if(!today||!fixture)return false;
  const base=Date.parse(today+"T00:00:00Z");
  const target=Date.parse(fixture+"T00:00:00Z");
  if(!Number.isFinite(base)||!Number.isFinite(target))return false;
  const days=Math.round((target-base)/86400000);
  return preset==="TODAY"?days===0:
    preset==="TOMORROW"?days===1:days>=0&&days<7;
}

export function matchFitsPreferences(match:CompetitionMatchDto,
  prefs:CompetitionMatchPreferences,now:Date=new Date()):boolean{
  return (prefs.teamId==="ALL"||match.homeTeamId===prefs.teamId||
    match.awayTeamId===prefs.teamId)&&
    (prefs.stage==="ALL"||match.stage===prefs.stage)&&
    (prefs.round===null||match.roundNumber===prefs.round)&&
    (prefs.group==="ALL"||match.groupName===prefs.group)&&
    matchFitsDatePreset(match.startsAt,prefs.date,now);
}
export function normalizedCompetitionMatchPreferences(
  pref:CompetitionMatchPreferences,competition:Pick<import("@leaguekick/contracts").CompetitionDto,
  "matches"|"teams">,
):CompetitionMatchPreferences{
  const allowedTeams=new Set(competition.teams.filter(team=>team.status==="ACCEPTED")
    .map(team=>team.teamId));
  const stageValid=pref.stage==="ALL"||competition.matches.some(m=>m.stage===pref.stage);
  const stage=stageValid?pref.stage:"ALL";
  const roundValid=pref.round===null||competition.matches.some(m=>
    (stage==="ALL"||m.stage===stage)&&m.roundNumber===pref.round);
  const groupValid=pref.group==="ALL"||competition.matches.some(m=>
    m.groupName===pref.group&&(stage==="ALL"||m.stage===stage));
  return {
    teamId:pref.teamId==="ALL"||allowedTeams.has(pref.teamId)?pref.teamId:"ALL",
    stage,round:roundValid?pref.round:null,
    group:groupValid?pref.group:"ALL",date:pref.date,
  };
}
