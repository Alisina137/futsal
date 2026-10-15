import assert from "node:assert/strict";
import {test} from "node:test";
import {publicPlayerVerifiedStats} from "../../apps/mobile/src/lib/public-player-profile.ts";
const player={
  userId:"p1",teams:[
    {id:"team-a",name:"A"},{id:"team-b",name:"B"},
  ],
};
const stats=(players)=>({players});
const row=(userId,appearances,goals,assists)=>({
  userId,displayName:userId,appearances,goals,assists,
});
test("only the requested player's stats from currently public team links are summed",()=>{
  const result=publicPlayerVerifiedStats(player,[
    {teamId:"team-a",stats:stats([row("p1",5,3,2),row("p2",10,9,8)])},
    {teamId:"team-b",stats:stats([row("p1",4,1,3)])},
    {teamId:"private-team",stats:stats([row("p1",100,50,40)])},
    {teamId:"team-a",stats:stats([row("p1",5,3,2)])},
  ]);
  assert.deepEqual(result.total,{
    appearances:9,goals:4,assists:5,teamsWithStats:2,
  });
  assert.equal(result.teams.length,2);
  assert.deepEqual(result.teams.map(s=>s.teamId),["team-a","team-b"]);
});
test("no verified results is unknown, never invented zeros",()=>{
  assert.deepEqual(publicPlayerVerifiedStats(player,[]),{teams:[],total:null});
  assert.equal(publicPlayerVerifiedStats(player,[
    {teamId:"team-a",stats:stats([row("other",4,2,2)])},
  ]).total,null);
  assert.equal(publicPlayerVerifiedStats(player,[
    {teamId:"team-b",stats:stats([row("p1",0,0,0)])},
  ]).total,null);
});
test("invalid or non-finite public statistics cannot be shown",()=>{
  for(const invalid of [row("p1",-2,2,0),row("p1",3,NaN,0),row("p1",3,2.4,0)]){
    assert.equal(publicPlayerVerifiedStats(player,[
      {teamId:"team-b",stats:stats([invalid])},
    ]).total,null);
  }
});
