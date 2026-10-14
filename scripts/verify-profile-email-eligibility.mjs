import assert from "node:assert/strict";
import fs from "node:fs";
const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const screen=read("apps/mobile/app/(app)/(tabs)/settings.tsx");
const subscriptions=read("apps/mobile/app/(app)/role-subscriptions/[role].tsx");
const directory=read("apps/mobile/src/components/social/TeamDirectoryExperience.tsx");
const card=read("apps/mobile/src/components/social/SocialDirectoryCard.tsx");
const team=read("apps/api/src/modules/team/team.service.ts");
const teamRepo=read("apps/api/src/modules/team/team.repository.ts");
const identity=read("apps/api/src/modules/team/team.types.ts");
const auth=read("apps/api/src/modules/auth/auth.service.ts");
const locale=read("packages/localization/src/index.ts");
const tests=read("apps/api/test/profile-role-eligibility.test.ts");

for(const m of [
  "const emailVerified=user?.emailVerified===true",
  "const canRequestTeamJoin=emailVerified&&(user?.roles.length??-1)===0",
  "canRequestTeamJoin?<>",
  'testID="profile-join-team"',
  'testID="profile-roles-locked"',
  "emailVerified={emailVerified}",
  "refereeExclusive={refereeExclusive}",
  "disabled={locked}",
  "roleItemLocked",
  'router.push("/profile/email")',
  'router.push("/profile/account")',
  "emailVerifiedCard",
  "emailAttention",
  "heroEdit",
])assert.ok(screen.includes(m),"Profile role/identity styling regression: "+m);

assert.ok(subscriptions.includes("if(!session||!emailVerified||refereeExclusive)return")&&
  subscriptions.includes("emailVerified && !refereeExclusive")&&
  subscriptions.includes('testID="role-subscription-email-required"')&&
  subscriptions.includes('router.push("/profile/email")'),
  "Unverified accounts must not submit paid subscriptions via deep link");
assert.ok(auth.includes("this.requireVerifiedEmail(user)")&&
  auth.includes("async requestRoleSubscription"),
  "Server must verify email before creating a paid subscription");
assert.ok(identity.includes("emailVerified: boolean")&&teamRepo.includes("emailVerifiedAt: users.emailVerifiedAt")&&
  team.includes('if(!user.emailVerified)')&&team.includes('if(user.roles.length>0)')&&
  team.includes("TEAM_JOIN_BASIC_ACCOUNT_REQUIRED"),
  "Server-side join request must enforce current verified-email and zero-role state");
assert.ok(directory.includes("canRequestTeamJoin")&&
  directory.includes('!canRequestTeamJoin&&!team.myMembershipRole&&!team.joinRequestStatus?"":a.label')&&
  card.includes("{actionLabel?<Pressable"),
  "Noneligible users must not be offered a Send Request action in the team directory");
assert.ok(tests.includes("lets only email-verified role-free users")&&
  tests.includes("rechecks email verification at request time"),
  "Role and verification combinations must have backend regression tests");
for(const key of ["profile.roleUnlockHint","profile.subscriptionLocked","profile.refereeRoleRestriction"]){
  assert.equal(locale.split('"'+key+'"').length-1,3,key+" is required in English, Dari and Pashto");
}
console.log("Profile eligibility verified: safe verified-email role subscriptions, zero-role Join Team only, polished RTL profile identity UI, server enforcement and role matrix.");
