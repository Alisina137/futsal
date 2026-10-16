import type {CompetitionDto,CompetitionMatchDto,PlayerCompetitionStatDto} from "@leaguekick/contracts";

type OfficialScoredMatch=CompetitionMatchDto &{
  homeTeamId:string;awayTeamId:string;homeScore:number;awayScore:number;
};

/** Shared source for team totals and the per-team finished-match drill-down.
 * Both participants must still be accepted; only verified final scores count. */
function officialScoredMatches(competition:Pick<CompetitionDto,"teams"|"matches">):OfficialScoredMatch[]{
  const accepted=new Set(competition.teams.filter(team=>team.status==="ACCEPTED")
    .map(team=>team.teamId));
  return competition.matches.filter((match):match is OfficialScoredMatch=>
    (match.status==="COMPLETED"||match.status==="CORRECTED")&&
    match.homeTeamId!==null&&match.awayTeamId!==null&&
    match.homeTeamId!==match.awayTeamId&&
    accepted.has(match.homeTeamId)&&accepted.has(match.awayTeamId)&&
    match.homeScore!==null&&match.awayScore!==null&&
    Number.isSafeInteger(match.homeScore)&&Number.isSafeInteger(match.awayScore)&&
    match.homeScore>=0&&match.awayScore>=0);
}

/** Official match records only, newest scheduled date first. Null dates remain
 * visible last. No live, unscored, cancelled, or removed-team data can appear. */
export function competitionTeamFinishedMatches(
  competition:Pick<CompetitionDto,"teams"|"matches">,teamId:string,
):OfficialScoredMatch[]{
  return officialScoredMatches(competition)
    .filter(match=>match.homeTeamId===teamId||match.awayTeamId===teamId)
    .sort((a,b)=>(b.startsAt??"").localeCompare(a.startsAt??"")||
      a.roundNumber-b.roundNumber||a.slotNumber-b.slotNumber||a.id.localeCompare(b.id));
}

/**
 * Public team totals are derived from official, scored, finalized fixtures.
 * Never reuse group standings: those exclude knockout rounds and are not
 * competition-wide records. Shootout winners do not change drawn scorelines.
 */
export function competitionTeamStatistics(
  competition:Pick<CompetitionDto,"teams"|"matches">,
){
  const accepted=competition.teams.filter(team=>team.status==="ACCEPTED");
  const results=new Map(accepted.map(team=>[team.teamId,{
    teamId:team.teamId,teamName:team.teamName,offline:team.offline,
    played:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,goalDifference:0,
  }]));
  let scoredMatches=0;
  for(const match of officialScoredMatches(competition)){
    const home=results.get(match.homeTeamId)!,away=results.get(match.awayTeamId)!;
    scoredMatches++;
    home.played++;away.played++;
    home.goalsFor+=match.homeScore;home.goalsAgainst+=match.awayScore;
    away.goalsFor+=match.awayScore;away.goalsAgainst+=match.homeScore;
    if(match.homeScore>match.awayScore){home.wins++;away.losses++;}
    else if(match.homeScore<match.awayScore){away.wins++;home.losses++;}
    else{home.draws++;away.draws++;}
  }
  const teams=[...results.values()].map(row=>({
    ...row,goalDifference:row.goalsFor-row.goalsAgainst,
  })).sort((a,b)=>b.wins-a.wins||b.goalDifference-a.goalDifference||
    b.goalsFor-a.goalsFor||a.teamName.localeCompare(b.teamName)||
    a.teamId.localeCompare(b.teamId));
  return {teams,scoredMatches};
}

/** The API's disciplinary totals include PRIVATE-profile players without
 * exposing their identities. Null means an older server has no aggregate.
 * Card totals measure recorded events, not an invented fair-play score. */
export function competitionFairPlayStatistics(
  competition:Pick<CompetitionDto,"teams"|"teamDisciplineStats">,
){
  if(!competition.teamDisciplineStats)return null;
  const accepted=competition.teams.filter(team=>team.status==="ACCEPTED");
  const reported=new Map(competition.teamDisciplineStats.map(item=>[item.teamId,item]));
  const teams=accepted.map(team=>{
    const row=reported.get(team.teamId);
    return {teamId:team.teamId,teamName:team.teamName,offline:team.offline,
      yellowCards:row?.yellowCards??0,redCards:row?.redCards??0};
  }).sort((a,b)=>a.redCards-b.redCards||a.yellowCards-b.yellowCards||
    a.teamName.localeCompare(b.teamName)||a.teamId.localeCompare(b.teamId));
  return {teams,hasRecordedCards:teams.some(row=>row.yellowCards>0||row.redCards>0)};
}

export type CompetitionPlayerMetric=Exclude<keyof PlayerCompetitionStatDto,
  "playerUserId"|"publicDisplayName"|"teamId"|"teamName">;

export function competitionPlayerLeaders(
  competition:Pick<CompetitionDto,"teams"|"playerStats">,
  metric:CompetitionPlayerMetric,teamId="ALL",
){
  const accepted=new Set(competition.teams.filter(team=>team.status==="ACCEPTED")
    .map(team=>team.teamId));
  return competition.playerStats.filter(stat=>
    accepted.has(stat.teamId)&&(teamId==="ALL"||teamId===stat.teamId)&&
    Number.isSafeInteger(stat[metric])&&stat[metric]>0)
    .sort((a,b)=>b[metric]-a[metric]||b.goals-a.goals||
      a.publicDisplayName.localeCompare(b.publicDisplayName)||
      a.playerUserId.localeCompare(b.playerUserId));
}
