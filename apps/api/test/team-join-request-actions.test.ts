import request from "supertest";
import { describe,expect,it } from "vitest";
import { createApp } from "../src/app.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { TokenService } from "../src/modules/auth/token.service.js";
import { TeamService } from "../src/modules/team/team.service.js";
import {NotificationService} from "../src/modules/notifications/notification.service.js";
import {FakeNotificationRepository} from "./fake-notification-repository.js";
import { FakeAuthRepository } from "./fake-auth-repository.js";
import { FakeTeamRepository } from "./fake-team-repository.js";

function setup(){
  const authRepository=new FakeAuthRepository();
  const teamRepository=new FakeTeamRepository();
  const tokens=new TokenService("test-secret-that-is-longer-than-thirty-two-characters","test","test-mobile");
  const auth=new AuthService(authRepository,tokens);
  const notificationRepository=new FakeNotificationRepository();
  const notifications=new NotificationService(notificationRepository,()=>new Date("2026-10-10T00:00:00.000Z"));
  const teams=new TeamService(teamRepository,()=>new Date("2026-10-10T00:00:00.000Z"),notifications);
  const app=createApp({authService:auth,tokenService:tokens,teamService:teams});
  return {app,authRepository,teamRepository,notifications,notificationRepository};
}

async function register(ctx:ReturnType<typeof setup>,username:string,phone:string){
  const password="strong-pass-5!";
  const response=await request(ctx.app).post("/api/v1/auth/register").send({
    phone,username,password,confirmPassword:password,preferredLanguage:"fa-AF",
  });
  expect(response.status).toBe(201);

  await ctx.authRepository.activateRoleSubscription({
    actorUserId:response.body.user.id,userId:response.body.user.id,
    role:"TEAM_MANAGER",monthlyPriceAfn:300,months:1,
    paymentReference:"join-test",now:new Date("2026-10-10T00:00:00.000Z"),
  });
  const session=await request(ctx.app).post("/api/v1/auth/refresh")
    .send({refreshToken:response.body.refreshToken});
  expect(session.status).toBe(200);
  ctx.teamRepository.seedUser({
    id:session.body.user.id,displayName:username,username,
    phoneE164:session.body.user.phone,roles:["TEAM_MANAGER"],
  });
  return {token:session.body.accessToken as string,userId:session.body.user.id as string};
}

describe.each([
  {action:"accept",accept:true,expectedStatus:"ACCEPTED"},
  {action:"reject",accept:false,expectedStatus:"REJECTED"},
])("Team Manager join request: $action",({accept,expectedStatus})=>{
  it("uses the PATCH endpoint, authorizes the manager, updates the request and roster atomically",async()=>{
    const ctx=setup();
    const manager=await register(ctx,"join_manager","0705591021");
    const player=await register(ctx,"join_player","0705591022");
    const outsider=await register(ctx,"join_other","0705591023");
    const created=await request(ctx.app).post("/api/v1/teams")
      .set("Authorization",`Bearer ${manager.token}`)
      .send({name:"Join Request Test",city:"Kabul",privacy:"PUBLIC"});
    expect(created.status).toBe(201);
    const teamId=created.body.team.id as string;

    const applied=await request(ctx.app).post(`/api/v1/teams/${teamId}/join-request`)
      .set("Authorization",`Bearer ${player.token}`);
    expect(applied.status).toBe(201);
    expect(applied.body.request.status).toBe("PENDING");
    const requestId=applied.body.request.id as string;
    const managerAlerts=await ctx.notifications.list(manager.userId,"TEAMS");
    expect(managerAlerts.notifications).toMatchObject([{type:"TEAM_JOIN_REQUEST",
      data:{requestId,teamId}}]);
    expect((await ctx.notifications.list(outsider.userId)).notifications).toHaveLength(0);

    const listBefore=await request(ctx.app).get(`/api/v1/teams/${teamId}/join-requests`)
      .set("Authorization",`Bearer ${manager.token}`);
    expect(listBefore.status).toBe(200);
    expect(listBefore.body.requests.some((item:{id:string;status:string})=>item.id===requestId&&item.status==="PENDING")).toBe(true);

    const forbidden=await request(ctx.app).patch(`/api/v1/teams/${teamId}/join-requests/${requestId}`)
      .set("Authorization",`Bearer ${outsider.token}`).send({accept});
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("TEAM_MANAGER_REQUIRED");

    const result=await request(ctx.app).patch(`/api/v1/teams/${teamId}/join-requests/${requestId}`)
      .set("Authorization",`Bearer ${manager.token}`).send({accept});
    expect(result.status).toBe(200);
    expect(result.body.request.id).toBe(requestId);
    expect(result.body.request.status).toBe(expectedStatus);
    expect(result.body.request.respondedAt).not.toBeNull();
    const playerAlerts=await ctx.notifications.list(player.userId,"TEAMS");
    expect(playerAlerts.notifications).toMatchObject([{type:"TEAM_JOIN_DECISION",
      data:{requestId,teamId,accepted:accept}}]);

    const listAfter=await request(ctx.app).get(`/api/v1/teams/${teamId}/join-requests`)
      .set("Authorization",`Bearer ${manager.token}`);
    expect(listAfter.status).toBe(200);
    expect(listAfter.body.requests.find((v:{id:string})=>v.id===requestId)?.status).toBe(expectedStatus);

    const roster=await request(ctx.app).get(`/api/v1/teams/${teamId}/roster`)
      .set("Authorization",`Bearer ${manager.token}`);
    expect(roster.status).toBe(200);
    expect(roster.body.team.members.some((v:{userId:string})=>v.userId===player.userId)).toBe(accept);

    const replay=await request(ctx.app).patch(`/api/v1/teams/${teamId}/join-requests/${requestId}`)
      .set("Authorization",`Bearer ${manager.token}`).send({accept});
    expect(replay.status).toBe(409);
    expect(replay.body.error.code).toBe("TEAM_JOIN_REQUEST_UNAVAILABLE");
  });
});


it("returns truthful invitation-only and membership status in the directory",async()=>{
  const ctx=setup();
  const manager=await register(ctx,"phase1_mgr","0705591081");
  const seeker=await register(ctx,"phase1_seek","0705591082");
  const created=await request(ctx.app).post("/api/v1/teams")
    .set("Authorization",`Bearer ${manager.token}`)
    .send({name:"Phase One FC",city:"Kabul",privacy:"PUBLIC"});
  expect(created.status).toBe(201);
  const teamId=created.body.team.id as string;
  const directory=async(token:string)=>request(ctx.app).get("/api/v1/teams")
    .set("Authorization",`Bearer ${token}`);
  const first=await directory(seeker.token);
  expect(first.status).toBe(200);
  expect(first.body.teams.find((team:{id:string})=>team.id===teamId)).toMatchObject({
    allowJoinRequests:true,joinRequestStatus:null,myMembershipRole:null,
  });
  ctx.teamRepository.joinRequestsAllowed.set(teamId,false);
  const invitationOnly=await directory(seeker.token);
  expect(invitationOnly.body.teams.find((team:{id:string})=>team.id===teamId)).toMatchObject({
    allowJoinRequests:false,joinRequestStatus:null,myMembershipRole:null,
  });
  const forbidden=await request(ctx.app).post(`/api/v1/teams/${teamId}/join-request`)
    .set("Authorization",`Bearer ${seeker.token}`);
  expect(forbidden.status).toBe(403);
  expect(forbidden.body.error.code).toBe("TEAM_REQUESTS_DISABLED");
  const ownerDirectory=await directory(manager.token);
  expect(ownerDirectory.body.teams.find((team:{id:string})=>team.id===teamId)
    .myMembershipRole).toBeTruthy();
  ctx.teamRepository.joinRequestsAllowed.set(teamId,true);
  const join=await request(ctx.app).post(`/api/v1/teams/${teamId}/join-request`)
    .set("Authorization",`Bearer ${seeker.token}`);
  expect(join.status).toBe(201);
  const after=await directory(seeker.token);
  expect(after.body.teams.find((team:{id:string})=>team.id===teamId)).toMatchObject({
    allowJoinRequests:true,joinRequestStatus:"PENDING",myMembershipRole:null,
  });
});


// Phase 4: users can withdraw their own pending request, but nobody else's.
it("supports pending request cancellation, replay protection, and reapplication",async()=>{
  const ctx=setup();
  const manager=await register(ctx,"phase4_mgr","0705592021");
  const seeker=await register(ctx,"phase4_seek","0705592022");
  const outsider=await register(ctx,"phase4_other","0705592023");
  const created=await request(ctx.app).post("/api/v1/teams")
    .set("Authorization",`Bearer ${manager.token}`)
    .send({name:"Phase Four FC",city:"Herat",privacy:"PUBLIC"});
  expect(created.status).toBe(201);
  const teamId=created.body.team.id as string;
  const policy=await request(ctx.app).get(`/api/v1/teams/${teamId}/join-policy`);
  expect(policy.status).toBe(200);
  expect(policy.body.allowJoinRequests).toBe(true);
  const join=await request(ctx.app).post(`/api/v1/teams/${teamId}/join-request`)
    .set("Authorization",`Bearer ${seeker.token}`);
  expect(join.status).toBe(201);
  const requestId=join.body.request.id;
  const forbidden=await request(ctx.app).delete(`/api/v1/teams/${teamId}/join-request`)
    .set("Authorization",`Bearer ${outsider.token}`);
  expect(forbidden.status).toBe(409);
  const cancelled=await request(ctx.app).delete(`/api/v1/teams/${teamId}/join-request`)
    .set("Authorization",`Bearer ${seeker.token}`);
  expect(cancelled.status).toBe(200);
  expect(cancelled.body.request).toMatchObject({id:requestId,status:"CANCELLED"});
  expect(cancelled.body.request.respondedAt).not.toBeNull();
  const me=await request(ctx.app).get(`/api/v1/teams/${teamId}/join-request`)
    .set("Authorization",`Bearer ${seeker.token}`);
  expect(me.body.request).toBeNull();
  const replay=await request(ctx.app).delete(`/api/v1/teams/${teamId}/join-request`)
    .set("Authorization",`Bearer ${seeker.token}`);
  expect(replay.status).toBe(409);
  const managerApproval=await request(ctx.app).patch(`/api/v1/teams/${teamId}/join-requests/${requestId}`)
    .set("Authorization",`Bearer ${manager.token}`).send({accept:true});
  expect(managerApproval.status).toBe(409);
  const reapply=await request(ctx.app).post(`/api/v1/teams/${teamId}/join-request`)
    .set("Authorization",`Bearer ${seeker.token}`);
  expect(reapply.status).toBe(201);
  expect(reapply.body.request.id).not.toBe(requestId);
  const approved=await request(ctx.app).patch(`/api/v1/teams/${teamId}/join-requests/${reapply.body.request.id}`)
    .set("Authorization",`Bearer ${manager.token}`).send({accept:true});
  expect(approved.status).toBe(200);
  expect(approved.body.request.status).toBe("ACCEPTED");
  const member=await request(ctx.app).get(`/api/v1/teams/${teamId}/roster`)
    .set("Authorization",`Bearer ${seeker.token}`);
  expect(member.status).toBe(200);
  expect(member.body.team.members.some((x:{userId:string})=>x.userId===seeker.userId)).toBe(true);
});

it("publishes invitation-only policy while forbidding unsolicited requests",async()=>{
  const ctx=setup();
  const manager=await register(ctx,"policy4_mgr","0705592081");
  const seeker=await register(ctx,"policy4_seek","0705592082");
  const created=await request(ctx.app).post("/api/v1/teams")
    .set("Authorization",`Bearer ${manager.token}`)
    .send({name:"Invite Only FC",city:"Kabul",privacy:"PRIVATE"});
  const teamId=created.body.team.id as string;
  ctx.teamRepository.joinRequestsAllowed.set(teamId,false);
  const policy=await request(ctx.app).get(`/api/v1/teams/${teamId}/join-policy`);
  expect(policy.status).toBe(200);
  expect(policy.body).toEqual({allowJoinRequests:false});
  const denied=await request(ctx.app).post(`/api/v1/teams/${teamId}/join-request`)
    .set("Authorization",`Bearer ${seeker.token}`);
  expect(denied.status).toBe(403);
  expect(denied.body.error.code).toBe("TEAM_REQUESTS_DISABLED");
});
