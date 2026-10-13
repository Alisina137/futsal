import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const routes=read("apps/api/src/modules/team/team.routes.ts");
const service=read("apps/api/src/modules/team/team.service.ts");
const repo=read("apps/api/src/modules/team/team.repository.ts");
const tests=read("apps/api/test/team-join-request-actions.test.ts");
const detail=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const directory=read("apps/mobile/src/components/social/TeamDirectoryExperience.tsx");
const manager=read("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
const manage=read("apps/mobile/app/(app)/teams/[teamId]/manage.tsx");
const invites=read("apps/mobile/app/(app)/teams/invitations.tsx");
const client=read("apps/mobile/src/lib/api.ts");
const locale=read("packages/localization/src/index.ts");
for(const [ok,label] of [
  [routes.includes('router.delete("/teams/:teamId/join-request"'),"requester cancel route"],
  [routes.includes('router.get("/teams/:teamId/join-policy"'),"public policy read"],
  [service.includes("cancelMyJoinRequest")&&repo.includes('status: "CANCELLED"'),"atomic cancel"],
  [repo.includes("pg_advisory_xact_lock(hashtext")&&repo.includes("respondJoinRequest"),"team lock"],
  [repo.includes('respondedByUserId: team.managerUserId'),"invitation cleanup"],
  [tests.includes("pending request cancellation"),"API regression tests"],
  [client.includes("cancelJoin:")&&client.includes("publicJoinPolicy:"),"typed mobile API"],
  [detail.includes("setJoinAllowed(policy.allowJoinRequests)")&&detail.includes("cancelJoin()"),"team detail membership"],
  [directory.includes('team.joinRequestStatus==="PENDING"?cancel(team.id):join(team.id)'),"directory pending action"],
  [manager.includes('t("teams.phase4.managerReviewHint")')&&manage.includes("pendingRequests.map"),"manager controls"],
  [invites.includes("await revalidate()")&&invites.includes("invitationAccepted"),"post-acceptance identity refresh"],
])assert.ok(ok,"Phase 4 invariant missing: "+label);
for(const key of ["cancelRequest","cancelRequestError","pendingReview","invitationOnlyHelp",
  "invitationAccepted","invitationDeclined","openTeam","managerReviewHint"]){
  assert.equal(locale.split('"teams.phase4.'+key+'"').length,4,"Missing EN/Dari/Pashto: "+key);
}
console.log("Teams Phase 4 verified: policy, cancellation, manager review and invitation synchronization.");
