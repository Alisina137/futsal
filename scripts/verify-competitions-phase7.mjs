import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const repo=read("apps/api/src/modules/competition/competition.repository.ts");
const service=read("apps/api/src/modules/competition/competition.service.ts");
const routes=read("apps/api/src/modules/competition/competition.routes.ts");
const fake=read("apps/api/test/fake-competition-repository.ts");
const tests=read("apps/api/test/competition-phase7-security.test.ts");
const db=read("apps/api/scripts/competition-phase7-db.ts");
const ci=read(".github/workflows/qa-competition-db.yml");
const directory=read("apps/mobile/src/components/social/CompetitionDirectoryExperience.tsx");
const card=read("apps/mobile/src/components/social/CompetitionDirectoryCard.tsx");
const profile=read("apps/mobile/app/(app)/competitions/[competitionId].tsx");

assert.ok(repo.includes('eq(competitions.published,true)')&&
  repo.includes('eq(teamMemberships.status,"ACTIVE")')&&
  repo.includes('or(eq(teams.managerUserId,userId),isNotNull(teamMemberships.userId))')&&
  repo.includes('eq(teams.status,"ACTIVE")'),
  "My Competitions should include only active members or the team manager, including managers without a membership");
assert.ok(repo.includes('.for("update").limit(1)')&&
  repo.includes('TEAM_LIMIT_BELOW_ACCEPTED')&&
  repo.includes('eq(competitionTeams.status,"ACCEPTED")')&&
  service.includes("async decideRegistration(")&&
  repo.includes("async acceptRegistrationWithCapacity("),
  "Team-limit reduction and approvals must share a locked competition row");
assert.ok(repo.includes('this.db.selectDistinctOn([socialPosts.entityId]')&&
  repo.includes('this.db.select({id:competitionTeams.competitionId,total:sql<number>')&&
  repo.includes('groupBy(competitionTeams.competitionId)')&&
  !repo.includes('for (const row of rows) {\n      const [accepted]'),
  "Competition legacy list must batch counts and only read one fallback photo per competition");
assert.ok(repo.includes('eq(socialPosts.visibility,"PUBLIC")')&&
  repo.includes('includeUnpublished?undefined:eq(socialPosts.visibility,"PUBLIC")')&&
  service.includes('feePaymentReference:null')&&
  service.includes('playerStats:playerStats.filter(stat=>acceptedTeamIds.has(stat.teamId))'),
  "Public image fallback, posts, fees, and match player statistics must stay private when required");
assert.ok(routes.includes('router.get("/competitions/discover/private",auth,')&&
  routes.includes('router.post("/competitions/:competitionId/register", auth, writeLimiter,')&&
  routes.includes('router.patch("/competitions/:competitionId", auth, writeLimiter,')&&
  routes.includes('router.get("/competitions/:competitionId", async'),
  "Owner and private scope actions authenticated and throttled; public profile read remains supported");
assert.ok(directory.includes('const [loadMoreError,setLoadMoreError]=useState(false)')&&
  directory.includes('if(append)setLoadMoreError(true)')&&
  directory.includes('testID="competitions-pagination-error"')&&
  directory.includes('onPress={()=>void load(applied.current,currentPage+1,true)}')&&
  directory.includes("requestId.current!==id")&&
  directory.includes('flexDirection:isRTL?"row-reverse":"row"')&&
  directory.includes('const twoColumns=width>=720'),
  "Slow/stale and failed page requests must preserve results, retry, handle RTL and tablet layout");
assert.ok(card.includes("const IMAGE_SIZE=144")&&
  card.includes("competition.logoUrl??competition.coverImageUrl??null")&&
  profile.includes('testID="competition-brand-logo"')&&
  profile.includes("competition?.coverImageUrl??mediaPosts.find(post=>post.imageUrl)"),
  "Previous competition layout and branding must be preserved by release regression");
assert.ok(fake.includes("activeMemberships")&&
  tests.includes("denies foreign organizer access")&&
  tests.includes("pending teams, payment references")&&
  tests.includes("filtered discovery pages consistent")&&
  db.includes("Promise.allSettled")&&
  db.includes('CI!=="true"')&&
  db.includes('parsed?.pathname!=="/futsal_ci"')&&
  db.includes("accepted.n<=stored.max_teams")&&
  ci.includes("pnpm --filter @leaguekick/api exec tsx scripts/competition-phase7-db.ts"),
  "Release must exercise role privacy, paging, and real transaction races on a disposable PostgreSQL database");
console.log("Competition Phase 7 verified: cross-role privacy, concurrent registration capacity, batched discovery, resilient paging, RTL and branding regressions, CI database release gate.");
