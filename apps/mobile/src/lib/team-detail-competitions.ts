import type {CompetitionFormat,CompetitionStatus} from "@leaguekick/contracts";
import type {TeamPublicHighlights} from "./api";

export type PublicTeamCompetition=TeamPublicHighlights["competitions"][number];
export type PublicTeamFixture=TeamPublicHighlights["matches"][number];
export type TeamCompetitionPhase="active"|"past";
export type TeamCompetitionFormatFilter="all"|CompetitionFormat;
export type TeamCompetitionStatusFilter="all"|CompetitionStatus;
export type TeamCompetitionFilters={
  format:TeamCompetitionFormatFilter;
  status:TeamCompetitionStatusFilter;
};

export const teamCompetitionFormats=[
  "LEAGUE","KNOCKOUT","GROUP_KNOCKOUT",
] as const satisfies readonly CompetitionFormat[];

export const teamCompetitionStatuses=[
  "REGISTRATION_OPEN","REGISTRATION_CLOSED","SCHEDULED","IN_PROGRESS",
  "COMPLETED","ARCHIVED","CANCELLED",
] as const satisfies readonly CompetitionStatus[];

const pastStatuses=new Set<string>(["COMPLETED","ARCHIVED","CANCELLED"]);
const activeOrder:Record<string,number>={
  IN_PROGRESS:0,SCHEDULED:1,REGISTRATION_OPEN:2,REGISTRATION_CLOSED:3,
};

export function teamCompetitionPhase(status:string):TeamCompetitionPhase|null{
  if(pastStatuses.has(status))return "past";
  // Drafts should not appear in the public active participation experience,
  // even if an inconsistent backend row has published=true.
  if(status==="DRAFT")return null;
  return teamCompetitionStatuses.some(item=>item===status)?"active":null;
}

function timestamp(value:string|null):number|null{
  if(!value)return null;
  const date=Date.parse(value);
  return Number.isFinite(date)?date:null;
}

export function teamCompetitionRows(
  competitions:readonly PublicTeamCompetition[],
  phase:TeamCompetitionPhase,
  filter:TeamCompetitionFilters={format:"all",status:"all"},
):PublicTeamCompetition[]{
  return competitions.filter(comp=>
    teamCompetitionPhase(comp.status)===phase&&
    (filter.format==="all"||comp.format===filter.format)&&
    (filter.status==="all"||comp.status===filter.status)
  ).sort((a,b)=>{
    if(phase==="active"){
      const rank=(activeOrder[a.status]??100)-(activeOrder[b.status]??100);
      if(rank!==0)return rank;
      const left=timestamp(a.startsAt)??Infinity;
      const right=timestamp(b.startsAt)??Infinity;
      if(left!==right)return left-right;
    }else{
      const left=timestamp(a.endsAt)??timestamp(a.startsAt)??-Infinity;
      const right=timestamp(b.endsAt)??timestamp(b.startsAt)??-Infinity;
      if(left!==right)return right-left;
    }
    return a.name.localeCompare(b.name)||a.id.localeCompare(b.id);
  });
}

export function teamCompetitionAvailableStatuses(
  competitions:readonly PublicTeamCompetition[],phase:TeamCompetitionPhase,
):CompetitionStatus[]{
  const available=new Set(teamCompetitionRows(competitions,phase).map(item=>item.status));
  return teamCompetitionStatuses.filter(status=>available.has(status));
}

export function teamCompetitionAvailableFormats(
  competitions:readonly PublicTeamCompetition[],phase:TeamCompetitionPhase,
):CompetitionFormat[]{
  const available=new Set(teamCompetitionRows(competitions,phase).map(item=>item.format));
  return teamCompetitionFormats.filter(format=>available.has(format));
}

/** A preview from the capped public fixture snapshot, NOT an all-time match total. */
export function teamCompetitionFixturePreview(
  matches:readonly PublicTeamFixture[],teamId:string,competitionId:string,
):{kind:"upcoming"|"result";match:PublicTeamFixture}|null{
  const scoped=matches.filter(m=>
    m.competitionId===competitionId&&(m.homeTeamId===teamId||m.awayTeamId===teamId));
  const upcoming=scoped.filter(m=>["SCHEDULED","IN_PROGRESS","POSTPONED"].includes(m.status))
    .sort((a,b)=>{
      if(a.status==="IN_PROGRESS"&&b.status!=="IN_PROGRESS")return -1;
      if(b.status==="IN_PROGRESS"&&a.status!=="IN_PROGRESS")return 1;
      return (timestamp(a.startsAt)??Infinity)-(timestamp(b.startsAt)??Infinity)||
        a.id.localeCompare(b.id);
    });
  if(upcoming[0])return {kind:"upcoming",match:upcoming[0]};
  const results=scoped.filter(m=>
    ["COMPLETED","CORRECTED"].includes(m.status)&&m.homeScore!==null&&m.awayScore!==null)
    .sort((a,b)=>(timestamp(b.startsAt)??-Infinity)-(timestamp(a.startsAt)??-Infinity)||
      a.id.localeCompare(b.id));
  return results[0]?{kind:"result",match:results[0]}:null;
}
