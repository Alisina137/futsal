import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const screen=read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const ui=read("apps/mobile/src/components/competition/CompetitionProfileSections.tsx");
const stats=read("apps/mobile/src/lib/competition-detail-statistics.ts");
const repository=read("apps/api/src/modules/competition/competition.repository.ts");
const service=read("apps/api/src/modules/competition/competition.service.ts");
const contract=read("packages/contracts/src/index.ts");
const locale=read("packages/localization/src/index.ts");
const nav=read("apps/mobile/src/lib/competition-detail-navigation.ts");

for(const marker of [
 "function competitionTeamStatistics(","match.status!==\"COMPLETED\"&&match.status!==\"CORRECTED\"",
 "match.homeScore===null||match.awayScore===null","const home=results.get(match.homeTeamId)",
 "if(!home||!away)continue;","home.wins++;away.losses++;",
 "else{home.draws++;away.draws++;}","goalDifference:row.goalsFor-row.goalsAgainst",
 "competitionFairPlayStatistics(","if(!competition.teamDisciplineStats)return null;",
 "competitionPlayerLeaders(","accepted.has(stat.teamId)",
])assert.ok(stats.includes(marker),"Competition Phase 6 pure statistics invariant missing: "+marker);

for(const marker of [
 'testID="competition-team-stats"', 'testID="competition-fairplay-stats"',
 'competitionTeamStatistics(competition)', 'competitionFairPlayStatistics(competition)',
 'competitionPlayerLeaders(competition,metric,teamId)',
 'competition.detail.phase6.teamResultsHint','competition.detail.phase6.noFinalResults',
 'competition.detail.phase6.fairPlayDisclaimer','competition.detail.phase6.noCardReports',
 'competition.detail.phase6.fairPlayUnavailable',
 'team.offline?"text":"button"', 'key==="goalDifference"&&team[key]>0',
 'competition.detail.phase6.${key}',
])assert.ok(ui.includes(marker),"Competition Phase 6 functional UI missing: "+marker);

for(const marker of [
 'private async listTeamDiscipline(competitionId:string)',
 'eq(competitionTeams.status,"ACCEPTED")',
 'inArray(competitionMatches.status,["COMPLETED","CORRECTED"])',
 'eq(playerMatchStats.teamId,competitionMatches.homeTeamId)',
 'eq(playerMatchStats.teamId,competitionMatches.awayTeamId)',
 'yellowCards:Number(row.yellowCards??0)',
 'redCards:Number(row.redCards??0)',
 'this.listTeamDiscipline(competitionId)',
 'teamDisciplineStats,',
])assert.ok(repository.includes(marker),"Competition Phase 6 server discipline aggregation missing: "+marker);
const query=repository.split('private async listTeamDiscipline(competitionId:string)')[1]?.split('async getCompetitionDto(')[0]??"";
assert.ok(query&&!query.includes('playerProfiles')&&!query.includes('users.displayName')&&
 !query.includes('playerUserId')&&!query.includes('teamMemberships'),
 "Public disciplinary totals must include private-profile players without exposing player identity.");

for(const marker of [
 'teamDisciplineStats:competition.teamDisciplineStats?.filter(row=>acceptedIds.has(row.teamId))',
 'playerStats:competition.playerStats.filter(stat=>acceptedIds.has(stat.teamId))',
])assert.ok(service.includes(marker),"Competition Phase 6 public filtering missing: "+marker);
for(const marker of ['competitionTeamDisciplineDtoSchema','yellowCards:z.number().int().min(0)',
 'redCards:z.number().int().min(0)','teamDisciplineStats:z.array(competitionTeamDisciplineDtoSchema).optional()'])
 assert.ok(contract.includes(marker),"Competition Phase 6 response schema missing: "+marker);
for(const key of ["teamResultsHint","noFinalResults","fairPlayDisclaimer","noCardReports",
 "fairPlayUnavailable","yellowCards","redCards","played","wins","draws","losses",
 "goalsFor","goalsAgainst","goalDifference"]){
 const value='"competition.detail.phase6.'+key+'"';
 assert.equal(locale.split(value).length-1,3,"Missing EN/Dari/Pashto label "+key);
}
assert.ok(nav.includes('STATS:["TEAMS","PLAYERS","FAIR_PLAY"]')&&
 screen.includes('activeTab==="STANDINGS"||activeTab==="STATS"')&&
 screen.includes('refreshCompetitionPublic()'),
 "Keep Stats as a seven-tab subtab with safe refreshing.");
console.log("Competition Detail Phase 6: verified team WDL, privacy-safe card aggregates, player metric filtering and EN/Dari/Pashto.");
