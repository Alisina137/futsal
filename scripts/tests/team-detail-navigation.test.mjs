import assert from "node:assert/strict";
import {test} from "node:test";
import {initialTeamNavigation,switchTeamMain,switchTeamSub} from
  "../../apps/mobile/src/lib/team-detail-navigation.ts";

test("new team opens first main tab and its first subtab",()=>{
  assert.deepEqual(initialTeamNavigation(),{
    main:"media",
    sub:{media:"posts",squad:"players",matches:"upcoming",competitions:"active",
      stats:"overview",about:"overview"},
  });
});
test("main tabs retain independent subtab selections",()=>{
  let state=initialTeamNavigation();
  state=switchTeamSub(state,"media","photos");
  state=switchTeamMain(state,"stats");
  state=switchTeamSub(state,"stats","topPlayers");
  state=switchTeamMain(state,"matches");
  state=switchTeamSub(state,"matches","results");
  state=switchTeamMain(state,"media");
  assert.equal(state.sub.media,"photos");
  state=switchTeamMain(state,"stats");
  assert.equal(state.sub.stats,"topPlayers");
  state=switchTeamMain(state,"matches");
  assert.equal(state.sub.matches,"results");
});
test("supported deep links target the right main/subtab without losing defaults",()=>{
  assert.deepEqual([initialTeamNavigation("matches","results").main,
    initialTeamNavigation("matches","results").sub.matches],["matches","results"]);
  assert.deepEqual([initialTeamNavigation("about","members").main,
    initialTeamNavigation("about","members").sub.about],["about","members"]);
  assert.equal(initialTeamNavigation("stats","topPlayers").sub.stats,"topPlayers");
  assert.equal(initialTeamNavigation(["squad"],["leaders"]).sub.squad,"leaders");
});
test("invalid or mismatched route parameters cannot inject unknown tabs",()=>{
  assert.deepEqual(initialTeamNavigation("unknown","results"),initialTeamNavigation());
  assert.equal(initialTeamNavigation("matches","members").sub.matches,"upcoming");
  assert.equal(initialTeamNavigation("media","__proto__").sub.media,"posts");
});
test("direct shortcuts explicitly select a target without wiping other choices",()=>{
  let state=switchTeamSub(initialTeamNavigation(),"media","photos");
  state=switchTeamMain(state,"matches","results");
  assert.equal(state.sub.media,"photos");
  assert.equal(state.sub.matches,"results");
  state=switchTeamMain(state,"about","members");
  assert.equal(state.sub.about,"members");
});
test("inactive tab cannot change visible subtab",()=>{
  const state=initialTeamNavigation();
  assert.equal(switchTeamSub(state,"about","members"),state);
});
test("different team opens default navigation even after old choices",()=>{
  const old=switchTeamMain(initialTeamNavigation(),"stats","topPlayers");
  assert.equal(initialTeamNavigation().main,"media");
  assert.equal(initialTeamNavigation().sub.stats,"overview");
  assert.equal(old.sub.stats,"topPlayers");
});
