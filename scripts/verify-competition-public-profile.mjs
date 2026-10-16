import fs from "node:fs";
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const check=(value,why)=>{if(!value)throw Error(why);};
const page=read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const sections=read("apps/mobile/src/components/competition/CompetitionProfileSections.tsx");
const stats=read("apps/mobile/src/lib/competition-detail-statistics.ts");
const directory=read("apps/mobile/src/components/social/CompetitionDirectoryExperience.tsx");
const about=read("apps/mobile/app/(app)/competitions/[competitionId]/about.tsx");
const localization=read("packages/localization/src/index.ts");
const leagueBoard=read("apps/mobile/src/components/competition/LeagueStandingsTable.tsx");
const matchList=read("apps/mobile/src/components/competition/CompetitionMatchList.tsx");
const detail=read("apps/mobile/app/(app)/competitions/[competitionId]/matches/[matchId].tsx");
check(page.includes('testID="competition-public-profile"')&&page.includes("mediaPosts.find(post=>post.imageUrl)")
  &&page.includes('Ionicons name="trophy"')&&page.includes("styles.avatarFrame")&&page.includes("styles.cover"),
  "Competition identity must show a cover/avatar like a venue profile, with real media or an honest fallback.");
check(page.includes('testID="competition-profile-tabs"')
  &&page.includes("COMPETITION_PROFILE_TABS.map")
  &&page.includes('testID={`competition-tab-${value}`}')
  &&page.includes("height:64,minHeight:64,maxHeight:64")&&page.includes("flexGrow:0,flexShrink:0"),
  "Compact five-tab scrolling navigation must have stable 64px height and accessible selection.");
check(page.includes("tabPositions.current.set(value,{x,width})")
  &&page.includes("tabScrollRef.current?.scrollTo({x,animated})")
  &&page.includes("focusSelectedTab(activeTab")
  &&page.includes("focusSelectedTab(next,true)"),
  "Active competition profile navigation should scroll to its selected tab, including deep links and RTL.");
check(sections.includes('"HOME","MATCHES","STANDINGS","STATS","TEAMS"')
  &&!sections.includes('"HOME","RESULTS","MATCHES"')
  &&!sections.includes('activeTab==="RESULTS"')
  &&sections.includes("CompetitionMatchList")&&sections.includes("CompetitionStandings")
  &&sections.includes("CompetitionStats")&&sections.includes("CompetitionTeams"),
  "Five distinct competition tabs required; no redundant Results tab.");
check(matchList.includes('filter==="FINISHED"?done(match)')
  &&matchList.includes('match.status==="IN_PROGRESS"')
  &&matchList.includes('match.status==="COMPLETED"||match.status==="CORRECTED"')
  &&matchList.includes('testID="competition-matches-list"')
  &&!matchList.includes("onlyResults")&&!matchList.includes('"competition-results-list"'),
  "All completed and corrected results must be available only through Matches > Finished.");
check(sections.includes('competition.format==="GROUP_KNOCKOUT"')
  &&sections.includes('competition.format==="KNOCKOUT"')
  &&sections.includes('testID={`competition-stage-${option}`}')
  &&sections.includes('match.stage==="KNOCKOUT"')&&sections.includes('LeagueStandingsTable'),
  "League, knockout, and group+knockout formats must show appropriate standings/stages.");
check(sections.includes('competition.format==="LEAGUE"')&&sections.includes("<LeagueStandingsTable")
  &&leagueBoard.includes('testID="league-scrollable-stats"'),
  "League standings must keep teams fixed and make statistics horizontally swipeable.");
check(sections.includes('testID="competition-stat-metrics"')
  &&sections.includes('testID="competition-stat-team-filter"')
  &&sections.includes('"goals","assists","appearances"')&&stats.includes('b[metric]-a[metric]')
  &&stats.includes('accepted.has(stat.teamId)')
  &&sections.includes('competitionPlayerLeaders(competition,metric,activeTeamId)')
  &&sections.includes('pathname:"/players/[playerId]"'),
  "Goal and assist leaderboards must support compact metric/team selectors and player links.");
check(sections.includes('team.status==="ACCEPTED"')&&sections.includes("resolveMediaImageUrl(team.logoUrl)")
  &&sections.includes('pathname:"/teams/[teamId]"'),
  "Teams tab must list accepted teams with real logos and accessible details.");
check(page.includes("competitionApi.register")&&page.includes('focusRegistration==="1"?"TEAMS"')
  &&page.includes('activeTab!=="TEAMS"')&&page.includes("contentY.current+y")
  &&page.includes("toggleFollow")&&page.includes('marketingApi.socialFollowState'),
  "Registration deep links must go to Teams and retain authentic follow and manager validation.");
check(page.includes('activeTab!=="ABOUT"')
  &&sections.includes('testID="competition-about-overview"')
  &&sections.includes('testID="competition-phase7-information"')
  &&sections.includes('testID="competition-phase7-rules"')
  &&sections.includes('testID="competition-phase7-prizes"')
  &&sections.includes('testID="competition-phase7-venue"')
  &&about.includes('competitionApi.get(competitionId)')
  &&about.includes("data.rewards.filter(")
  &&about.includes("formatCompetitionDateTime(")
  &&about.includes("data.registrationClosesAt")
  &&about.includes("data.matchDurationMinutes")
  &&about.includes("data.registrationFeeAfn")
  &&about.includes("data.groupCount")
  &&about.includes("data.qualifiersPerGroup")
  &&about.includes("data.winPoints")&&about.includes("data.drawPoints")&&about.includes("data.lossPoints")
  &&about.includes("tieBreakOrder.map(")&&about.includes("data.championTeamId"),
  "About must show all four sections together without a sub-navigation, while older full-About links remain usable.");
check(sections.includes('testID="competition-home-feed"')
  &&sections.includes('match.status==="IN_PROGRESS"')
  &&sections.includes('live.length>0?<View testID="competition-live-scoreboard"')
  &&sections.includes('updates.map(post=>')
  &&!sections.includes("posts.slice(0,5)")
  &&!sections.includes("competition.profile.latestResults")
  &&!sections.includes("competition.profile.nextMatches")
  &&!sections.includes("function Home({competition,posts,registration"),
  "Home must display all competition posts and only currently live matches, never dedicated Results/Matches sections or registration.");
check(sections.includes('if(activeTab==="TEAMS")return <CompetitionTeams competition={competition}')
  &&sections.includes('view={subtab??"PARTICIPANTS"}')
  &&sections.includes('view!=="PARTICIPANTS"')
  &&page.includes('testID="competition-registration-experience"')
  &&directory.includes('tab:"TEAMS",focusRegistration:"1"'),
  "Distinct Teams subtabs must isolate private registration from public participants; old entry links must work.");
check(page.includes("setInterval(()=>void refreshScore(),25000)")
  &&page.includes('AppState.currentState!=="active"')
  &&page.includes('"HOME","MATCHES","STANDINGS","STATS"')
  &&page.includes("appState.remove()")
  &&page.includes("actor!==lastActorIdentity.current||generation!==loadGeneration.current"),
  "Live scores must refresh safely for Home, Matches and standing/stats tabs while in the foreground.");
check(directory.includes('tab:"STANDINGS"'),"Competition standings quick actions should open the tab inside the profile.");
check(page.includes('if(input==="RESULTS")return "MATCHES"')
  &&page.includes('initialMatchFilter={extraMatchStatus??(tab==="RESULTS"||selectedSubtab==="RESULTS"?"FINISHED":"ALL")}'),
  "Old Results URLs must still open the Finished filter under Matches.");
for(const key of ["competition.profile.tab.HOME","competition.profile.tab.MATCHES",
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
console.log("Public competition profile verified: venue-style identity, consolidated in-profile About, legacy full-About links, all-posts Home, Teams-only registration, format-aware stages, follower state and localization.");
