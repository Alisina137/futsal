import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const page=read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const parts=read("apps/mobile/src/components/competition/CompetitionProfileSections.tsx");
const repo=read("apps/api/src/modules/competition/competition.repository.ts");
const locale=read("packages/localization/src/index.ts");
const nav=read("apps/mobile/src/lib/competition-detail-navigation.ts");
for(const token of [
 'const generation=++loadGeneration.current;',
 'const valid=()=>generation===loadGeneration.current;',
 'if(!valid())return;',
 'return()=>{mounted=false;loadGeneration.current++;};',
 'setParticipations([]);setMyTeams([]);setOrganizerCanManage(false);',
 'setParticipationError(false);setIntent(null);',
 'if(loading||lastActorIdentity.current!==actorIdentity)',
 'if(mounted&&actor===lastActorIdentity.current)setFollowState(value)',
 'testID="competition-profile-subtabs"',
 'chooseCompetitionSubtab(',
 'resolvedCompetitionSubtab(navigation,activeTab,availableSubtabs)',
 'allowedCompetitionSubtabs(activeTab,competition.format,',
 'initialMatchFilter={extraMatchStatus??(tab==="RESULTS"||selectedSubtab==="RESULTS"?"FINISHED":"ALL")}',
 ])assert.ok(page.includes(token),"Profile race/navigation guard missing: "+token);
for(const token of ['"MEDIA","ABOUT"','CompetitionMediaPanel competition={competition}','competition-about-subtab',
 'competition-team-stats','competition-fairplay-stats','subtab==="KNOCKOUT"',
 'subtab==="UPCOMING"','subtab==="LIVE"','subtab==="RESULTS"',
])assert.ok(parts.includes(token),"Public tabs must have functioning content: "+token);
for(const token of [
 '.innerJoin(playerProfiles, eq(playerMatchStats.playerUserId, playerProfiles.userId))',
 '.innerJoin(playerProfiles,eq(playerMatchStats.playerUserId,playerProfiles.userId))',
 'eq(playerProfiles.visibility,"PUBLIC")',
 'eq(teamMemberships.status,"ACTIVE")',
 'eq(users.status,"ACTIVE")',
 'publicDisplayName: row.publicDisplayName,',
 'publicDisplayName:row.publicDisplayName,',
])assert.ok(repo.includes(token),"Private player identity protection missing: "+token);
assert.ok(!repo.includes('publicDisplayName: row.publicDisplayName ?? row.fallbackName')&&
 !repo.includes('publicDisplayName:row.publicDisplayName??row.fallbackName'),
 "Do not publish account display names as private-profile fallbacks.");
for(const key of ["MEDIA","ABOUT"])assert.equal(locale.split('"competition.profile.tab.'+key+'"').length-1,3,
 "Missing localized main tab "+key);
for(const key of ["OVERVIEW","LIVE","HIGHLIGHTS","UPCOMING","RESULTS","ALL","LEAGUE",
 "GROUPS","KNOCKOUT","TEAMS","PLAYERS","FAIR_PLAY","PARTICIPANTS","REGISTRATION",
 "MY_PARTICIPATION","UPDATES","PHOTOS","INFORMATION","RULES","PRIZES","VENUE"])
 assert.equal(locale.split('"competition.detail.sub.'+key+'"').length-1,3,
   "Missing English/Dari/Pashto subtab "+key);
assert.ok(nav.includes('incoming==="RESULTS"?"MATCHES"')&&
 nav.includes('format==="KNOCKOUT"?["KNOCKOUT"]')&&
 nav.includes('hasParticipation?["MY_PARTICIPATION"]'),
 "Legacy routes and format-specific navigation invariants missing.");
console.log("Competition Detail Phase 1: player privacy, stale request safety and seven contextual tabs verified.");
