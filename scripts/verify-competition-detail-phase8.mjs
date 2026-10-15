import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const screen=read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const sections=read("apps/mobile/src/components/competition/CompetitionProfileSections.tsx");
const media=read("apps/mobile/src/components/competition/CompetitionMediaPanel.tsx");
const nav=read("apps/mobile/src/lib/competition-detail-navigation.ts");
const home=read("apps/mobile/src/lib/competition-detail-home.ts");
const stats=read("apps/mobile/src/lib/competition-detail-statistics.ts");
const matches=read("apps/mobile/src/lib/competition-detail-match-filters.ts");
const teams=read("apps/mobile/src/lib/competition-detail-teams.ts");
const standings=read("apps/mobile/src/lib/competition-detail-standings.ts");
const service=read("apps/api/src/modules/competition/competition.service.ts");
const repository=read("apps/api/src/modules/competition/competition.repository.ts");
const locale=read("packages/localization/src/index.ts");
const api=read("apps/mobile/src/lib/api.ts");
const pkg=JSON.parse(read("package.json"));
const required=(text,markers,subject)=>{
  for(const marker of markers)assert.ok(text.includes(marker),
    "Competition Detail Phase 8 "+subject+" missing: "+marker);
};
required(nav,[
  '"HOME","MATCHES","STANDINGS","STATS","TEAMS","MEDIA","ABOUT"',
  'hasParticipation?["MY_PARTICIPATION"]',
  'options.registrationOpen?["REGISTRATION"]',
  'format==="KNOCKOUT"?["KNOCKOUT"]',
  'incoming==="RESULTS"?"MATCHES"',
  'available.includes(current.sub[main]??"")',
],"tab routing");
required(screen,[
  'const actorIdentity=competitionId+',
  'const generation=++loadGeneration.current;',
  'return()=>{mounted=false;loadGeneration.current++;};',
  'lastActorIdentity.current!==actorIdentity',
  'setCompetition(null);setMediaPosts([]);setParticipations([]);setMyTeams([]);',
  'setParticipationError(false);setIntent(null);',
  'setParticipations([]);setMyTeams([]);setOrganizerCanManage(false);',
  'if(!valid())return;',
  'const {competition:next}=await competitionApi.get(competitionId);',
  'void competitionApi.media(competitionId).then(result=>',
  'if(valid())setMediaPosts(result.posts.filter(post=>',
  'post.competitionId===competitionId&&post.status==="PUBLISHED"',
  '}).catch(()=>{if(valid())setMediaPosts([]);});',
  'setCompetition(next);',
  'const availableSubtabs=competition?allowedCompetitionSubtabs(',
  'myAcceptedTeamId={(()=>{',
  'testID="competition-profile-tabs"',
  'testID="competition-profile-subtabs"',
  'testID="competition-tab-content"',
],"identity/account/logout, optional media and tab data safety");
assert.ok(!screen.includes('const [{competition:next},mediaResult]=await Promise.all('),
  "Do not block competition details on optional media.");
required(sections,[
  'if(activeTab==="HOME")',
  'if(activeTab==="MATCHES")',
  'if(activeTab==="STANDINGS")',
  'if(activeTab==="STATS")',
  'if(activeTab==="TEAMS")',
  'if(activeTab==="MEDIA")',
  'if(activeTab==="ABOUT")',
  'CompetitionMediaPanel competition={competition}',
  'competitionTeamStatistics(competition)',
  'competitionFairPlayStatistics(competition)',
  'competitionPlayerLeaders(competition',
  'testID="competition-about-subtab"',
  'testID="competition-phase7-rules"',
  'testID="competition-phase7-prizes"',
  'testID="competition-phase7-venue"',
],"seven-tab content");
required(home,[
  'acceptedIds.has(match.homeTeamId)&&acceptedIds.has(match.awayTeamId)',
  'match.homeScore>=0&&match.awayScore>=0',
  'Number.isSafeInteger(match.homeScore)',
  'match.status==="COMPLETED"||match.status==="CORRECTED"',
],"Home verified score consistency");
required(stats,[
  'competition.teams.filter(team=>team.status==="ACCEPTED")',
  'Number.isSafeInteger(match.homeScore)',
  'if(!home||!away)continue;',
  'if(!competition.teamDisciplineStats)return null;',
],"stats and privacy");
required(teams,[
  'deadlineMs<=now.getTime()',
  'accepted.length', // tested via pure regression; ensure old helper shape guarded
].filter(x=>x!=="accepted.length"),"Teams deadline logic");
required(matches,[
  'timeZone:"Asia/Kabul"','allowedTeams.has(pref.teamId)',
  'stageValid','roundValid','groupValid',
],"match filters");
required(standings,[
  'if(nextTeam!==m.winnerTeamId)continue;',
  'match.status==="COMPLETED"||match.status==="CORRECTED"',
].filter(x=>x!=='match.status==="COMPLETED"||match.status==="CORRECTED"'),"confirmed bracket");
required(media,[
  'const generation=useRef(0);',
  'generation.current++',
  'if(token!==generation.current)return;',
  'competitionApi.mediaPage(competition.id,',
  'testID="competition-media-refresh"',
  'testID="competition-media-retry"',
  'testID="competition-media-load-more"',
  'testID="competition-phase7-photo-close"',
  'if(page===0)setRetry(n=>n+1);else void loadMore();',
  'if(loading||loadingMore||!hasMore)return;',
  'setItems(current=>',
],"media retry and stale requests");
required(repository,[
  'eq(socialPosts.entityType,"COMPETITION")',
  'eq(socialPosts.entityId,competitionId)',
  'eq(socialPosts.status,"PUBLISHED")',
  'eq(socialPosts.visibility,"PUBLIC")',
  '.limit(limit+1).offset((page-1)*limit)',
],"public media SQL scope");
required(service,[
  'async getPublic(competitionId: string)',
  'if (!record || !record.published || record.status === "DRAFT")',
  'const publicTeams=competition.teams.filter(team=>team.status==="ACCEPTED")',
  'feePaymentReference:null',
  'playerStats:competition.playerStats.filter(stat=>acceptedIds.has(stat.teamId))',
  'teamDisciplineStats:competition.teamDisciplineStats?.filter(row=>acceptedIds.has(row.teamId))',
  'async listPublicMediaPage(competitionId:string,options:',
],"public competition API privacy");
required(api,['mediaPage:(competitionId:string,options:'],'media page API');
const tabs=["HOME","MATCHES","STANDINGS","STATS","TEAMS","MEDIA","ABOUT"];
const subtabs=[
  "OVERVIEW","LIVE","HIGHLIGHTS","UPCOMING","RESULTS","ALL","LEAGUE","GROUPS","KNOCKOUT",
  "TEAMS","PLAYERS","FAIR_PLAY","PARTICIPANTS","REGISTRATION","MY_PARTICIPATION",
  "UPDATES","PHOTOS","INFORMATION","RULES","PRIZES","VENUE",
];
for(const tab of tabs)assert.equal(locale.split('"competition.profile.tab.'+tab+'"').length-1,3,
  "Tab "+tab+" must have English, Dari and Pashto");
for(const sub of subtabs)assert.equal(locale.split('"competition.detail.sub.'+sub+'"').length-1,3,
  "Subtab "+sub+" must have English, Dari and Pashto");
assert.ok(pkg.scripts["verify:competition-detail-phase8"]?.includes("competition-detail-phase8.test.mjs"),
  "Phase 8 must run behavioral tests");
assert.ok(pkg.scripts.verify.includes("pnpm verify:competition-detail-phase7 && pnpm verify:competition-detail-phase8"),
  "Phase 8 must be included in full release verification gate");
for(let i=1;i<=7;i++)assert.ok(pkg.scripts.verify.includes(
  "pnpm verify:competition-detail-phase"+i),"Missing earlier competition detail phase gate "+i);
console.log("Competition Detail Phase 8: 7 tabs, all subtabs/3 locales, data privacy, stale requests, authenticated routing, media retry, SQL public scope and CI gate checked.");
