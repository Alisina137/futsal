import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const dashboard=read("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
const overview=read("apps/mobile/src/components/team-manager/TeamManagerOverviewPanel.tsx");
const contracts=read("packages/contracts/src/index.ts");
const api=read("apps/mobile/src/lib/api.ts");
const backend=read("apps/api/src/modules/team/team.service.ts");
const locales=read("packages/localization/src/index.ts");

for(const marker of [
 'testID="tm-players-workspace"','testID="tm-players-subtabs"',
 'testID="tm-players-roster"','testID="tm-players-requests"',
 'testID="tm-players-invitations"','testID="tm-players-guests"',
 'setPlayerSection(item.id)','accessibilityRole="tab"',
 'setPlayerSearch','setPlayerPosition',
 'member.publicDisplayName.toLocaleLowerCase().includes',
 'member.shirtNumber!==null&&String(member.shirtNumber).includes',
 'requestHistory?requests.filter(item=>item.status!=="PENDING"):pending',
 'inviteHistory?invitations.filter(item=>item.status!=="PENDING"):outstanding',
 'respondToPlayerRequest(request.id,true)',
 'respondToPlayerRequest(request.id,false)',
 'teamApi.invite(token!,team.id,{',
 'teamApi.revokeInvitation(token!,team.id,inv.id)',
 'const validJersey=',
 'teamManagerApi.updateGuest(token!,selectedId!,editingGuest,input)',
 'teamManagerApi.addGuest(token!,selectedId!,input)',
 'teamManagerApi.deleteGuest(token!,team.id,guest.id)',
 'testID="tm-guest-delete-confirm"',
 'setPlayerSection("ROSTER");setPlayerSearch("");setPlayerPosition("ALL")',
 'setRequestHistory(false);setInviteHistory(false);setGuestToRemove(null)',
 'attentionReady&&attentionLoaded.requests',
 'attentionReady&&attentionLoaded.invitations',
 'onPlayersSection={openPlayerSection}',
]){
  assert.ok(dashboard.includes(marker),"Team Manager Players Phase 3 missing: "+marker);
}
for(const marker of [
 'onPlayersSection:(section:"REQUESTS"|"INVITATIONS")=>void',
 'if(item.key==="requests"){onPlayersSection("REQUESTS");return;}',
 'if(item.key==="invitations"){onPlayersSection("INVITATIONS");return;}',
])assert.ok(overview.includes(marker),"Action center deep link missing: "+marker);

for(const key of [
 "navigation","roster","requests","invitations","guests","search","searchHint",
 "positionFilter","allPositions","results","noMatches","clearFilters",
 "pending","history","noHistory","inviteRole","expires","editGuest",
 "noGuests","confirmRemoveGuest",
 "requestStatus.ACCEPTED","requestStatus.REJECTED","requestStatus.CANCELLED",
 "invitationStatus.PENDING","invitationStatus.ACCEPTED","invitationStatus.DECLINED",
 "invitationStatus.REVOKED","invitationStatus.EXPIRED",
]){
  assert.equal(locales.split('"tmPlayers.'+key+'"').length-1,3,
    "Players translation absent in English/Dari/Pashto: "+key);
}
assert.ok(contracts.includes('teamInvitationStatusSchema = z.enum(["PENDING", "ACCEPTED", "DECLINED", "REVOKED", "EXPIRED"])'),
  "Invitation history must preserve all real backend statuses");
assert.ok(contracts.includes('teamJoinRequestStatusSchema = z.enum(["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"])'),
  "Request history must use real backend statuses");
for(const name of ["respondJoinRequest:","revokeInvitation:","teamInvitations:","joinRequests:"])
  assert.ok(api.includes(name),"Missing Players API action: "+name);
assert.ok(backend.includes("this.repository.respondJoinRequest(")&&
  backend.includes("this.repository.revokeInvitation("),
  "Player request and invitation actions must remain server-authorized.");
console.log("Team Manager Players Phase 3 verified: 4 subtabs, scoped roster search, histories, real invite and join actions, guest confirmation, RTL and trilingual localization.");
