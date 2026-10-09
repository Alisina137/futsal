import fs from "node:fs";
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const check=(value,why)=>{if(!value)throw Error(why);};
const page=read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const sections=read("apps/mobile/src/components/competition/CompetitionProfileSections.tsx");
const directory=read("apps/mobile/src/components/social/CompetitionDirectoryExperience.tsx");
const about=read("apps/mobile/app/(app)/competitions/[competitionId]/about.tsx");
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
  &&sections.includes('match.status==="IN_PROGRESS"?0:'),
  "Results must not mix with upcoming/live matches.");
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
check(page.includes("competitionApi.register")&&page.includes('focusRegistration==="1"?"TEAMS"')
  &&page.includes('activeTab!=="TEAMS"')&&page.includes("contentY.current+y")
  &&page.includes("toggleFollow")&&page.includes('marketingApi.socialFollowState'),
  "Registration deep links must go to Teams and retain authentic follow and manager validation.");
check(page.includes('pathname:"/competitions/[competitionId]/about"')
  &&about.includes('competitionApi.get(competitionId)')
  &&about.includes("competition.registrationClosesAt")===false
  &&about.includes("data.registrationClosesAt")
  &&about.includes("data.matchDurationMinutes")
  &&about.includes("data.registrationFeeAfn")
  &&about.includes("data.groupCount")
  &&about.includes("data.qualifiersPerGroup")
  &&about.includes("data.winPoints")&&about.includes("data.drawPoints")&&about.includes("data.lossPoints")
  &&about.includes("data.tieBreakOrder")&&about.includes("data.championTeamId"),
  "The separate About page must show all publicly available competition information, not a shortened Home summary.");
check(sections.includes('testID="competition-home-feed"')
  &&sections.includes('match.status==="IN_PROGRESS"')
  &&sections.includes('live.length>0?<View testID="competition-live-scoreboard"')
  &&sections.includes('updates.map(post=>')
  &&!sections.includes("posts.slice(0,5)")
  &&!sections.includes("competition.profile.latestResults")
  &&!sections.includes("competition.profile.nextMatches")
  &&!sections.includes("function Home({competition,posts,registration"),
  "Home must display all competition posts and only currently live matches, never dedicated Results/Matches sections or registration.");
check(sections.includes('return <CompetitionTeams competition={competition} registration={registration}/>')
  &&sections.includes('{registration}')
  &&directory.includes('tab:"TEAMS",focusRegistration:"1"'),
  "Registration must render under Teams and all registration shortcuts must open that tab.");
check(page.includes("setInterval(()=>void refreshScore(),25000)")
  &&page.includes('AppState.currentState!=="active"')
  &&page.includes('activeTab!=="HOME"')
  &&page.includes("appState.remove()"),
  "Live scores must refresh only while the foreground Home profile is focused and clean up timers.");
check(directory.includes('tab:"STANDINGS"'),"Competition standings quick actions should open the tab inside the profile.");
for(const key of ["competition.profile.tab.HOME","competition.profile.tab.RESULTS","competition.profile.tab.MATCHES",
  "competition.profile.tab.STANDINGS","competition.profile.tab.STATS","competition.profile.tab.TEAMS",
  "competition.profile.stages","competition.profile.groupStage","competition.profile.knockoutStage",
  "competition.profile.allPosts","competition.profile.liveNow","competition.profile.liveBadge",
  "competition.profile.registrationInfo","competition.profile.hostVenue","competition.profile.tieBreakOrder"]){
  check(localization.split(`"${key}"`).length-1===3,`Missing English/Dari/Pashto: ${key}`);
}
for(const [name,tab] of [["standings","STANDINGS"],["bracket","STANDINGS"],["stats","STATS"],["teams","TEAMS"]]){
  const legacy=read(`apps/mobile/app/(app)/competitions/[competitionId]/${name}.tsx`);
  check(legacy.includes("return <Redirect href=")&&legacy.includes(`tab:"${tab}"`)
    &&legacy.includes("competitionId"),`Legacy ${name} deep links should open their new profile tab.`);
  if(name==="bracket")check(legacy.includes('stage:"KNOCKOUT"'),
    "Legacy bracket must open the knockout stage directly.");
}
console.log("Public competition profile verified: venue-style identity, six functional tabs, dedicated About page, all-posts Home with live-only scores, Teams-only registration, format-aware stages, follower state and localization.");
