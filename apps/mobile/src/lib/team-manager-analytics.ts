/** Verified competition analytics. Filter actual finalized match records; never
 * derive individual player metrics from the team's all-time leaderboard. */
import {kabulDay} from "./team-manager-schedule.ts";

export type AnalyticsFixture={
  id:string;competitionId:string;startsAt:string|null;status:string;
  homeTeamId:string|null;awayTeamId:string|null;homeScore:number;awayScore:number;
};
export type AnalyticsPlayerRow={
  matchId:string;competitionId:string;startsAt:string|null;userId:string;
  displayName:string;appeared:boolean;goals:number;assists:number;
  yellowCards:number;redCards:number;cleanSheet:boolean;playerOfMatch:boolean;
};
export type AnalyticsDetails={matches:AnalyticsFixture[];players:AnalyticsPlayerRow[]};
export type AnalyticsRange="ALL"|"D30"|"D90"|"D365";
export type AnalyticsFilters={competitionId:string;season:string;range:AnalyticsRange};
export type AnalyticsStats={
  played:number;wins:number;draws:number;losses:number;
  goalsFor:number;goalsAgainst:number;goalDifference:number;winRate:number;
};
export type AnalyticsPlayer={
  userId:string;displayName:string;matches:number;goals:number;assists:number;
  yellowCards:number;redCards:number;cleanSheets:number;playerOfMatch:number;
};
export type AnalyticsTrend={
  id:string;competitionId:string;startsAt:string;
  result:"WIN"|"DRAW"|"LOSS";goalsFor:number;goalsAgainst:number;
};
const ranges:Record<AnalyticsRange,number>={ALL:0,D30:30,D90:90,D365:365};
function isFinal(m:AnalyticsFixture){
  return (m.status==="COMPLETED"||m.status==="CORRECTED")&&
    Number.isInteger(m.homeScore)&&Number.isInteger(m.awayScore)&&
    m.homeScore>=0&&m.awayScore>=0;
}
function inScope(m:AnalyticsFixture,filters:AnalyticsFilters,nowMs:number){
  if(filters.competitionId!=="ALL"&&m.competitionId!==filters.competitionId)return false;
  if(filters.season!=="ALL"&&(!m.startsAt||
    kabulDay(m.startsAt).slice(0,4)!==filters.season))return false;
  const days=ranges[filters.range];
  if(days>0&&(!m.startsAt||!Number.isFinite(Date.parse(m.startsAt))||
    Date.parse(m.startsAt)<nowMs-days*86400000||
    Date.parse(m.startsAt)>nowMs))return false;
  return true;
}
export function analyticsSeasons(records:AnalyticsFixture[]){
  return [...new Set(records.map(row=>row.startsAt&&Number.isFinite(Date.parse(row.startsAt))
    ?kabulDay(row.startsAt).slice(0,4):null).filter((year):year is string=>!!year))]
    .sort((a,b)=>b.localeCompare(a));
}
export function scopedTeamAnalytics(details:AnalyticsDetails,teamId:string,
  filters:AnalyticsFilters,nowMs:number=Date.now()){
  const matches=details.matches.filter(m=>isFinal(m)&&
    (m.homeTeamId===teamId||m.awayTeamId===teamId)&&inScope(m,filters,nowMs));
  const ids=new Set(matches.map(m=>m.id));
  const players=new Map<string,AnalyticsPlayer>();
  for(const row of details.players){
    if(!ids.has(row.matchId))continue;
    const p=players.get(row.userId)??{userId:row.userId,displayName:row.displayName,
      matches:0,goals:0,assists:0,yellowCards:0,redCards:0,cleanSheets:0,playerOfMatch:0};
    p.matches+=row.appeared?1:0;p.goals+=row.goals;p.assists+=row.assists;
    p.yellowCards+=row.yellowCards;p.redCards+=row.redCards;
    p.cleanSheets+=row.cleanSheet?1:0;p.playerOfMatch+=row.playerOfMatch?1:0;
    players.set(row.userId,p);
  }
  let wins=0,draws=0,losses=0,goalsFor=0,goalsAgainst=0;
  const trend:AnalyticsTrend[]=[];
  for(const match of matches){
    const home=match.homeTeamId===teamId;
    const our=home?match.homeScore:match.awayScore;
    const their=home?match.awayScore:match.homeScore;
    goalsFor+=our;goalsAgainst+=their;
    const result=our>their?"WIN":our===their?"DRAW":"LOSS";
    if(result==="WIN")wins++;else if(result==="DRAW")draws++;else losses++;
    if(match.startsAt&&Number.isFinite(Date.parse(match.startsAt)))
      trend.push({id:match.id,competitionId:match.competitionId,
        startsAt:match.startsAt,result,goalsFor:our,goalsAgainst:their});
  }
  trend.sort((a,b)=>b.startsAt.localeCompare(a.startsAt)||b.id.localeCompare(a.id));
  const stats:AnalyticsStats={played:matches.length,wins,draws,losses,goalsFor,goalsAgainst,
    goalDifference:goalsFor-goalsAgainst,winRate:matches.length?Math.round(wins*100/matches.length):0};
  return {stats,players:[...players.values()],trend:trend.slice(0,10),
    matchingCompetitionIds:new Set(matches.map(m=>m.competitionId))};
}
export function rankTeamPlayers(players:AnalyticsPlayer[],
  metric:"GOALS"|"ASSISTS"|"APPEARANCES"){
  const key=metric==="GOALS"?"goals":metric==="ASSISTS"?"assists":"matches";
  return [...players].sort((a,b)=>b[key]-a[key]||b.goals-a.goals||
    b.assists-a.assists||b.matches-a.matches||
    a.displayName.localeCompare(b.displayName)||a.userId.localeCompare(b.userId));
}
