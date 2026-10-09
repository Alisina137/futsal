import fs from "node:fs";
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const check=(value,why)=>{if(!value)throw Error(why);};
const page=read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const sections=read("apps/mobile/src/components/competition/CompetitionProfileSections.tsx");
const directory=read("apps/mobile/src/components/social/CompetitionDirectoryExperience.tsx");
const localization=read("packages/localization/src/index.ts");
check(page.includes('testID="competition-public-profile"')&&page.includes("mediaPosts.find(post=>post.imageUrl)")
  &&page.includes('Ionicons name="trophy"')&&page.includes("styles.avatarFrame")&&page.includes("styles.cover"),
  "Competition identity must show a cover/avatar like a venue profile, with real media or an honest fallback.");
check(page.includes('testID="competition-profile-tabs"')
  &&page.includes("COMPETITION_PROFILE_TABS.map")
  &&page.includes('testID={`competition-tab-${value}`}')
  &&page.includes("height:64,minHeight:64,maxHeight:64")&&page.includes("flexGrow:0,flexShrink:0"),
  "Compact six-tab scrolling navigation must have stable 64px height and accessible selection.");
check(sections.includes('"HOME","RESULTS","MATCHES","STANDINGS","STATS","TEAMS"')
  &&sections.includes("CompetitionMatches")&&sections.includes("CompetitionStandings")
  &&sections.includes("CompetitionStats")&&sections.includes("CompetitionTeams"),
  "Six distinct competition sections required.");
check(sections.includes('match.status==="COMPLETED"||match.status==="CORRECTED"')
  &&sections.includes('match.status==="IN_PROGRESS"?0:')
  &&sections.includes('onTabChange("RESULTS")')&&sections.includes('onTabChange("MATCHES")'),
  "Results must not mix with upcoming/live matches, and the Home previews must navigate.");
check(sections.includes('competition.format==="GROUP_KNOCKOUT"')
  &&sections.includes('competition.format==="KNOCKOUT"')
  &&sections.includes('testID={`competition-stage-${option}`}')
  &&sections.includes('match.stage==="KNOCKOUT"')&&sections.includes('StandingTable'),
  "League, knockout, and group+knockout formats must show appropriate standings/stages.");
check(sections.includes('testID={`competition-stats-${value}`}')
  &&sections.includes('b.goals-a.goals')&&sections.includes('b.assists-a.assists')
  &&sections.includes('pathname:"/players/[playerId]"'),
  "Goal and assist leaderboards must be separately sortable and link to player profiles.");
check(sections.includes('team.status==="ACCEPTED"')&&sections.includes("resolveMediaImageUrl(team.logoUrl)")
  &&sections.includes('pathname:"/teams/[teamId]"'),
  "Teams tab must list accepted teams with real logos and accessible details.");
check(page.includes("competitionApi.register")&&page.includes("focusRegistration")
  &&page.includes("contentY.current+y")&&page.includes("toggleFollow")
  &&page.includes('marketingApi.socialFollowState'),
  "Registration deep links and real follow state must work on the Home profile.");
check(directory.includes('tab:"STANDINGS"'),"Competition standings quick actions should open the tab inside the profile.");
for(const key of ["competition.profile.tab.HOME","competition.profile.tab.RESULTS","competition.profile.tab.MATCHES",
  "competition.profile.tab.STANDINGS","competition.profile.tab.STATS","competition.profile.tab.TEAMS",
  "competition.profile.stages","competition.profile.groupStage","competition.profile.knockoutStage"]){
  check(localization.split(`"${key}"`).length-1===3,`Missing English/Dari/Pashto: ${key}`);
}
for(const [name,tab] of [["standings","STANDINGS"],["bracket","STANDINGS"],["stats","STATS"],["teams","TEAMS"]]){
  const legacy=read(`apps/mobile/app/(app)/competitions/[competitionId]/${name}.tsx`);
  check(legacy.includes("return <Redirect href=")&&legacy.includes(`tab:"${tab}"`)
    &&legacy.includes("competitionId"),`Legacy ${name} deep links should open their new profile tab.`);
  if(name==="bracket")check(legacy.includes('stage:"KNOCKOUT"'),
    "Legacy bracket must open the knockout stage directly.");
}
console.log("Public competition profile verified: venue-style identity, six functional tabs, live results/matches, format-aware stages, goal/assist stats, accepted teams, registration, followed state and localization.");
