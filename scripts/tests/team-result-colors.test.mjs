import assert from "node:assert/strict";
import {test} from "node:test";
import {teamMatchOutcome} from "../../apps/mobile/src/lib/team-detail-matches.ts";
import {teamResultTheme} from "../../apps/mobile/src/lib/team-result-theme.ts";

const A="my-team",B="other-team";
const match=(status,homeScore,awayScore,homeTeamId=A,awayTeamId=B)=>({
  status,homeScore,awayScore,homeTeamId,awayTeamId,
});
function theme(m,scope="results",teamId=A){
  return teamResultTheme({
    scope,status:m.status,homeScore:m.homeScore,awayScore:m.awayScore,
    outcome:teamMatchOutcome(m,teamId),
  });
}
test("a completed team win gets green border and a subtle green result background",()=>{
  const home=theme(match("COMPLETED",4,2));
  const away=theme(match("CORRECTED",1,3,B,A));
  for(const actual of [home,away])assert.deepEqual(actual,{
    border:"#86EFAC",surface:"#F0FDF4",text:"#166534",
  });
});
test("a loss gets red border and a subtle red result background regardless of side",()=>{
  const home=theme(match("COMPLETED",0,2));
  const away=theme(match("COMPLETED",3,1,B,A));
  for(const actual of [home,away])assert.deepEqual(actual,{
    border:"#FCA5A5",surface:"#FEF2F2",text:"#991B1B",
  });
});
test("an official drawn result is neutral gray on both home and away teams",()=>{
  for(const status of ["COMPLETED","CORRECTED"]){
    assert.deepEqual(theme(match(status,2,2)),{
      border:"#CBD5E1",surface:"#F1F5F9",text:"#475569",
    });
    assert.deepEqual(theme(match(status,2,2,B,A)),{
      border:"#CBD5E1",surface:"#F1F5F9",text:"#475569",
    });
  }
});
test("upcoming, unscored, unrelated and unverified matches never get an outcome tint",()=>{
  assert.equal(theme(match("SCHEDULED",2,1)),null);
  assert.equal(theme(match("IN_PROGRESS",2,1)),null);
  assert.equal(theme(match("POSTPONED",2,1)),null);
  assert.equal(theme(match("COMPLETED",null,null)),null);
  assert.equal(theme(match("CORRECTED",null,2)),null);
  assert.equal(theme(match("COMPLETED",3,2),"upcoming"),null);
  assert.equal(theme(match("COMPLETED",3,2),"results","someone-else"),null);
  assert.equal(teamResultTheme({scope:"results",status:"COMPLETED",
    homeScore:2,awayScore:2,outcome:"win"}),null);
  assert.equal(teamResultTheme({scope:"results",status:"COMPLETED",
    homeScore:3,awayScore:2,outcome:"draw"}),null);
  assert.equal(teamResultTheme({scope:"results",status:"COMPLETED",
    homeScore:-1,awayScore:2,outcome:"loss"}),null);
});
