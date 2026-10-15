import type {TeamPublicHighlights} from "./api";
import type {PublicTeamMatch} from "./team-detail-matches";

export type PublicTeamPlayerStats=TeamPublicHighlights["stats"]["players"][number];
export type TeamPlayerStatMetric="goals"|"assists"|"appearances";
export type RecentTeamResult={
  match:PublicTeamMatch;outcome:"win"|"draw"|"loss";
  ourGoals:number;theirGoals:number;opponentName:string;
};

const timestamp=(value:string|null)=>{
  if(!value)return -Infinity;
  const parsed=Date.parse(value);
  return Number.isFinite(parsed)?parsed:-Infinity;
};

/** A bounded *fixture snapshot* supplies recent form, not the all-time aggregate. */
export function teamRecentForm(
  matches:readonly PublicTeamMatch[],teamId:string,limit=5,
):RecentTeamResult[]{
  return matches.flatMap((match):RecentTeamResult[]=>{
    if(!["COMPLETED","CORRECTED"].includes(match.status)||
      match.homeScore===null||match.awayScore===null||
      (match.homeTeamId!==teamId&&match.awayTeamId!==teamId))return [];
    const home=match.homeTeamId===teamId;
    const own=home?match.homeScore:match.awayScore;
    const rival=home?match.awayScore:match.homeScore;
    const outcome:RecentTeamResult["outcome"]=own===rival?"draw":own>rival?"win":"loss";
    return [{match,outcome,
      ourGoals:home?match.homeScore:match.awayScore,
      theirGoals:home?match.awayScore:match.homeScore,
      opponentName:home?match.awayTeamName:match.homeTeamName,
    }];
  }).sort((a,b)=>timestamp(b.match.startsAt)-timestamp(a.match.startsAt)||
    a.match.id.localeCompare(b.match.id)).slice(0,Math.max(0,Math.floor(limit)));
}

/** Server sends the union of its top 20 public players per metric. Only rank
 * *within that authorized candidate set*; no private member is materialized. */
export function teamPlayerLeaders(
  players:readonly PublicTeamPlayerStats[],metric:TeamPlayerStatMetric,limit=20,
):PublicTeamPlayerStats[]{
  const rest:TeamPlayerStatMetric[]=metric==="goals"?["assists","appearances"]:
    metric==="assists"?["goals","appearances"]:["goals","assists"];
  return [...players].sort((a,b)=>b[metric]-a[metric]||
    b[rest[0]!]-a[rest[0]!]||b[rest[1]!]-a[rest[1]!]||
    a.displayName.localeCompare(b.displayName)||a.userId.localeCompare(b.userId))
    .slice(0,Math.max(0,Math.floor(limit)));
}

/** Prevent a corrupt/NaN API percentage from breaking a progress bar. */
export function safeTeamWinRate(percent:number):number{
  return Number.isFinite(percent)?Math.min(100,Math.max(0,percent)):0;
}

export function teamResultBreakdown(
  stats:Pick<TeamPublicHighlights["stats"],"played"|"wins"|"draws"|"losses">,
){
  const played=Number.isFinite(stats.played)?Math.max(0,stats.played):0;
  if(!played)return {win:0,draw:0,loss:0};
  const bounded=(value:number)=>Number.isFinite(value)?
    Math.min(100,Math.max(0,value/played*100)):0;
  return {win:bounded(stats.wins),draw:bounded(stats.draws),loss:bounded(stats.losses)};
}
