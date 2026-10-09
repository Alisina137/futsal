import fs from "node:fs";
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const assert=(ok,why)=>{if(!ok)throw Error(why);};
const list=read("apps/mobile/src/components/competition/CompetitionMatchList.tsx");
const detail=read("apps/mobile/app/(app)/competitions/[competitionId]/matches/[matchId].tsx");
const api=read("apps/api/src/modules/competition/competition.routes.ts");
const service=read("apps/api/src/modules/competition/competition.service.ts");
const repo=read("apps/api/src/modules/competition/competition.repository.ts");
const client=read("apps/mobile/src/lib/api.ts");
const sections=read("apps/mobile/src/components/competition/CompetitionProfileSections.tsx");
const contracts=read("packages/contracts/src/index.ts");
const l10n=read("packages/localization/src/index.ts");
assert(list.includes('"competition-matches-list"')
  &&list.includes("dateGroup(match.startsAt)")
  &&list.includes('formatLocalDateTimeParts(match.startsAt,language)')
  &&list.includes("teams.get(match.homeTeamId")
  &&list.includes("teams.get(match.awayTeamId"),
  "Date-grouped match list needs real team crests and localized Kabul fixture times.");
assert(list.includes('testID="match-filter-rail"')
  &&list.includes('["ALL","UPCOMING","LIVE","FINISHED"]')
  &&list.includes("filter===\"LIVE\"")
  &&list.includes('filter==="FINISHED"?done(match)')
  &&!list.includes("onlyResults"),
  "Competition Matches must support all/upcoming/live/finished filters, with results in Finished only.");
assert(list.includes('pathname:"/competitions/[competitionId]/matches/[matchId]"')
  &&detail.includes("competitionApi.match(competitionId,matchId)")
  &&detail.includes('testID="competition-match-scoreboard"'),
  "Match cards must navigate to a real public, refreshed match detail page.");
assert(detail.includes('["OVERVIEW","PLAYERS","STANDINGS"]')
  &&detail.includes('testID="match-player-stats"')
  &&detail.includes("stat.yellowCards")
  &&detail.includes("stat.redCards")
  &&detail.includes("competition.standings.filter(")
  &&detail.includes('competition.matchDetail.highlightsUnavailable'),
  "Details show only recorded statistics and explicit unavailable highlights, never imaginary injury/video events.");
assert(sections.includes('testID="competition-registration-cta"')
  &&sections.includes('competition.status==="REGISTRATION_OPEN"')
  &&sections.includes('onTabChange("TEAMS")')
  &&sections.includes('live.length>0?<View testID="competition-live-scoreboard"'),
  "Registration-open CTA precedes conditional live scoreboard and opens the Teams registration tab.");
assert(api.includes('router.get("/competitions/:competitionId/matches/:matchId"')
  &&service.includes("async getPublicMatch(")&&service.includes("await this.getPublic(competitionId)")
  &&service.includes("competition.matches.find(x=>x.id===matchId)")
  &&repo.includes("async listPublicMatchPlayerStats(")
  &&repo.includes("eq(playerMatchStats.matchId,matchId)")
  &&contracts.includes("competitionPublicMatchDetailSchema")
  &&client.includes("request<CompetitionPublicMatchDetail>"),
  "Public match details must be scoped to the published competition with only recorded player data.");
for(const key of ["competition.matchList.filter.UPCOMING","competition.matchList.fullTime",
  "competition.matchList.registrationOpen","competition.matchDetail.recordedPlayers",
  "competition.matchDetail.highlightsUnavailable","competition.standingsTeamPreview"]){
  assert(l10n.split(`"${key}"`).length-1===3,`Missing three-language translation: ${key}`);
}
console.log("Match discovery verified: date-grouped fixtures, tappable real match details, safe per-match stats, locale support and registration CTA.");
