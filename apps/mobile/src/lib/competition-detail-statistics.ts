import type {CompetitionDto} from "@leaguekick/contracts";

/** Public statistics are limited to confirmed participant teams and scored final results. */
export function competitionTeamStatistics(competition:Pick<CompetitionDto,"teams"|"matches">){
  const teams=competition.teams.filter(team=>team.status==="ACCEPTED");
  const ids=new Set(teams.map(team=>team.teamId));
  const official=competition.matches.filter(match=>
    (match.status==="COMPLETED"||match.status==="CORRECTED")&&
    match.homeScore!==null&&match.awayScore!==null&&
    match.homeTeamId!==null&&match.awayTeamId!==null&&
    match.homeTeamId!==match.awayTeamId&&
    ids.has(match.homeTeamId)&&ids.has(match.awayTeamId));
  return teams.map(team=>{
    let wins=0,draws=0,losses=0,goals=0,conceded=0;
    for(const match of official){
      if(match.homeTeamId!==team.teamId&&match.awayTeamId!==team.teamId)continue;
      const forGoals=match.homeTeamId===team.teamId?match.homeScore!:match.awayScore!;
      const againstGoals=match.homeTeamId===team.teamId?match.awayScore!:match.homeScore!;
      goals+=forGoals;
      conceded+=againstGoals;
      if(forGoals>againstGoals)wins++;
      else if(forGoals===againstGoals)draws++;
      else losses++;
    }
    return {...team,played:wins+draws+losses,wins,draws,losses,goals,conceded,
      goalDifference:goals-conceded};
  }).sort((a,b)=>b.wins-a.wins||b.goalDifference-a.goalDifference||
    b.goals-a.goals||a.teamName.localeCompare(b.teamName)||a.teamId.localeCompare(b.teamId));
}

/** These are observed player-level cards, not official disciplinary points or an award. */
export function competitionRecordedDiscipline(competition:Pick<CompetitionDto,"teams"|"playerStats">){
  const teams=competition.teams.filter(team=>team.status==="ACCEPTED");
  return teams.map(team=>{
    const recorded=competition.playerStats.filter(row=>row.teamId===team.teamId);
    return {...team,yellow:recorded.reduce((sum,row)=>sum+row.yellowCards,0),
      red:recorded.reduce((sum,row)=>sum+row.redCards,0),
      recordedPlayers:recorded.length};
  }).sort((a,b)=>a.red-b.red||a.yellow-b.yellow||
    a.teamName.localeCompare(b.teamName)||a.teamId.localeCompare(b.teamId));
}
