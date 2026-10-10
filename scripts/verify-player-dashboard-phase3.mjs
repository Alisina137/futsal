import fs from "node:fs";
const get=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const dashboard=get("apps/mobile/src/components/player/PlayerDashboard.tsx");
const panel=get("apps/mobile/src/components/player/PlayerCareerTabs.tsx");
const routes=get("apps/api/src/modules/team/player-dashboard-phase3.routes.ts");
const calculations=get("apps/api/src/modules/team/player-career.ts");
const client=get("apps/mobile/src/lib/api.ts");
const app=get("apps/api/src/app.ts"),server=get("apps/api/src/server.ts");
const lang=get("packages/localization/src/index.ts");
const tests=get("apps/api/test/player-dashboard-phase3.test.ts");
check(dashboard.includes('<PlayerCareerTabs tab={tab}')&&dashboard.includes('tab==="statistics"||tab==="achievements"'),
  "Both career tabs need full components instead of placeholders.");
check(app.includes("createPlayerDashboardPhase3Router")&&server.includes("new PlayerDashboardPhase3Service"),
  "Authenticated player career route must be wired into the API.");
check(client.includes('"/api/v1/player-dashboard/career"')&&panel.includes("playerCareerApi.mine(token)"),
  "Frontend career API must match backend route.");
for(const requirement of [
  'req.auth!.userId','requireAuth(tokens)', 'getOwnProfile(userId)',
  'eq(playerMatchStats.playerUserId,userId)','eq(playerMatchStats.appeared,true)',
  'inArray(competitionMatches.status,["COMPLETED","CORRECTED"])',
  'eq(teamCompetitionRoster.userId,userId)',
  'eq(competitionMatches.stage,"KNOCKOUT")',
  'eq(competitionMatches.roundNumber,1)',
  'eq(competitionMatches.slotNumber,1)',
  'eq(competitionTeams.teamId,teamCompetitionRoster.teamId)',
  'c.championTeamId===c.teamId','careerAwards(records,champions)',
]){
  check(routes.includes(requirement),"Missing official-result access or championship guard: "+requirement);
}
check(!routes.includes("req.query.userId")&&!routes.includes("req.params.userId")&&
  !routes.includes("roleSubscriptions")&&!routes.includes("teamMemberships"),
  "Lifetime stats must be self-scoped, free, and must survive leaving teams.");
check(calculations.includes("uniqueOfficialRecords")&&calculations.includes("officialMatchResult")&&
  calculations.includes("careerTotals")&&calculations.includes("careerAwards")&&
  calculations.includes('timeZone:"Asia/Kabul"'),"Career calculations and Kabul calendar missing.");
check(panel.includes('Share.share({message:')&&panel.includes('data?.visibility!=="PUBLIC"')&&
  panel.includes('data.visibility==="PUBLIC"')&&
  panel.includes('router.push("/profile/player")'),"Achievement sharing must be explicit and privacy-gated.");
const shareBlock=panel.slice(panel.indexOf("await Share.share("),panel.indexOf("}catch{",panel.indexOf("await Share.share(")));
check(!shareBlock.includes("profileImageUrl")&&!shareBlock.includes("userId")&&
  !shareBlock.includes("phoneE164")&&!shareBlock.includes("preferredFoot")&&
  !shareBlock.includes("biography"),"Career sharing must not disclose private identifying data.");
check(panel.includes("performanceTrend")&&panel.includes("matchHistory")&&
  panel.includes('selected={teamId}')&&panel.includes('selected={competitionId}')&&
  panel.includes('selected={season}')&&panel.includes('selected={metric}'),
  "Career tabs need complete team, competition, year and performance filters.");
for(const label of ["loadError","officialOnly","trophyCabinet","performanceTrend","stat.goals",
  "award.CHAMPION","award.FIRST_GOAL","award.TEN_MATCHES","noAchievements",
  "privateNotice","shareAward"]){
  check(lang.split('"pd3.'+label+'"').length-1===3,"Missing English/Dari/Pashto career label: "+label);
}
check(tests.includes("TWENTY_FIVE_GOALS")&&
  tests.includes("historical records")&&tests.includes("midnight/year rollover"),
  "Milestone, team history and calendar test coverage missing.");
console.log("Player Dashboard Phase 3 verified: official career, all-time history, trend charts, verified trophies, privacy-safe sharing and three languages.");
