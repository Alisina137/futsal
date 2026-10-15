import assert from "node:assert/strict";
import {test} from "node:test";
import {
  competitionProfileMainTabs,competitionProfileSubtabs,allowedCompetitionSubtabs,
  requestedCompetitionNavigation,chooseCompetitionMain,chooseCompetitionSubtab,
  resolvedCompetitionSubtab,
} from "../../apps/mobile/src/lib/competition-detail-navigation.ts";
import {competitionRegistrationSummary,eligibleCompetitionTeams,visibleCompetitionParticipations}
  from "../../apps/mobile/src/lib/competition-detail-teams.ts";
import {competitionHomeSnapshot} from "../../apps/mobile/src/lib/competition-detail-home.ts";
import {competitionTeamStatistics,competitionFairPlayStatistics,competitionPlayerLeaders}
  from "../../apps/mobile/src/lib/competition-detail-statistics.ts";
import {knockoutRoundColumns,verifiedKnockoutConnections,competitionStandingGroups,
  provisionalQualificationZone}
  from "../../apps/mobile/src/lib/competition-detail-standings.ts";
import {matchFitsDatePreset,matchFitsPreferences,normalizedCompetitionMatchPreferences,
  emptyCompetitionMatchPreferences}
  from "../../apps/mobile/src/lib/competition-detail-match-filters.ts";

const now=new Date("2026-10-15T14:00:00Z");
const team=(teamId,status="ACCEPTED")=>({teamId,teamName:teamId,status,offline:false});
const match=(id,homeTeamId,awayTeamId,homeScore,awayScore,status="COMPLETED",stage="LEAGUE")=>({
  id,homeTeamId,awayTeamId,homeScore,awayScore,status,stage,
  roundNumber:1,slotNumber:1,startsAt:"2026-10-16T10:00:00Z",
  groupName:null,nextMatchId:null,nextMatchSide:null,winnerTeamId:null,
});
const cup=(overrides={})=>({
  status:"IN_PROGRESS",teams:[team("A"),team("B"),team("C")],
  maxTeams:4,registrationClosesAt:"2026-10-20T14:00:00Z",
  championTeamId:null,matches:[],playerStats:[],teamDisciplineStats:[],
  ...overrides,
});

test("seven main tabs, their subtabs and format-specific standings remain stable",()=>{
  assert.deepEqual([...competitionProfileMainTabs],
    ["HOME","MATCHES","STANDINGS","STATS","TEAMS","MEDIA","ABOUT"]);
  assert.deepEqual([...competitionProfileSubtabs.MEDIA],["UPDATES","PHOTOS"]);
  assert.deepEqual([...competitionProfileSubtabs.ABOUT],
    ["INFORMATION","RULES","PRIZES","VENUE"]);
  assert.deepEqual([...competitionProfileSubtabs.STATS],["TEAMS","PLAYERS","FAIR_PLAY"]);
  for(const format of ["LEAGUE","KNOCKOUT","GROUP_KNOCKOUT"]){
    const expected=format==="LEAGUE"?["LEAGUE"]:
      format==="KNOCKOUT"?["KNOCKOUT"]:["GROUPS","KNOCKOUT"];
    assert.deepEqual(allowedCompetitionSubtabs("STANDINGS",format),expected);
    for(const main of competitionProfileMainTabs){
      assert.ok(allowedCompetitionSubtabs(main,format).length>0);
    }
  }
});

test("guest has no private Teams subtab and old results/deep links normalize safely",()=>{
  assert.deepEqual(allowedCompetitionSubtabs("TEAMS","LEAGUE"),
    ["PARTICIPANTS"]);
  assert.deepEqual(allowedCompetitionSubtabs("TEAMS","LEAGUE",{registrationOpen:true}),
    ["PARTICIPANTS","REGISTRATION"]);
  assert.deepEqual(allowedCompetitionSubtabs("TEAMS","LEAGUE",{hasParticipation:true}),
    ["PARTICIPANTS","MY_PARTICIPATION"]);
  assert.equal(requestedCompetitionNavigation("RESULTS").main,"MATCHES");
  assert.equal(requestedCompetitionNavigation("RESULTS").sub.MATCHES,"RESULTS");
  const denied=requestedCompetitionNavigation("TEAMS","MY_PARTICIPATION");
  assert.equal(resolvedCompetitionSubtab(denied,"TEAMS",
    allowedCompetitionSubtabs("TEAMS","LEAGUE")),"PARTICIPANTS");
  const wrongStage=requestedCompetitionNavigation("STANDINGS","GROUPS","KNOCKOUT");
  assert.equal(wrongStage.sub.STANDINGS,"KNOCKOUT");
  assert.equal(requestedCompetitionNavigation("NOT_A_TAB","PHOTOS").main,"HOME");
  assert.equal(requestedCompetitionNavigation(["MEDIA"],["PHOTOS"]).sub.MEDIA,"PHOTOS");
});

test("switching tabs preserves valid subtab memory and rejects unavailable selections",()=>{
  let nav=requestedCompetitionNavigation("MEDIA","PHOTOS");
  nav=chooseCompetitionMain(nav,"ABOUT");
  nav=chooseCompetitionSubtab(nav,"ABOUT","RULES",competitionProfileSubtabs.ABOUT);
  assert.equal(nav.sub.ABOUT,"RULES");
  nav=chooseCompetitionMain(nav,"MEDIA");
  assert.equal(resolvedCompetitionSubtab(nav,"MEDIA",competitionProfileSubtabs.MEDIA),"PHOTOS");
  const old=nav;
  nav=chooseCompetitionSubtab(nav,"MEDIA","MY_PARTICIPATION",competitionProfileSubtabs.MEDIA);
  assert.equal(nav,old);
  nav=chooseCompetitionMain(nav,"ABOUT");
  assert.equal(resolvedCompetitionSubtab(nav,"ABOUT",competitionProfileSubtabs.ABOUT),"RULES");
});

test("registration deadline, capacity and state match both Home and Teams",()=>{
  const open=cup({status:"REGISTRATION_OPEN",teams:[team("A"),team("B")]});
  assert.equal(competitionHomeSnapshot(open,now).registrationOpen,true);
  assert.equal(competitionRegistrationSummary(open,now).availableForApply,true);
  const full={...open,maxTeams:2};
  assert.equal(competitionHomeSnapshot(full,now).registrationOpen,false);
  assert.equal(competitionRegistrationSummary(full,now).state,"FULL");
  const expired={...open,registrationClosesAt:"2026-10-15T14:00:00Z"};
  assert.equal(competitionHomeSnapshot(expired,now).registrationOpen,false);
  assert.equal(competitionRegistrationSummary(expired,now).state,"DEADLINE");
  const closed={...open,status:"REGISTRATION_CLOSED"};
  assert.equal(competitionHomeSnapshot(closed,now).registrationOpen,false);
  assert.equal(competitionRegistrationSummary(closed,now).state,"CLOSED");
  const accepted=team("A");
  const waiting=team("B","PENDING");
  const pendingCup={...open,teams:[accepted,waiting]};
  assert.equal(competitionRegistrationSummary(pendingCup,now).acceptedCount,1);
});

test("Home verified score totals exactly match Stats across invalid, removed and corrected fixtures",()=>{
  const data=cup({teams:[team("A"),team("B"),team("X","WITHDRAWN")],
    matches:[
      match("final","A","B",3,1),
      match("correction","B","A",2,2,"CORRECTED","KNOCKOUT"),
      match("live","A","B",9,0,"IN_PROGRESS"),
      match("removed","A","X",4,0),
      match("partial","A","B",null,0),
      match("impossible","A","B",-1,0),
      match("bye","A",null,3,0),
      match("duplicate","A","A",1,0),
    ]});
  const home=competitionHomeSnapshot(data,now);
  const stats=competitionTeamStatistics(data);
  assert.equal(home.verifiedResults,2);
  assert.equal(home.verifiedResults,stats.scoredMatches);
  assert.equal(stats.teams.find(x=>x.teamId==="A").played,2);
  assert.equal(stats.teams.find(x=>x.teamId==="A").wins,1);
  assert.equal(stats.teams.find(x=>x.teamId==="A").draws,1);
  assert.equal(stats.teams.find(x=>x.teamId==="B").losses,1);
});

test("completed champion, bracket advancement and group qualifications are never inferred",()=>{
  const data=cup({status:"COMPLETED",championTeamId:"X",
    teams:[team("A"),team("B"),team("X","WITHDRAWN")]});
  assert.equal(competitionHomeSnapshot(data,now).champion,null);
  const source={...match("semi","A","B",3,1,"COMPLETED","KNOCKOUT"),
    roundNumber:2,nextMatchId:"final",nextMatchSide:"HOME",winnerTeamId:"A"};
  const next={...match("final","A","C",null,null,"SCHEDULED","KNOCKOUT"),
    roundNumber:1};
  assert.deepEqual(knockoutRoundColumns([next,source]).map(r=>r.round),[2,1]);
  assert.equal(verifiedKnockoutConnections([source,next]).length,1);
  assert.equal(verifiedKnockoutConnections([source,{...next,homeTeamId:"B"}]).length,0);
  assert.equal(verifiedKnockoutConnections([{...source,status:"IN_PROGRESS"},next]).length,0);
  const groups=competitionStandingGroups([
    {teamId:"B",teamName:"B",groupName:"Alpha",position:2},
    {teamId:"A",teamName:"A",groupName:"Alpha",position:1},
  ],"GROUP");
  assert.deepEqual(groups[0].rows.map(row=>row.teamId),["A","B"]);
  assert.deepEqual(provisionalQualificationZone(groups[0],1),["A"]);
  assert.deepEqual(provisionalQualificationZone(groups[0],null),[]);
});

test("private participation and player/team statistics never inherit a withdrawn team",()=>{
  const admin="manager1",managed=[
    {id:"A",name:"A",managerUserId:admin},
    {id:"B",name:"B",managerUserId:admin},
    {id:"C",name:"C",managerUserId:"manager2"},
  ];
  const competition=cup({teams:[team("A","ACCEPTED"),team("B","WITHDRAWN")]});
  const participations=[{teamId:"A",status:"ACCEPTED",teamName:"A"},
    {teamId:"B",status:"WITHDRAWN",teamName:"B"}];
  const eligible=eligibleCompetitionTeams(managed,competition,participations,admin);
  assert.deepEqual(eligible.map(x=>x.id),["B"]);
  assert.deepEqual(visibleCompetitionParticipations(participations).map(x=>x.teamId),
    ["A","B"]);
  const player=(id,teamId,goals)=>({playerUserId:id,teamId,publicDisplayName:id,
    teamName:teamId,goals,assists:0,appearances:1,cleanSheets:0,
    yellowCards:0,redCards:0,playerOfMatchAwards:0});
  const stats={...competition,playerStats:[player("accepted","A",1),player("removed","B",20)],
    teamDisciplineStats:[{teamId:"A",yellowCards:1,redCards:0},
      {teamId:"B",yellowCards:100,redCards:10}]};
  assert.deepEqual(competitionPlayerLeaders(stats,"goals").map(p=>p.playerUserId),
    ["accepted"]);
  assert.deepEqual(competitionFairPlayStatistics(stats).teams.map(x=>x.teamId),["A"]);
  assert.equal(competitionFairPlayStatistics({...stats,teamDisciplineStats:undefined}),null);
});

test("Kabul calendar boundaries and stale filter selections normalize",()=>{
  const midnight=new Date("2026-10-15T19:29:00Z"); // 23:59 Kabul
  assert.equal(matchFitsDatePreset("2026-10-15T19:31:00Z","TOMORROW",midnight),true);
  assert.equal(matchFitsDatePreset("2026-10-15T19:31:00Z","TODAY",midnight),false);
  const fixture={...match("one","A","B",1,0),startsAt:"2026-10-15T19:31:00Z"};
  assert.equal(matchFitsPreferences(fixture,
    {...emptyCompetitionMatchPreferences,date:"TOMORROW"},midnight),true);
  const normalized=normalizedCompetitionMatchPreferences({
    teamId:"REMOVED",stage:"GROUP",round:99,group:"Obsolete",date:"NEXT_7_DAYS",
  },cup({teams:[team("A"),team("REMOVED","REJECTED")],matches:[fixture]}));
  assert.deepEqual(normalized,{
    teamId:"ALL",stage:"ALL",round:null,group:"ALL",date:"NEXT_7_DAYS",
  });
});
