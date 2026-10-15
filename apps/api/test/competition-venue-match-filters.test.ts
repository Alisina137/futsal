import {randomUUID} from "node:crypto";
import {describe,expect,it} from "vitest";
import type {CompetitionCreateRequest,CompetitionMatchDto,VenueMatchQuery} from "@leaguekick/contracts";
import {venueMatchQuerySchema} from "@leaguekick/contracts";
import {CompetitionService} from "../src/modules/competition/competition.service.js";
import {FakeCompetitionRepository} from "./fake-competition-repository.js";
const now=new Date("2026-10-15T08:00:00Z");
const opts:CompetitionCreateRequest={
  name:"Venue League",description:"Venue match filter test",format:"LEAGUE",maxTeams:4,
  registrationFeeAfn:0,winPoints:3,drawPoints:1,lossPoints:0,
  tieBreakOrder:["POINTS","GOAL_DIFFERENCE","GOALS_FOR","HEAD_TO_HEAD","ADMIN"],
  groupCount:null,qualifiersPerGroup:null,
  registrationClosesAt:"2026-10-20T08:00:00Z",matchDurationMinutes:60,startsAt:null,endsAt:null,
};
function setup(){
  const repo=new FakeCompetitionRepository();
  const venue=repo.seedVenue(randomUUID(),{subscriptionStatus:"ACTIVE",
    activeUntil:new Date("2027-12-01T00:00:00Z")});
  const service=new CompetitionService(repo,()=>now);
  return {repo,venue,service};
}
function fixture(competitionId:string,homeTeamId:string,awayTeamId:string,
  startsAt:string,status:CompetitionMatchDto["status"],venueId:string,score=0){
  return {
    id:randomUUID(),competitionId,homeTeamId,awayTeamId,
    homeTeamName:"Blue",awayTeamName:"Red",
    venueId,groupId:null,groupName:null,stage:"LEAGUE" as const,
    roundNumber:1,slotNumber:1,areaId:null,areaName:null,
    startsAt,endsAt:new Date(Date.parse(startsAt)+3600000).toISOString(),status,
    homeScore:status==="COMPLETED"?score:null,awayScore:status==="COMPLETED"?1:null,
    winnerTeamId:null,nextMatchId:null,nextMatchSide:null,refereeUserId:null,
  };
}
describe("venue public match filters",()=>{
  it("rejects untrusted filters before query construction",()=>{
    expect(()=>venueMatchQuerySchema.parse({year:2026,month:13})).toThrow();
    expect(()=>venueMatchQuerySchema.parse({year:2026,week:54})).toThrow();
    expect(()=>venueMatchQuerySchema.parse({teamId:"not-a-uuid"})).toThrow();
    expect(()=>venueMatchQuerySchema.parse({scope:"private"})).toThrow();
  });
  it("filters before pagination, returns complete facets and never shows unpublished/other-venue matches",async()=>{
    const {repo,venue,service}=setup();
    const comp1=await service.create(venue.ownerUserId,opts);
    const comp2=await service.create(venue.ownerUserId,{...opts,name:"Second League"});
    const home=repo.seedTeam(randomUUID(),"Blue"),away=repo.seedTeam(randomUUID(),"Red");
    for(const id of [comp1.id,comp2.id]){
      const record=repo.competitions.get(id)!;
      repo.competitions.set(id,{...record,published:true,status:"IN_PROGRESS"});
    }
    const oct1=fixture(comp1.id,home.id,away.id,"2026-10-16T08:00:00Z","SCHEDULED",venue.id);
    const oct2=fixture(comp1.id,home.id,away.id,"2026-10-23T08:00:00Z","SCHEDULED",venue.id);
    const nov=fixture(comp2.id,home.id,away.id,"2026-11-23T08:00:00Z","SCHEDULED",venue.id);
    const elsewhere=fixture(comp1.id,home.id,away.id,"2026-10-16T08:00:00Z","SCHEDULED",randomUUID());
    for(const match of [oct1,oct2,nov,elsewhere])repo.matches.set(match.id,match);
    const other=await service.create(venue.ownerUserId,{...opts,name:"Unpublished"});
    const hidden=fixture(other.id,home.id,away.id,"2026-10-16T08:00:00Z","SCHEDULED",venue.id);
    repo.matches.set(hidden.id,hidden);
    const query=(extra:Partial<VenueMatchQuery>={})=>venueMatchQuerySchema.parse({
      scope:"upcoming",page:1,limit:2,...extra,
    });
    const all=await service.venueMatches(venue.id,query());
    expect(all.total).toBe(3);
    expect(all.matches).toHaveLength(2);
    expect(all.hasMore).toBe(true);
    expect(all.facets.competitions.map(c=>c.name)).toEqual(["Second League","Venue League"]);
    expect(all.facets.teams.map(c=>c.name)).toEqual(["Blue","Red"]);
    expect(all.facets.months).toEqual([10,11]);
    const oct=await service.venueMatches(venue.id,query({month:10}));
    expect(oct.total).toBe(2);
    expect(oct.matches).toHaveLength(2);
    expect(oct.facets.months).toEqual([10,11]);
    const blue=await service.venueMatches(venue.id,query({
      competitionId:comp1.id,teamId:home.id,year:2026,month:10,
    }));
    expect(blue.total).toBe(2);
    expect(blue.matches.every(m=>m.competitionId===comp1.id)).toBe(true);
    const wrong=await service.venueMatches(venue.id,query({
      competitionId:comp2.id,month:10,
    }));
    expect(wrong.total).toBe(0);
    expect(wrong.facets.competitions).toHaveLength(2);
    const page2=await service.venueMatches(venue.id,query({page:2}));
    expect(page2.matches).toHaveLength(1);
  });
  it("recent results have scores, filter by week and exclude scheduled matches",async()=>{
    const {repo,venue,service}=setup();
    const comp=await service.create(venue.ownerUserId,opts);
    const record=repo.competitions.get(comp.id)!;
    repo.competitions.set(comp.id,{...record,published:true,status:"IN_PROGRESS"});
    const home=repo.seedTeam(randomUUID(),"Blue"),away=repo.seedTeam(randomUUID(),"Red");
    const finished=fixture(comp.id,home.id,away.id,"2026-10-13T09:00:00Z","COMPLETED",venue.id,3);
    repo.matches.set(finished.id,finished);
    const results=await service.venueMatches(venue.id,venueMatchQuerySchema.parse({scope:"results"}));
    expect(results.total).toBe(1);
    expect(results.matches[0]).toMatchObject({homeScore:3,awayScore:1,homeTeamId:home.id});
    const week=results.facets.weeks[0]!;
    const found=await service.venueMatches(venue.id,venueMatchQuerySchema.parse({
      scope:"results",week,
    }));
    expect(found.total).toBe(1);
    expect((await service.venueMatches(venue.id,venueMatchQuerySchema.parse({
      scope:"results",week:week===53?52:week+1,
    }))).total).toBe(0);
  });
});
