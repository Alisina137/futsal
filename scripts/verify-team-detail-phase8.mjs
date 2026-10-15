import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const screen=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const server=read("apps/api/src/modules/team/team-manager-phase3.routes.ts");
const managerProfile=read("apps/api/src/modules/team/team-manager-phase1.routes.ts");
const nav=read("apps/mobile/src/lib/team-detail-navigation.ts");
const about=read("apps/mobile/src/lib/team-detail-about.ts");
const squad=read("apps/mobile/src/lib/team-detail-squad.ts");
const matches=read("apps/mobile/src/lib/team-detail-matches.ts");
const stats=read("apps/mobile/src/lib/team-detail-stats.ts");
const competition=read("apps/mobile/src/lib/team-detail-competitions.ts");
const actions=read("apps/mobile/src/lib/team-detail-actions.ts");

const strictAll=(haystack,tokens,label)=>tokens.forEach(token=>
  assert.ok(haystack.includes(token),label+" missing: "+token));

strictAll(screen,[
  'testID="team-profile-cover"',
  'testID={"team-main-tab-"+item.id}',
  'testID="team-tab-content"',
  'testID="team-squad-grid"',
  'testID="team-match-list"',
  'testID="team-competitions-list"',
  'testID="team-stat-overview"',
  'testID="team-verified-player-leaders"',
  'testID="team-about-overview"',
  'testID="team-about-membership"',
  'testID="team-detail-refresh"',
  'onPress={tab==="squad"||tab==="about"?()=>void load():refreshHighlights}',
  // Explicitly clear the old privileged roster, membership, public profiles and
  // gallery during every focus refresh / manual retry, not just user switches.
  'const generation=++loadGeneration.current;',
  'setTeam(null);setProfile(null);setMember(false);setPublicPlayerIds([]);',
  'setJoinStatus(null);setJoinAllowed(false);setPhoto(null);',
  'postsGeneration.current++;setHighlights(null);setOlderPosts([]);',
  'if(loadGeneration.current!==generation)return;',
  'return()=>{loadGeneration.current++;postsGeneration.current++;};',
  'if(lastActorIdentity.current!==actorIdentity||(team&&team.id!==id))',
  'mayOpenPublicPlayer(player.userId,publicPlayerIds)',
  'mayOpenTeamMemberArea({member,isManager:role==="MANAGER"})',
  'member&&team.captainUserId===session.user.id',
  'teamApi.requestJoin(session.accessToken,id)',
  'teamApi.cancelJoin(session.accessToken,id)',
  'if(action===joinActionSequence.current)setJoinStatus(result.request.status)',
  'if(action===joinActionSequence.current)setJoinStatus(null)',
  'formatCompetitionDateTime(',
  'accessibilityRole="tab"',
  'accessibilityState={{selected:tab===item.id}}',
  'accessibilityState={{selected:subs[tab]===key}}',
  'flexDirection:isRTL?"row-reverse"',
],"Team Detail Phase 8 screen");

strictAll(nav,['media:["posts","photos"]','squad:["players","leaders"]',
  'matches:["upcoming","results"]','competitions:["active","past"]',
  'stats:["overview","form","topPlayers"]','about:["overview","members"]'],
"all main and subtab navigation");
strictAll(squad,['canDisplayTeamRoster(','mayOpenPublicPlayer(',
  'member.userId===managerUserId||member.userId===captainUserId'],
"roster and role privacy");
strictAll(matches,['m.homeTeamId!==teamId&&m.awayTeamId!==teamId',
  'm.homeScore===null||m.awayScore===null','"COMPLETED"','"CORRECTED"'],
"verified team match records");
strictAll(competition,['teamCompetitionPhase(','if(status==="DRAFT")return null',
  'm.competitionId===competitionId&&(m.homeTeamId===teamId||m.awayTeamId===teamId)'],
"public competitions and fixture previews");
strictAll(stats,['teamRecentForm(','teamPlayerLeaders(',
  'match.homeTeamId!==teamId&&match.awayTeamId!==teamId'],
"verified stats");
strictAll(about,['teamAboutVenueLink(','mayOpenTeamMemberArea(',
  'return input.member||input.isManager'],
"public about and member area");
strictAll(actions,['if(!input.emailVerified)return "verifyEmail"',
  'if(input.hasAssignedRole)return "roleRestricted"',
  'if(!input.allowJoinRequests)return "invitationOnly"',
  'if(!/^\\+?[0-9]{7,15}$/.test(normalized))return null'],
"join and public contact gates");

strictAll(server,[
  'eq(socialPosts.status,"PUBLISHED")',
  'eq(socialPosts.visibility,"PUBLIC")',
  'eq(competitionTeams.status,"ACCEPTED")',
  'eq(competitions.published,true)',
  'eq(playerProfiles.visibility,"PUBLIC")',
  'eq(teamMemberships.status,"ACTIVE")',
  'eq(users.status,"ACTIVE")',
  'aggregateCompletedMatches(statsGames,teamId)',
  'aggregatePublicPlayerStats(playerScores)',
], "public team backend");
strictAll(managerProfile,[
  'team.privacy!=="PUBLIC"',
  'const {allowJoinRequests:_,whatsappGroupUrl:_invite,...publicFields}=details',
],"published team profile");

// Three-language Team Detail copy must continue to contain each tab,
// selected subtab, role action and retry. These are the user-facing routes
// taken during E2E smoke and are required for EN, Dari and Pashto.
const localeBody=screen.split('const words:')[1]?.split("export default function TeamDetailExperience")[0]??"";
const allUserVisibleKeys=[
  "media","squad","matches","competitions","stats","about",
  "players","leaders","upcoming","results","active","past","overview",
  "form","topPlayers","members","refresh","retry",
  "joinDescription","aboutMemberStatus","aboutMemberPending",
  "aboutMemberSignIn","aboutMemberVerify","aboutPrivateLinks",
  "statsSnapshot","statsLeaderNote","compConfirmed",
];
for(const key of allUserVisibleKeys)
  assert.equal(localeBody.split(key+":").length,4,
    "Missing EN / Dari / Pashto localized label: "+key);

const cases=read("scripts/tests/team-detail-phase8-regression.test.mjs");
assert.ok(cases.includes("visitor/unverified/assigned-role")&&
  cases.includes("private roster")&&cases.includes("published competitions")&&
  cases.includes("empty and degraded"),"Phase 8 must test cross-role and empty states");
console.log("Team Detail Phase 8 release gate: six tabs, EN/Dari/Pashto, private refresh, backend privacy, safe routes and cross-feature regression.");
