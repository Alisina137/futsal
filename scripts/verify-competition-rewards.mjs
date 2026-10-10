import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const check=(truth,description)=>{if(!truth)throw Error(description);};
const schema=read("packages/database/src/schema.ts");
const migration=read("packages/database/drizzle/0023_competition_rewards.sql");
const journal=read("packages/database/drizzle/meta/_journal.json");
const contracts=read("packages/contracts/src/index.ts");
const service=read("apps/api/src/modules/competition/competition.service.ts");
const repo=read("apps/api/src/modules/competition/competition.repository.ts");
const routes=read("apps/api/src/modules/competition/competition.routes.ts");
const owner=read("apps/mobile/app/(app)/owner/competitions/[competitionId]/manage.tsx");
const manager=read("apps/mobile/src/components/competition/CompetitionRewardsManager.tsx");
const about=read("apps/mobile/app/(app)/competitions/[competitionId]/about.tsx");
const dates=read("apps/mobile/src/lib/date-time.ts");
const locales=read("packages/localization/src/index.ts");
const tests=read("apps/api/test/competition-rewards.test.ts");

check(schema.includes('rewards:jsonb("rewards")')
  &&migration.includes('ADD COLUMN "rewards" jsonb NOT NULL DEFAULT')
  &&journal.includes('"tag": "0023_competition_rewards"'),
  "Rewards must persist in the production competition table and preserve existing competitions with an empty list.");
check(contracts.includes("competitionRewardSchema=z.object({")
  &&contracts.includes('category:z.enum(["TEAM","INDIVIDUAL"])')
  &&contracts.includes("rewards:z.array(competitionRewardSchema).max(30)")
  &&contracts.includes('title:z.string().trim().min(2).max(90)')
  &&contracts.includes('prize:z.string().trim().min(2).max(240)')
  &&contracts.includes('rewards:z.array(competitionRewardSchema)'),
  "Team and individual reward announcements need typed DTOs, bounds and validated write schemas.");
check(routes.includes('router.put("/competitions/:competitionId/rewards",auth,writeLimiter')
  &&routes.includes("competitionRewardsUpdateRequestSchema.parse(request.body)")
  &&service.includes("async replaceRewards(")
  &&service.includes("await this.ownerCompetition(ownerUserId,competitionId)")
  &&service.includes('"ARCHIVED","CANCELLED"')
  &&repo.includes("patch.rewards = input.rewards"),
  "Reward updates must be authenticated, scoped to authorized venue owners, validated, lock archived/cancelled competitions and persist.");
check(owner.includes('key:"REWARDS"')
  &&owner.includes("CompetitionRewardsManager")
  &&manager.includes("competitionApi.replaceRewards")
  &&manager.includes("setDirty(true)")
  &&manager.includes("editing===null")
  &&manager.includes("reward.category===kind"),
  "Competition organizers need a usable add/edit/remove/save manager for both reward categories.");
check(about.includes('t("competition.rewards.title")')
  &&about.includes('data.rewards.length===0')
  &&about.includes("data.rewards.filter(")
  &&about.includes("reward.prize")
  &&about.includes("reward.description"),
  "About page must show truthful announced prizes grouped by teams and individuals with empty states.");
check(about.includes("formatCompetitionDateTime(")
  &&dates.includes("export function formatCompetitionDateTime(")
  &&dates.includes('timeZone:AFGHANISTAN_TIME_ZONE')
  &&dates.includes('minute:"2-digit"')
  &&!dates.slice(dates.indexOf("export function formatCompetitionDateTime("),
    dates.indexOf("export function formatLocalDateTimeParts(")).includes("timeZoneName"),
  "About schedule needs localized Kabul date and clock time without seconds or GMT+4:30.");
for(const k of ["competition.rewards.title","competition.rewards.category.TEAM",
  "competition.rewards.category.INDIVIDUAL","competition.rewards.publish",
  "competition.rewards.saveError","competition.control.tabs.REWARDS"]){
  check(locales.split(`"${k}"`).length-1===3,`Missing English, Dari or Pashto rewards label: ${k}`);
}
check(tests.includes("rejects different-venue owner")
  &&tests.includes("max thirty and duplicate titles")
  &&tests.includes("getPublic(created.id)"),
  "Rewards must have API permission, validation and publication regression tests.");
console.log("Competition rewards verified: public About prizes, owner-only management, DB persistence, localized compact dates and validated categories.");
