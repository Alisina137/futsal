import request from "supertest";
import { describe,expect,it } from "vitest";
import { createApp } from "../src/app.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { TokenService } from "../src/modules/auth/token.service.js";
import { TeamService } from "../src/modules/team/team.service.js";
import { FakeAuthRepository } from "./fake-auth-repository.js";
import { FakeTeamRepository } from "./fake-team-repository.js";

function setup(){
  const authRepository=new FakeAuthRepository();
  const teamRepository=new FakeTeamRepository();
  const tokens=new TokenService("test-secret-that-is-longer-than-thirty-two-characters","test","test-mobile");
  const auth=new AuthService(authRepository,tokens);
  const teams=new TeamService(teamRepository,()=>new Date("2026-10-10T00:00:00.000Z"));
  const app=createApp({authService:auth,tokenService:tokens,teamService:teams});
  return {app,authRepository,teamRepository};
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
