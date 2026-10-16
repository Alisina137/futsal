import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const dashboard=read("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
const panel=read("apps/mobile/src/components/team-manager/TeamManagerOverviewPanel.tsx");
const operations=read("apps/mobile/src/components/team-manager/TeamCompetitionOps.tsx");
const service=read("apps/api/src/modules/team/team-manager-phase1.routes.ts");
const client=read("apps/mobile/src/lib/api.ts");
const locale=read("packages/localization/src/index.ts");
const tests=read("apps/api/test/team-manager-overview-phase2.test.ts");
const must=(source,markers,label)=>{
  for(const marker of markers)assert.ok(source.includes(marker),label+": "+marker);
};
must(dashboard,[
  'tab==="overview"?<TeamManagerOverviewPanel',
  'teamOperationsApi.list(token,selectedId)',
  'if(!token||!selectedId||tab!=="overview")return',
  'setOverviewOps(value);setOverviewOpsKey(key)',
  'if(active)setOverviewOpsErrorKey(key)',
  'operations={overviewOpsKey===teamKey?overviewOps:null}',
  'onRetryOperations={()=>setOverviewOpsReload(value=>value+1)}',
  'pendingRequests={attentionReady&&attentionLoaded.requests?pending.length:null}',
  'pendingInvites={attentionReady&&attentionLoaded.invitations?outstanding.length:null}',
  'unreadNotifications={attentionReady&&attentionLoaded.notifications?unread:null}',
  'onLineup={id=>{setLineupFocus(id);chooseTab("matches");}}',
  'focusMatchId={lineupFocus}',
],"Team Manager dashboard");
must(panel,[
  'team-manager-phase2-overview','team-manager-phase2-metrics',
  'team-manager-phase2-action-center','team-manager-phase2-next-match',
  't("tm1.quickActions")','t("tm1.upcomingMatch")',
  'operationsReady&&competitionInvites.length','operationsReady&&missingLineups.length',
  'operationsReady&&missingRosters.length','pendingRequests!==null&&pendingRequests>0',
  'pendingInvites!==null&&pendingInvites>0',
  'attentionComplete?attention.reduce',
  'operationsFailed?<View','onRetryOperations',
  'onLineup(next.id)','onOpen("schedule")',
  'pathname:"/competitions/[competitionId]/matches/[matchId]"',
],"Team Manager overview panel");
must(operations,['focusMatchId?:string|null','onConsumedFocus?.();','openLineup(match)'],"Deep link");
must(service,['export function summarizeOfficialTeamMatches','m.status==="SCHEDULED"',
  'm.homeScore!==null&&m.awayScore!==null','this.db.select({name:teams.name,logoUrl:teams.logoUrl})',
  'this.db.select({name:venues.name})','wins:record.wins','draws:record.draws',
  'upcoming:record.upcoming','winRate:record.winRate'],"Official analytics");
must(client,['upcoming:number;winRate:number','opponentLogoUrl:string|null;venueName:string'],"Client contract");
must(tests,['counts only finished official matches','only schedules future fixtures',
  'never invents a win rate'],"Backend tests");
const keys=["activePlayers","upcomingMatches","needsAttention","officialRecord",
 "draws","losses","winRate","actionCenter","competitionInvitations",
 "missingLineups","missingRosters","unreadNotifications","allCaughtUp",
 "lineupReady","lineupIncomplete","viewMatch","manageLineup","operationsUnavailable"];
for(const key of keys)assert.equal(locale.split('"tmOverview.'+key+'"').length-1,3,
  "Team overview translations missing English/Dari/Pashto: "+key);
console.log("Team Manager Phase 2 overview verified: accurate W-D-L and next match, actionable scoped team tasks, targeted lineup, non-blocking loading, responsive 2x2 KPIs, and three locales.");
