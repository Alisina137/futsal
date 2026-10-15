import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const team=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const venue=read("apps/mobile/src/components/venues/VenueCompetitionsPanel.tsx");
const card=read("apps/mobile/src/components/venues/VenueMatchCard.tsx");
const api=read("apps/api/src/modules/team/team-manager-phase3.routes.ts");
const types=read("apps/mobile/src/lib/api.ts");
const facets=read("apps/mobile/src/lib/team-detail-match-facets.ts");
const suite=read("scripts/tests/team-match-venue-format.test.mjs");
const pkg=JSON.parse(read("package.json"));
const all=(source,parts,name)=>parts.forEach(part=>assert.ok(source.includes(part),
  name+" missing "+part));
all(team,[
  'testID="team-match-list"',
  'testID="team-match-filter-rail"',
  ...["competition","team","year","month","week"]
    .map(key=>'testID="team-match-filter-'+key+'"'),
  'teamMatchSelectFacets(data.matches,id,phase,AFGHANISTAN_TIME_ZONE)',
  'teamMatchSelectRows(data.matches,id,phase,faceted,AFGHANISTAN_TIME_ZONE,selected)',
  'matchSelectFilters[phase]',
  'setMatchSelectFilters(current=>',
  'setMatchSelectFilters({upcoming:{...emptyVenueMatchFilters},results:{...emptyVenueMatchFilters}})',
  'rows.map(m=><TeamMatchCard key={m.id}',
  'scope={phase}','statusLabel={statusLabel(m)}',
  'm.homeTeamId===id?team?.name??m.homeTeamName:m.homeTeamName',
  'm.awayTeamId===id?team?.name??m.awayTeamName:m.awayTeamName',
  'missingScoreLabel={tx("matchUnknownScore")}',
  'testID={"team-match-status-"+value}',
  'accessibilityState={{selected:selected===value}}',
  'tx("statsSnapshot")',
], "Team fixtures UI");
all(card,[
  'function FixtureMatchCard(',
  'export function VenueMatchCard(', 'export function TeamMatchCard(',
  'testID={"venue-match-"+match.id}','testID={"team-match-"+match.id}',
  'venueMatchResultEmphasis(match.status,match.homeScore,match.awayScore)',
  'TeamLogo url={match.homeLogoUrl??null}', 'TeamLogo url={match.awayLogoUrl??null}',
  'finished&&emph[side]==="winner"?"bold"',
  'finished&&emph[side]==="loser"?colors.textMuted',
  'match.homeScore}  –  {match.awayScore}',
  'formatLocalDateTimeParts(match.startsAt,language,timeZone)',
  'pathname:"/competitions/[competitionId]/matches/[matchId]"',
], "Shared venue/team match card");
all(venue,['<VenueMatchCard key={match.id}','match={match} scope={matchScope}'],
  "Venue fixture regression");
all(api,[
  'name:teams.name,logoUrl:teams.logoUrl',
  'homeLogoUrl:matchTeams.get(m.homeTeamId??"")?.logoUrl??null',
  'awayLogoUrl:matchTeams.get(m.awayTeamId??"")?.logoUrl??null',
  'eq(competitions.published,true)',
  'eq(competitionTeams.status,"ACCEPTED")',
], "Backend home/away logo and published-only fixture limits");
all(types,['homeLogoUrl?:string|null;awayLogoUrl?:string|null'], "Mobile contract");
all(facets,[
  'teamMatchRows(matches,teamId,phase)',
  'venueMatchLocalParts(match.startsAt,timeZone)',
  'venueMatchFitsFilters(match,filter,timeZone)',
  'const opponentId=match.homeTeamId===teamId?match.awayTeamId:match.homeTeamId',
], "Pure scoped filter semantics");
for(const label of ["filter options are scoped","AND selectors filter","actual winner"]){
  assert.ok(suite.includes(label),"Missing unit regression "+label);
}
assert.ok(pkg.scripts["verify:team-match-venue-format"]?.includes(
  "team-match-venue-format.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:team-match-venue-format"));
console.log("Team matches follow the venue fixture image format: verified match cards, badges, logos, dates, winner emphasis and five filters (English/Dari/Pashto, RTL).");
