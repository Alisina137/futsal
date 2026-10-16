import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const dash=read("apps/mobile/src/components/player/PlayerDashboard.tsx");
const api=read("apps/api/src/modules/team/team.service.ts");
const local=read("packages/localization/src/index.ts");
for(const marker of [
'testID="player-team-summary"','pendingInvites.length','pendingRequests.length',
'setMemberQuery','memberTeams.map(team=>','visibleRequests.map(req=>',
'requestFilter==="PENDING"','confirmDecline===invite.id',
'teamApi.declineInvitation','confirmCancelRequest===req.id',
'playerDashboardApi.cancelRequest','directoryLoading','directoryError',
'canRequestJoin?<Button','!team.allowJoinRequests',
'session?.user.emailVerified===true','(session?.user.roles.length??0)===0',
'teamApi.requestJoin','style={styles.teamNotice}'
])assert.ok(dash.includes(marker),"Missing My Teams Phase 2 invariant: "+marker);
assert.ok(api.includes("if(!user.emailVerified)")&&api.includes("if(user.roles.length>0)"),
"Server role restrictions for join requests must remain enforced.");
for(const key of ["filterMyTeams","noFilteredTeams","filterAll","filterPending",
"filterHistory","noFilteredRequests","confirmDecline","confirmCancelRequest",
"findPlayerNotice","requestClosed","respondedAt"])
 assert.equal(local.split('"pd1.'+key+'"').length-1,3,"Missing all-language label: "+key);
console.log("Player My Teams Phase 2 verified: search, summaries, status filters, confirmations, role-safe discovery and translations.");
