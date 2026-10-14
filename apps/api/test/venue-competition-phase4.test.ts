import {randomUUID} from "node:crypto";
import request from "supertest";
import type {CompetitionCreateRequest,CompetitionMatchDto} from "@leaguekick/contracts";
import {competitionDiscoveryQuerySchema,venueMatchQuerySchema} from "@leaguekick/contracts";
import {describe,expect,it} from "vitest";
import {createApp} from "../src/app.js";
import {AuthService} from "../src/modules/auth/auth.service.js";
import {TokenService} from "../src/modules/auth/token.service.js";
import {CompetitionService} from "../src/modules/competition/competition.service.js";
import {FakeAuthRepository} from "./fake-auth-repository.js";
import {FakeCompetitionRepository} from "./fake-competition-repository.js";

const NOW=new Date("2026-10-14T12:00:00.000Z");
const input:CompetitionCreateRequest={
  name:"Venue Cup",description:"Public fixture",format:"LEAGUE",maxTeams:4,
  registrationFeeAfn:250,winPoints:3,drawPoints:1,lossPoints:0,
  tieBreakOrder:["POINTS","GOAL_DIFFERENCE","GOALS_FOR"],groupCount:null,
  qualifiersPerGroup:null,registrationClosesAt:"2026-10-26T10:00:00Z",
  matchDurationMinutes:60,startsAt:"2026-10-30T15:00:00Z",endsAt:null,
};
function setup(){
  const repo=new FakeCompetitionRepository();
  const owner=randomUUID(),otherOwner=randomUUID();
  const venue=repo.seedVenue(owner,{subscriptionStatus:"ACTIVE",activeUntil:new Date("2027-01-01T00:00:00Z")});
  const otherVenue=repo.seedVenue(otherOwner,{subscriptionStatus:"ACTIVE",activeUntil:new Date("2027-01-01T00:00:00Z")});
  const service=new CompetitionService(repo,()=>NOW);
  const authRepository=new FakeAuthRepository();
  const tokens=new TokenService("test-secret-that-is-longer-than-thirty-two-characters","test","test-mobile");
  const app=createApp({authService:new AuthService(authRepository,tokens),tokenService:tokens,competitionService:service});
  return {repo,service,venue,owner,otherVenue,otherOwner,app};
}
async function publish(ctx:ReturnType<typeof setup>,owner:string,name:string,
  status:"REGISTRATION_OPEN"|"REGISTRATION_CLOSED"|"SCHEDULED"|"IN_PROGRESS"|"COMPLETED"|"ARCHIVED",
  published=true){
  const c=await ctx.service.create(owner,{...input,name});
  ctx.repo.competitions.set(c.id,{...ctx.repo.competitions.get(c.id)!,status,published});
  return c.id;
}
function match(id:string,competitionId:string,venueId:string,status:CompetitionMatchDto["status"],
  startsAt="2026-11-01T12:00:00.000Z"){
  const dto:CompetitionMatchDto&{venueId:string}={
    id,competitionId,venueId,groupId:null,groupName:null,stage:"LEAGUE",
    roundNumber:1,slotNumber:1,homeTeamId:null,homeTeamName:"Blue",
    awayTeamId:null,awayTeamName:"Red",areaId:null,areaName:null,startsAt,
    endsAt:"2026-11-01T13:00:00.000Z",status,homeScore:status==="COMPLETED"?3:null,
    awayScore:status==="COMPLETED"?1:null,winnerTeamId:null,nextMatchId:null,
    nextMatchSide:null,refereeUserId:null,
  };
  return dto;
}
describe("Venue detail Phase 4 competition discovery and fixtures",()=>{
  it("validates scoped venue filtering before pagination, and never returns draft or other venue competitions",async()=>{
    const ctx=setup();
    const ownA=await publish(ctx,ctx.owner,"A","REGISTRATION_OPEN");
    const ownB=await publish(ctx,ctx.owner,"B","SCHEDULED");
    const foreign=await publish(ctx,ctx.otherOwner,"Foreign","REGISTRATION_OPEN");
    const hidden=await publish(ctx,ctx.owner,"Secret","REGISTRATION_OPEN",false);
    const filter=(page:number)=>competitionDiscoveryQuerySchema.parse({
      venueId:ctx.venue.id,scope:"all",page,limit:1,sort:"starting",
    });
    const first=await ctx.service.discoverPublic(filter(1));
    const second=await ctx.service.discoverPublic(filter(2));
    expect(first.total).toBe(2);
    expect(first.hasMore).toBe(true);
    expect(second.hasMore).toBe(false);
    expect([...first.competitions,...second.competitions].map(x=>x.id).sort())
      .toEqual([ownA,ownB].sort());
    expect([foreign,hidden]).not.toContain(first.competitions[0]?.id);
    const registration=await ctx.service.discoverPublic(competitionDiscoveryQuerySchema.parse({
      venueId:ctx.venue.id,scope:"registration",
    }));
    expect(registration.competitions.map(x=>x.id)).toEqual([ownA]);
    expect(()=>competitionDiscoveryQuerySchema.parse({venueId:"not-uuid"})).toThrow();
  });
  it("exposes only published scheduled/live matches physically assigned to the selected venue",async()=>{
    const ctx=setup();
    const comp=await publish(ctx,ctx.owner,"Public Arena","IN_PROGRESS");
    const privateComp=await publish(ctx,ctx.owner,"Private","SCHEDULED",false);
    const otherComp=await publish(ctx,ctx.otherOwner,"Other","SCHEDULED");
    const planned=match(randomUUID(),comp,ctx.venue.id,"SCHEDULED");
    const live=match(randomUUID(),comp,ctx.venue.id,"IN_PROGRESS");
    const finished=match(randomUUID(),comp,ctx.venue.id,"COMPLETED");
    const elsewhere=match(randomUUID(),comp,ctx.otherVenue.id,"SCHEDULED");
    const hidden=match(randomUUID(),privateComp,ctx.venue.id,"SCHEDULED");
    const different=match(randomUUID(),otherComp,ctx.otherVenue.id,"SCHEDULED");
    const unscheduled=match(randomUUID(),comp,ctx.venue.id,"UNSCHEDULED");
    for(const item of [planned,live,finished,elsewhere,hidden,different,unscheduled])
      ctx.repo.matches.set(item.id,item);
    const upcoming=await request(ctx.app).get(`/api/v1/venues/${ctx.venue.id}/competition-matches`)
      .query({scope:"upcoming",page:1,limit:1});
    expect(upcoming.status).toBe(200);
    expect(upcoming.body.venueId).toBe(ctx.venue.id);
    expect(upcoming.body.total).toBe(2);
    expect(upcoming.body.hasMore).toBe(true);
    const next=await request(ctx.app).get(`/api/v1/venues/${ctx.venue.id}/competition-matches`)
      .query({scope:"upcoming",page:2,limit:1});
    expect(next.body.hasMore).toBe(false);
    expect([upcoming.body.matches[0].id,next.body.matches[0].id].sort())
      .toEqual([planned.id,live.id].sort());
    const results=await request(ctx.app).get(`/api/v1/venues/${ctx.venue.id}/competition-matches`)
      .query({scope:"results"});
    expect(results.body.matches).toEqual([expect.objectContaining({
      id:finished.id,homeScore:3,awayScore:1,status:"COMPLETED",
    })]);
    expect(JSON.stringify(results.body)).not.toContain("playerStats");
    expect(JSON.stringify(results.body)).not.toContain("refereeUserId");
    expect(JSON.stringify(upcoming.body)).not.toContain(privateComp);
    const invalid=await request(ctx.app).get(`/api/v1/venues/${ctx.venue.id}/competition-matches`)
      .query({scope:"invalid",page:0});
    expect(invalid.status).toBe(400);
    expect(()=>venueMatchQuerySchema.parse({limit:100})).toThrow();
  });
});
