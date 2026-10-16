import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const list=read("apps/mobile/app/(app)/owner/competitions/index.tsx");
const insights=read("apps/mobile/src/components/owner/OwnerCompetitionOperations.tsx");
const logic=read("apps/mobile/src/lib/owner-competition-management.ts");
const organizer=read("apps/mobile/app/(app)/owner/competitions/[competitionId]/manage.tsx");
const nav=read("apps/mobile/src/lib/owner-dashboard-navigation.ts");
const offline=read("apps/mobile/app/(app)/owner/manual-teams.tsx");
const api=read("apps/mobile/src/lib/api.ts");
const locale=read("packages/localization/src/index.ts");
const check=(s,items,label)=>{
 for(const marker of items)assert.ok(s.includes(marker),label+" missing "+marker);
};
check(list,['testID="owner-phase5-competition-controls"',
  'selectOwnerCompetitions(safeItems','group:"ALL",status:filter,format,query,order:"NEXT"',
  'competitionApi.ownerList(token)','const safeItems=loadedToken===token?items:[]',
  'useFocusEffect(useCallback(()=>','serial.current++','AppState.currentState==="active"',
  '<OwnerCompetitionOperations','router.push("/owner/manual-teams")',
  'router.push("/owner/competitions/create")',
  'filters.map((value)','accessibilityState={{selected:filter===value}}',
  'onPress={()=>{setFilter(value);setSelectedId(null);}}',
  't("owner.phase5.showOperations")'], "Venue Owner competition list");
for(const removed of ["ownerCompetitionGroups.map","ownerCompetitionOrders.map",
  "owner-phase5-group-",'t("owner.phase5.sortBy")',"setGroup(","setOrder("]){
  assert.ok(!list.includes(removed),"removed duplicate group/sort control: "+removed);
}
for(const status of ["ALL","IN_PROGRESS","REGISTRATION_OPEN","REGISTRATION_CLOSED",
  "COMPLETED","DRAFT","SCHEDULED","ARCHIVED","CANCELLED"]){
  assert.ok(list.includes('"'+status+'"'),"status filter option missing: "+status);
}
check(insights,['competitionApi.ownerGet(token,competitionId)',
  'const visible=loadedKey===key?detail:null','if(request!==requestId.current)return',
  'ownerCompetitionOperations(visible,Date.now())',
  'params:{competitionId,tab}','go("TEAMS")','go("FIXTURES")',
  'router.push("/owner/manual-teams")', 'testID="owner-phase5-operations"'],
  "lazy private operations");
check(logic,['team.status==="APPLIED"||team.status==="PENDING"',
  'team.status==="ACCEPTED"','match.status==="IN_PROGRESS"',
  'match.status==="POSTPONED"','!match.refereeUserId',
  'acceptedTeams:accepted.length','pendingApplications:awaiting.length'],
  "authoritative status projections");
check(organizer,['function requestedControlTab(', 'value==="FIXTURES"?"FIXTURES"',
  'value==="TEAMS"?"TEAMS":"OVERVIEW"','setActiveTab(requestedControlTab(tab))',
  'competitionApi.decideRegistration(','competitionApi.inviteTeam(',
  'manualTeamApi.register('],"existing organizer workflow");
check(nav,['href:"/owner/competitions"','href:"/owner/manual-teams"'],
  "shell");
check(offline,['manualTeamApi.create(','manualTeamApi.update('],
  "offline-team management");
check(api,['ownerList: (accessToken: string)','ownerGet: (accessToken: string, competitionId: string)'],
  "server owner-authorized reads");
for(const key of ["title","search","searchHint","group.ALL","group.REGISTRATION",
  "group.ACTIVE","group.DRAFTS","group.FINISHED","sortBy","order.NEXT",
  "order.LATEST","order.NAME","allFormats","newCompetition","operations",
  "privateDetails","detailsError","pendingApplications","acceptedTeams",
  "unassignedFixtures","nextMatch","noUpcomingMatches","reviewTeams",
  "openFixtures","showOperations","hideOperations"]){
 assert.equal(locale.split('"owner.phase5.'+key+'"').length-1,3,
   "missing English, Dari or Pashto owner competition string: "+key);
}
const pkg=JSON.parse(read("package.json"));
assert.ok(pkg.scripts["verify:owner-dashboard-phase5"]?.includes("venue-owner-dashboard-phase5.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:owner-dashboard-phase5"));
console.log("Venue Owner Dashboard Phase 5 verified: live private organizers, single status navigation, application/fixture workflow, safe roster ownership and 3 locales.");
