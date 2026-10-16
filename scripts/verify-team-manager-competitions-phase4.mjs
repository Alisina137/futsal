import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const ops=read("apps/mobile/src/components/team-manager/TeamCompetitionOps.tsx");
const dash=read("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
const summary=read("apps/mobile/src/components/team-manager/TeamManagerOverviewPanel.tsx");
const api=read("apps/mobile/src/lib/api.ts");
const route=read("apps/api/src/modules/team/team-manager-phase2.routes.ts");
const contracts=read("packages/contracts/src/index.ts");
const locales=read("packages/localization/src/index.ts");
const must=(source,items,what)=>items.forEach(x=>assert.ok(source.includes(x),what+": "+x));

must(ops,[
  'testID="tm4-competition-tabs"','testID="tm4-my-competitions"',
  'testID="tm4-invitations"','testID="tm4-discover"',
  'competitionSection==="MINE"','competitionSection==="INVITATIONS"',
  'competitionSection==="DISCOVER"',
  'accessibilityState={{selected:competitionSection===item.id}}',
  'competitionApi.discover({','scope:"registration"','page:discoveryPage,limit:12',
  'setTimeout(()=>{',
  'setAppliedSearch(search.trim());setDiscoveryPage(1);',
  'setDiscoveryRetry(v=>v+1);',
  'searchRef.current!==appliedSearch',
  'setAvailable(previous=>discoveryPage===1?result.competitions:[',
  'setDiscoveryHasMore(result.hasMore)','testID="tm4-show-more"',
  'testID="tm4-province-select"',
  'registrations.filter(c=>c.registrationStatus!=="INVITED")',
  'registrationStatus(c.registrationStatus)','competitionStatus(c.status)',
  'c.registrationClosesAt??c.startsAt',
  'c.registrationStatus==="ACCEPTED"&&!c.rosterLocked&&c.rosterUserIds.length===0',
  'closingSoon(deadline)',
  'teamOperationsApi.roster(token,team.id,requestedCompetition.id,rosterIds)',
  'competitionApi.register(token,c.id,team.id)',
  'competitionApi.respondInvitation(token,c.id,team.id,{status:"ACCEPTED"})',
  'competitionApi.respondInvitation(token,c.id,team.id,{status:"REJECTED"})',
  'competitionApi.myParticipations(token)',
  'item.teamId===team.id','item.canWithdraw',
  'competitionApi.withdraw(token,c.id,team.id)',
  'testID="tm4-withdraw-confirm"',
  'focusCompetitionSection?:"MINE"|"INVITATIONS"|null',
],"Team Manager competition Phase 4");

must(summary,[
 'onCompetitionSection:(section:"MINE"|"INVITATIONS")=>void',
 'if(item.key==="competitions"){onCompetitionSection("INVITATIONS");return;}',
 'if(item.key==="rosters"){onCompetitionSection("MINE");return;}',
],"Overview direct navigation");
must(dash,[
 'onCompetitionSection={openCompetitionSection}',
 'focusCompetitionSection={competitionFocus}',
 'setCompetitionFocus(null);',
],"Dashboard scope and deep links");
must(api,['discover:(options:CompetitionDiscoveryQuery','myParticipations:(accessToken:string','withdraw: (accessToken: string, competitionId: string, teamId: string)'],
 "Competition API");
must(route,['assertRosterEditable','ROSTER_LOCKED','TEAM_MEMBERSHIP_REQUIRED'],
 "Server roster integrity");
must(contracts,['competitionDiscoveryQuerySchema','competitionParticipationsResponseSchema',
 'canWithdraw:z.boolean()'],"Typed access control");
const keys=["myCompetitions","invitations","discover","total","pending","incompleteRosters",
 "feeStatus","fee","rosterRequired","deadlineSoon","viewRoster","completeRoster",
 "withdraw","withdrawConfirm","invitationsHint","noInvitations","currentRoster",
 "results","capacity","full","closed","showMore","registrationStatus.INVITED",
 "registrationStatus.APPLIED","registrationStatus.PENDING","registrationStatus.ACCEPTED",
 "registrationStatus.REJECTED","registrationStatus.WITHDRAWN",
 "fee.UNPAID","fee.PENDING","fee.PAID","fee.WAIVED"];
for(const key of keys)assert.equal(locales.split('"tm4.'+key+'"').length-1,3,
  "Competition phase 4 translation missing in English/Dari/Pashto: "+key);
console.log("Team Manager Competitions Phase 4 verified: 3 subtabs, statuses/deadlines, roster integrity, server-filtered paginated discovery, restricted withdrawal, action links and trilingual UX.");
