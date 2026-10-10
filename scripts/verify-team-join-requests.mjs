import fs from "node:fs";
const read=(path)=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const check=(value,message)=>{if(!value)throw new Error(message);};
const routes=read("apps/api/src/modules/team/team.routes.ts");
const client=read("apps/mobile/src/lib/api.ts");
const dashboard=read("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
const tests=read("apps/api/test/team-join-request-actions.test.ts");
check(routes.includes('router.patch("/teams/:teamId/join-requests/:requestId"'),
  "Server's manager join-request endpoint must use PATCH on the request id.");
const action=client.slice(client.indexOf("  respondJoinRequest:"),client.indexOf("  joinRequest:",client.indexOf("  respondJoinRequest:")));
check(action.includes('method:"PATCH"'),"Client must use PATCH for join-request response.");
check(action.includes('/join-requests/${requestId}`'),
  "Client must address the actual join-request route; /respond is not registered.");
check(!action.includes('/respond'),"Obsolete /respond suffix would cause 404.");
check(action.includes("JSON.stringify({accept})"),"Client must send boolean accept decision.");
check(dashboard.includes("respondToPlayerRequest(request.id,true)")&&
      dashboard.includes("respondToPlayerRequest(request.id,false)"),
  "Both Accept and Reject controls must invoke the working API action.");
check(dashboard.includes("setRequests(current=>current.map")&&dashboard.includes("joinActionError"),
  "Decision result and inline request-specific errors must be displayed.");
check(tests.includes('expect(result.status).toBe(200)')&&
  tests.includes('expect(roster.body.team.members.some')&&tests.includes('expect(forbidden.status).toBe(403)'),
  "End-to-end accept/reject and security regression test missing.");
console.log("Team Manager join-request actions verified: client/server path and method match, both buttons, state refresh, inline errors, and API integration coverage.");
