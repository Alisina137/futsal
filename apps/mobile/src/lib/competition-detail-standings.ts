import type {CompetitionMatchDto,CompetitionStandingRowDto} from "@leaguekick/contracts";

/** The tournament engine defines round 1 as the final; higher rounds precede it.
 * Nothing here infers a result or assigns a missing slot. */
export type KnockoutRound={
  round:number;matches:CompetitionMatchDto[];
  isFinal:boolean;
};
export type VerifiedKnockoutConnection={
  sourceMatchId:string;nextMatchId:string;nextRound:number;
  side:"HOME"|"AWAY";winnerTeamId:string;
};
const finished=(match:CompetitionMatchDto)=>
  match.status==="COMPLETED"||match.status==="CORRECTED";

export function knockoutRoundColumns(matches:readonly CompetitionMatchDto[]):KnockoutRound[]{
  const knockout=matches.filter(match=>match.stage==="KNOCKOUT");
  const rounds=[...new Set(knockout.map(match=>match.roundNumber))]
    .sort((a,b)=>b-a);
  return rounds.map(round=>({
    round,
    matches:knockout.filter(match=>match.roundNumber===round)
      .sort((a,b)=>a.slotNumber-b.slotNumber||a.id.localeCompare(b.id)),
    isFinal:round===1&&knockout.filter(match=>match.roundNumber===1).length===1,
  }));
}

export function verifiedKnockoutConnections(
  matches:readonly CompetitionMatchDto[],
):VerifiedKnockoutConnection[]{
  const byId=new Map(matches.filter(m=>m.stage==="KNOCKOUT").map(m=>[m.id,m]));
  const edges:VerifiedKnockoutConnection[]=[];
  for(const m of byId.values()){
    if(!finished(m)||m.homeScore===null||m.awayScore===null||
      !m.winnerTeamId||!m.nextMatchId||!m.nextMatchSide||
      (m.winnerTeamId!==m.homeTeamId&&m.winnerTeamId!==m.awayTeamId))continue;
    const next=byId.get(m.nextMatchId);
    if(!next||next.id===m.id||next.roundNumber>=m.roundNumber)continue;
    // A winner can only be shown as advanced if the official next fixture
    // already contains them in the correct slot. Never infer missing seats.
    const nextTeam=m.nextMatchSide==="HOME"?next.homeTeamId:next.awayTeamId;
    if(nextTeam!==m.winnerTeamId)continue;
    edges.push({sourceMatchId:m.id,nextMatchId:next.id,nextRound:next.roundNumber,
      side:m.nextMatchSide,winnerTeamId:m.winnerTeamId});
  }
  return edges;
}

export type GroupStandingSection={
  key:string;label:string;rows:CompetitionStandingRowDto[];
};
export function competitionStandingGroups(
  rows:readonly CompetitionStandingRowDto[],
  stage:"LEAGUE"|"GROUP",
):GroupStandingSection[]{
  const groups=new Map<string,CompetitionStandingRowDto[]>();
  for(const row of rows){
    if(stage==="GROUP"&&!row.groupName)continue;
    const name=stage==="LEAGUE"?"":row.groupName??"";
    const group=groups.get(name)??[];
    group.push(row);
    groups.set(name,group);
  }
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([key,group])=>({
    key,label:key,rows:group.sort((a,b)=>a.position-b.position||a.teamName.localeCompare(b.teamName)),
  }));
}

/** A zone is NOT a confirmed qualification. No match simulation required. */
export function provisionalQualificationZone(
  group:GroupStandingSection,places:number|null,
):string[]{
  if(!places||places<1)return [];
  return group.rows.filter(row=>row.position<=places).map(row=>row.teamId);
}
