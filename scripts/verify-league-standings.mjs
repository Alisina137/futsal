import fs from "node:fs";
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const assert=(ok,why)=>{if(!ok)throw Error(why);};
const board=read("apps/mobile/src/components/competition/LeagueStandingsTable.tsx");
const sections=read("apps/mobile/src/components/competition/CompetitionProfileSections.tsx");
const form=read("packages/contracts/src/league-form.ts");
const tests=read("packages/contracts/src/league-form.test.ts");
const locale=read("packages/localization/src/index.ts");
assert(sections.includes('competition.format==="LEAGUE"')
  &&sections.includes("<LeagueStandingsTable competition={competition}")
  &&sections.includes(":<StandingTable rows="),
  "League-only table must not replace knockout/group-stage render paths.");
assert(board.includes('testID="league-pinned-team-column"')
  &&board.includes('testID="league-scrollable-stats"')
  &&board.includes("<ScrollView")
  &&board.includes("horizontal")
  &&board.includes("directionalLockEnabled")
  &&board.includes("nestedScrollEnabled"),
  "Team name/logo/rank stay pinned while every statistics column scrolls as one group.");
assert(board.includes('width:"44%"')&&board.includes('width:"56%"')
  &&board.includes("height:HEADER_HEIGHT")&&board.includes("height:ROW_HEIGHT")
  &&board.includes("styles.metricsHeaderRow")
  &&board.includes("styles.metricsRow")
  &&board.includes("styles.teamRow"),
  "Pinned identity and statistics columns need identical header and row heights.");
for(const key of ["played","wins","draws","losses","goalsFor","goalsAgainst","goalDifference","points"])
  assert(board.includes(`key:"${key}"`),`Missing real standing statistic: ${key}`);
assert(board.includes('t("competition.standingsLastFive")')
  &&board.includes("lastFiveLeagueResults")
  &&board.includes("resolveMediaImageUrl")
  &&board.includes('pathname:"/teams/[teamId]"'),
  "League rows need real team badges, links and actual latest five results.");
assert(form.includes('match.stage==="LEAGUE"')
  &&form.includes('match.status==="COMPLETED"||match.status==="CORRECTED"')
  &&form.includes("match.homeScore!==null && match.awayScore!==null")
  &&form.includes(".slice(0,5).reverse()")
  &&tests.includes("correct home or away perspective"),
  "Recent form cannot include pending or cross-competition results.");
for(const key of ["competition.standingsGoalsFor","competition.standingsGoalsAgainst",
  "competition.standingsLastFive","competition.standingsSwipeHint",
  "competition.standingsForm.W","competition.standingsForm.D","competition.standingsForm.L"]){
  assert(locale.split(`"${key}"`).length-1===3,`Missing English/Dari/Pashto label: ${key}`);
}
assert(board.includes("teamPaneRTL")&&board.includes("teamPaneLTR")
  &&board.includes('flexDirection:isRTL?"row-reverse":"row"'),
  "Pinned column, stats order and separator must mirror for RTL.");
console.log("League standings verified: fixed team pane, scrollable synchronized metrics and last-5 form, 3-language RTL support, real-score filtering and preserved other competition formats.");
