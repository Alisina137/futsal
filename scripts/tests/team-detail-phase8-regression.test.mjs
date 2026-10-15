import assert from "node:assert/strict";
import {test} from "node:test";
import {initialTeamNavigation,switchTeamMain,switchTeamSub} from
  "../../apps/mobile/src/lib/team-detail-navigation.ts";
import {teamDetailJoinAction,publicTeamTelephoneUrl,displayTeamFollowerCount} from
  "../../apps/mobile/src/lib/team-detail-actions.ts";
import {teamAboutMembershipState,mayOpenTeamMemberArea,teamAboutVenueLink} from
  "../../apps/mobile/src/lib/team-detail-about.ts";
import {teamSquadView,canDisplayTeamRoster,mayOpenPublicPlayer} from
  "../../apps/mobile/src/lib/team-detail-squad.ts";
import {teamMatchRows,teamMatchOutcome} from
  "../../apps/mobile/src/lib/team-detail-matches.ts";
import {teamCompetitionRows,teamCompetitionFixturePreview} from
  "../../apps/mobile/src/lib/team-detail-competitions.ts";
import {teamRecentForm,teamPlayerLeaders,safeTeamWinRate} from
  "../../apps/mobile/src/lib/team-detail-stats.ts";

const fixture=(id,status,competitionId="cup",home="team-A",away="team-B",
  homeScore=null,awayScore=null,startsAt=null)=>({
  id,status,competitionId,competitionName:"Cup",homeTeamId:home,awayTeamId:away,
  homeTeamName:"Team A",awayTeamName:"Team B",homeScore,awayScore,startsAt,stage:"Group",
});
const comp=(id,status,format="LEAGUE")=>({id,name:id,status,format,startsAt:null,endsAt:null});
const joined=(extra={})=>({
  signedIn:true,emailVerified:true,hasAssignedRole:false,member:false,manager:false,
  pending:false,allowJoinRequests:true,...extra,
});
const member=(userId,displayName,position="ALA",shirtNumber=null,role="PLAYER")=>({
  userId,publicDisplayName:displayName,position,shirtNumber,role,imageUrl:null,joinedAt:"2026-01-01T00:00:00Z",
});

test("six tabs retain their own subtabs, reject forged deep links and isolate next team",()=>{
  const first=initialTeamNavigation("squad","leaders");
  assert.deepEqual([first.main,first.sub.squad],["squad","leaders"]);
  const second=switchTeamMain(first,"matches","results");
  const third=switchTeamMain(second,"about","members");
  assert.equal(third.sub.matches,"results");
  assert.equal(third.sub.squad,"leaders");
  assert.equal(third.sub.about,"members");
  assert.deepEqual(switchTeamSub(third,"matches","upcoming"),third);
  const newTeam=initialTeamNavigation("injected","members");
  assert.equal(newTeam.main,"media");
  assert.equal(newTeam.sub.about,"overview");
});

test("visitor/unverified/assigned-role accounts never obtain join or member-only links",()=>{
  const cases=[
    [{signedIn:false},"signIn"],
    [{emailVerified:false},"verifyEmail"],
    [{hasAssignedRole:true},"roleRestricted"],
    [{allowJoinRequests:false},"invitationOnly"],
    [{pending:true,hasAssignedRole:true},"cancel"],
  ];
  for(const [actor,expected] of cases){
    const action=teamDetailJoinAction(joined(actor));
    assert.equal(action,expected);
    assert.equal(mayOpenTeamMemberArea({member:false,isManager:false}),false);
  }
  assert.equal(teamDetailJoinAction(joined()),"request");
  assert.equal(teamDetailJoinAction(joined({member:true})),"none");
  assert.equal(teamDetailJoinAction(joined({manager:true})),"none");
  assert.equal(teamAboutMembershipState({role:null,joinStatus:"PENDING",action:"cancel"}),"pending");
  assert.equal(teamAboutMembershipState({role:"CAPTAIN",joinStatus:"PENDING",action:"none"}),"captain");
});

test("private roster cannot disclose a hidden player or deep-link a private profile",()=>{
  const visible=[member("captain","Captain"),member("public","Public","GOALKEEPER",1)];
  assert.equal(canDisplayTeamRoster("PRIVATE",false,false),false);
  assert.equal(canDisplayTeamRoster("PRIVATE",true,false),true);
  assert.equal(mayOpenPublicPlayer("private-player",["public"]),false);
  assert.equal(mayOpenPublicPlayer("public",["public"]),true);
  const leaders=teamSquadView(visible,"absent-manager","captain",{leadersOnly:true});
  assert.deepEqual(leaders.members.map(x=>x.userId),["captain"]);
  assert.equal(leaders.visibleCount,2);
});

test("published competitions and match feeds do not cross a team's identity boundary",()=>{
  const competitions=[comp("cup","IN_PROGRESS"),comp("old","COMPLETED")];
  const games=[
    fixture("our-result","CORRECTED","cup","team-B","team-A",4,1,"2026-10-05T00:00:00Z"),
    fixture("other-team-result","COMPLETED","cup","x","y",8,0,"2026-10-07T00:00:00Z"),
    fixture("ours-future","SCHEDULED","cup","team-A","team-B",null,null,"2026-10-25T00:00:00Z"),
  ];
  assert.deepEqual(teamCompetitionRows(competitions,"active").map(x=>x.id),["cup"]);
  assert.deepEqual(teamCompetitionRows(competitions,"past").map(x=>x.id),["old"]);
  assert.deepEqual(teamMatchRows(games,"team-A","results").map(x=>x.id),["our-result"]);
  assert.equal(teamMatchOutcome(games[0],"team-A"),"loss");
  assert.equal(teamCompetitionFixturePreview(games,"team-A","cup")?.match.id,"ours-future");
  assert.equal(teamCompetitionFixturePreview(games,"team-A","hidden"),null);
});

test("all-time stats are separate from bounded five-game form and verified team perspective",()=>{
  const games=[
    fixture("corrected","CORRECTED","cup","team-B","team-A",4,1,"2026-10-05T00:00:00Z"),
    fixture("unknown-score","COMPLETED","cup","team-A","team-B",null,null,"2026-10-08T00:00:00Z"),
    fixture("unrelated","COMPLETED","cup","x","y",8,0,"2026-10-09T00:00:00Z"),
  ];
  const form=teamRecentForm(games,"team-A",5);
  assert.deepEqual(form.map(x=>x.match.id),["corrected"]);
  assert.equal(form[0].outcome,"loss");
  assert.deepEqual([form[0].ourGoals,form[0].theirGoals],[1,4]); // 1 away goal vs 4 home goals
  assert.equal(safeTeamWinRate(Infinity),0);
  assert.equal(safeTeamWinRate(999),100);
});

test("goals, assists and appearances leaders rank within the same authorized candidate set",()=>{
  const source=[
    {userId:"a",displayName:"Alice",goals:8,assists:1,appearances:2},
    {userId:"b",displayName:"Bilal",goals:0,assists:11,appearances:3},
    {userId:"c",displayName:"Cyril",goals:1,assists:2,appearances:19},
  ];
  assert.equal(teamPlayerLeaders(source,"goals")[0]?.userId,"a");
  assert.equal(teamPlayerLeaders(source,"assists")[0]?.userId,"b");
  assert.equal(teamPlayerLeaders(source,"appearances")[0]?.userId,"c");
});

test("public profile actions reject unsafe links and show unknown follower counts truthfully",()=>{
  assert.equal(publicTeamTelephoneUrl("+93 (700) 123-456"),"tel:+93700123456");
  assert.equal(publicTeamTelephoneUrl("javascript:alert(1)"),null);
  const venue="00000000-aaaa-4bbb-8ccc-dddddddddddd";
  assert.equal(teamAboutVenueLink("PUBLIC",venue),venue);
  assert.equal(teamAboutVenueLink("PRIVATE",venue),null);
  assert.equal(displayTeamFollowerCount(undefined),"—");
  assert.equal(displayTeamFollowerCount(0),"0");
});

test("empty and degraded responses remain empty rather than manufacturing content",()=>{
  assert.deepEqual(teamMatchRows([],"team-A","results"),[]);
  assert.deepEqual(teamCompetitionRows([],"active"),[]);
  assert.deepEqual(teamRecentForm([],"team-A"),[]);
  assert.deepEqual(teamPlayerLeaders([],"goals"),[]);
  assert.equal(teamCompetitionFixturePreview([],"team-A","cup"),null);
});
