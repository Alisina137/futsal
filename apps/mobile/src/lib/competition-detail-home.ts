import type {CompetitionDto,CompetitionMatchDto} from "@leaguekick/contracts";

export type CompetitionHomeAction={
  main:"TEAMS"|"MATCHES";
  sub:"REGISTRATION"|"LIVE"|"RESULTS"|"UPCOMING"|"ALL";
};
const finalMatch=(match:CompetitionMatchDto)=>match.status==="COMPLETED"||match.status==="CORRECTED";
const finiteDate=(value:string|null):number|null=>{
  if(!value)return null;
  const ms=Date.parse(value);
  return Number.isFinite(ms)?ms:null;
};

/** Presentation data only: server determines actual registration permissions and published results. */
export function competitionHomeSnapshot(competition:Pick<CompetitionDto,
  "status"|"teams"|"matches"|"championTeamId"|"maxTeams"|"registrationClosesAt">,
  now:Date=new Date()){
  const accepted=competition.teams.filter(team=>team.status==="ACCEPTED");
  const live=["COMPLETED","ARCHIVED","CANCELLED"].includes(competition.status)?[]:
    competition.matches.filter(match=>match.status==="IN_PROGRESS").sort((a,b)=>
    (a.startsAt??"").localeCompare(b.startsAt??"")||a.id.localeCompare(b.id));
  const upcoming=competition.matches.filter(match=>match.status==="SCHEDULED"&&
    finiteDate(match.startsAt)!==null&&finiteDate(match.startsAt)!>=now.getTime())
    .sort((a,b)=>(a.startsAt??"").localeCompare(b.startsAt??"")||a.id.localeCompare(b.id));
  const results=competition.matches.filter(match=>finalMatch(match)&&
    match.homeScore!==null&&match.awayScore!==null);
  const completed=results.length;
  const currentChampion=competition.status==="COMPLETED"||competition.status==="ARCHIVED"?
    accepted.find(team=>team.teamId===competition.championTeamId)??null:null;
  const deadline=finiteDate(competition.registrationClosesAt);
  const registrationOpen=competition.status==="REGISTRATION_OPEN"&&
    (deadline===null||deadline>now.getTime())&&accepted.length<competition.maxTeams;
  const action:CompetitionHomeAction=registrationOpen?{main:"TEAMS",sub:"REGISTRATION"}:
    live.length?{main:"MATCHES",sub:"LIVE"}:
    ["COMPLETED","ARCHIVED"].includes(competition.status)?
      {main:"MATCHES",sub:completed?"RESULTS":"ALL"}:
    upcoming.length?{main:"MATCHES",sub:"UPCOMING"}:{main:"MATCHES",sub:"ALL"};
  return {
    acceptedCount:accepted.length,
    remainingPlaces:Math.max(0,competition.maxTeams-accepted.length),
    live,upcoming:upcoming[0]??null,verifiedResults:completed,
    champion:currentChampion,registrationOpen,action,
  };
}

export function competitionShareMessage(name:string,id:string,venueName?:string|null):string{
  const parts=[name.trim(),venueName?.trim()].filter(Boolean);
  return parts.join(" · ")+"\nleaguekick://competitions/"+id;
}
