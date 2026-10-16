import assert from "node:assert/strict";
import {test} from "node:test";
import {competitionProfileMainTabs,competitionProfileSubtabs,
  allowedCompetitionSubtabs,requestedCompetitionNavigation,
  chooseCompetitionMain,chooseCompetitionSubtab,resolvedCompetitionSubtab}
  from "../../apps/mobile/src/lib/competition-detail-navigation.ts";

test("exactly seven public profile tabs and appropriate subtab groups",()=>{
  assert.deepEqual(competitionProfileMainTabs,["HOME","MATCHES","STANDINGS","STATS","TEAMS","MEDIA","ABOUT"]);
  for(const tab of competitionProfileMainTabs){
    if(tab==="ABOUT"){
      assert.deepEqual(competitionProfileSubtabs.ABOUT,["OVERVIEW"]);
    }else assert.ok(competitionProfileSubtabs[tab].length>1,"Missing subtabs: "+tab);
  }
});
test("old Results URLs deep-link into completed match results",()=>{
  const nav=requestedCompetitionNavigation("RESULTS");
  assert.equal(nav.main,"MATCHES");
  assert.equal(nav.sub.MATCHES,"RESULTS");
});
test("unknown routes and forged subtab strings cannot inject navigation",()=>{
  const nav=requestedCompetitionNavigation("__unknown__","ADMIN","LEAGUE");
  assert.equal(nav.main,"HOME");
  assert.equal(nav.sub.HOME,"OVERVIEW");
  const bad=requestedCompetitionNavigation("STATS","ADMIN");
  assert.equal(bad.sub.STATS,"PLAYERS");
});
test("format-scoped standings show only supported tournament stages",()=>{
  assert.deepEqual(allowedCompetitionSubtabs("STANDINGS","LEAGUE"),["LEAGUE"]);
  assert.deepEqual(allowedCompetitionSubtabs("STANDINGS","KNOCKOUT"),["KNOCKOUT"]);
  assert.deepEqual(allowedCompetitionSubtabs("STANDINGS","GROUP_KNOCKOUT"),["GROUPS","KNOCKOUT"]);
  const v=requestedCompetitionNavigation("STANDINGS",undefined,"KNOCKOUT");
  assert.equal(v.sub.STANDINGS,"KNOCKOUT");
  const old=requestedCompetitionNavigation("STANDINGS","KNOCKOUT","GROUP_KNOCKOUT");
  assert.equal(old.sub.STANDINGS,"KNOCKOUT");
});
test("registration and my participation subtabs respect real competition states",()=>{
  assert.deepEqual(allowedCompetitionSubtabs("TEAMS","LEAGUE"),["PARTICIPANTS"]);
  assert.deepEqual(allowedCompetitionSubtabs("TEAMS","LEAGUE",{registrationOpen:true}),
    ["PARTICIPANTS","REGISTRATION"]);
  assert.deepEqual(allowedCompetitionSubtabs("TEAMS","LEAGUE",{hasParticipation:true}),
    ["PARTICIPANTS","MY_PARTICIPATION"]);
});
test("main tab preserves independent sub selections and excludes wrong inactive writes",()=>{
  const a=requestedCompetitionNavigation("MEDIA","PHOTOS");
  const b=chooseCompetitionMain(a,"MATCHES");
  const c=chooseCompetitionSubtab(b,"MATCHES","LIVE",allowedCompetitionSubtabs("MATCHES","LEAGUE"));
  assert.equal(c.sub.MATCHES,"LIVE");
  assert.equal(chooseCompetitionMain(c,"MEDIA").sub.MEDIA,"PHOTOS");
  assert.deepEqual(chooseCompetitionSubtab(c,"MEDIA","UPDATES",["UPDATES","PHOTOS"]),c);
  assert.deepEqual(chooseCompetitionSubtab(c,"MATCHES","ILLEGAL",["UPCOMING","LIVE"]),c);
});
test("changing tournament format resolves hidden stale subtab safely",()=>{
  const prev=requestedCompetitionNavigation("STANDINGS","KNOCKOUT","GROUP_KNOCKOUT");
  assert.equal(resolvedCompetitionSubtab(prev,"STANDINGS",
    allowedCompetitionSubtabs("STANDINGS","LEAGUE")),"LEAGUE");
});

test("About is a single overview and legacy subsection deep links remain usable",()=>{
  for(const previous of ["INFORMATION","RULES","PRIZES","VENUE"]){
    const nav=requestedCompetitionNavigation("ABOUT",previous);
    assert.equal(nav.main,"ABOUT");
    assert.equal(nav.sub.ABOUT,"OVERVIEW");
    assert.equal(resolvedCompetitionSubtab(nav,"ABOUT",allowedCompetitionSubtabs("ABOUT","LEAGUE")),"OVERVIEW");
  }
  assert.deepEqual(allowedCompetitionSubtabs("ABOUT","GROUP_KNOCKOUT"),["OVERVIEW"]);
});
