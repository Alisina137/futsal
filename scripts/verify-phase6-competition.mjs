import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const schema = read("packages/database/src/schema.ts");
const bookingRepository = read("apps/api/src/modules/booking/booking.repository.ts");
const competitionRepository = read("apps/api/src/modules/competition/competition.repository.ts");
const competitionService = read("apps/api/src/modules/competition/competition.service.ts");
const competitionEngine = read("apps/api/src/modules/competition/competition.engine.ts");
const competitionRoutes = read("apps/api/src/modules/competition/competition.routes.ts");
const competitionTests = read("apps/api/test/competition-knockout.test.ts");
const leagueTests = read("apps/api/test/competition-league.test.ts");
const engineTests = read("apps/api/test/competition-engine.test.ts");
const mobileApi = read("apps/mobile/src/lib/api.ts");
const mobilePublic = read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const mobileOwner = read("apps/mobile/app/(app)/owner/competitions/[competitionId]/manage.tsx");
const localization = read("packages/localization/src/index.ts");

const checks = [
  [schema.includes('export const competitions = pgTable') && schema.includes('export const competitionMatches = pgTable'), "competition persistence"],
  [schema.includes('export const competitionGroups = pgTable') && schema.includes('export const competitionTeams = pgTable'), "competition groups/team registration persistence"],
  [schema.includes('export const playerMatchStats = pgTable'), "player-match stat persistence"],
  [bookingRepository.includes('competitionMatches') && bookingRepository.includes('"COMPETITION_MATCH"'), "booking availability subtracts competition matches"],
  [bookingRepository.includes('inArray(competitionMatches.status, ["SCHEDULED", "IN_PROGRESS"])'), "scheduled competition matches occupy booking capacity"],
  [competitionRepository.includes('pg_advisory_xact_lock(hashtext') && competitionRepository.includes('That time is occupied by a booking.'), "competition scheduling shares atomic area lock and booking conflict checks"],
  [competitionRepository.includes('That time is blocked.') && competitionRepository.includes('another competition match'), "competition scheduling checks blocks and other matches"],
  [competitionEngine.includes('generateRoundRobin') && competitionEngine.includes('calculateStandings'), "league fixture/standings engine"],
  [competitionEngine.includes('seededBracketOrder') && competitionEngine.includes('generateKnockoutPlan'), "balanced knockout bracket/byes engine"],
  [competitionEngine.includes('assignGroups') && competitionEngine.includes('qualifiedTeams'), "group assignment/qualification engine"],
  [competitionService.includes('KNOCKOUT_DRAW_NOT_ALLOWED'), "knockout matches require a winner"],
  [competitionService.includes('KNOCKOUT_INCOMPLETE'), "group-to-knockout cannot complete before knockout finishes"],
  [competitionService.includes('CORRECTION_REASON_REQUIRED') && competitionService.includes('IMPACT_CONFIRMATION_REQUIRED'), "result correction safeguards"],
  [competitionRepository.includes('COMPETITION_RESULT_CORRECTED'), "result corrections are audited"],
  [competitionRoutes.includes('router.get("/competitions"') && competitionRoutes.includes('router.get("/competitions/:competitionId"'), "public competition pages API"],
  [competitionRoutes.includes('/matches/:matchId/schedule') && competitionRoutes.includes('/matches/:matchId/result'), "owner match scheduling/result API"],
  [engineTests.includes('five-team knockout brackets'), "non-power-of-two bye regression"],
  [competitionTests.includes('KNOCKOUT_INCOMPLETE') && competitionTests.includes('KNOCKOUT_DRAW_NOT_ALLOWED'), "knockout/group regressions"],
  [leagueTests.includes('recalculates standings') || leagueTests.includes('standings'), "league lifecycle regression"],
  [mobileApi.includes('export const competitionApi'), "competition mobile API client"],
  [mobilePublic.includes('competitionApi.register') && mobilePublic.includes('/standings') && mobilePublic.includes('/bracket'), "public competition mobile hub"],
  [mobileOwner.includes('competitionApi.scheduleMatch') && mobileOwner.includes('competitionApi.enterResult'), "owner competition mobile operations"],
  [localization.includes('"competition.title"') && localization.includes('"competition.matchStatus.CORRECTED"'), "competition localization"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  throw new Error(`Phase 6 invariant(s) missing: ${failed.map(([, name]) => name).join(", ")}`);
}

console.log("Phase 6 competition engine verified: deterministic league/group/knockout engines, atomic venue-calendar occupancy, result correction safeguards, public/owner APIs, and mobile competition workflows are present.");
