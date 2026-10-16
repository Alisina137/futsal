import test from "node:test";
import assert from "node:assert/strict";
import {normalizePlayerPreferences,playerPreferencesChanged,playerPreferencesValid}
  from "../../apps/mobile/src/lib/player-preferences.ts";
const base={defaultTeamId:null,biography:null,province:null,district:null,
  secondaryPosition:null,preferredFoot:null};
test("normalize private career fields before writes",()=>{
 const clean=normalizePlayerPreferences({...base,biography:"  hello world  ",
   province:" Kabul ",district:" ",preferredFoot:"RIGHT"});
 assert.deepEqual(clean,{...base,biography:"hello world",province:"Kabul",
   district:null,preferredFoot:"RIGHT"});
 assert.equal(playerPreferencesChanged(clean,normalizePlayerPreferences(clean)),false);
 assert.equal(playerPreferencesValid(clean),true);
});
test("diff checks consider semantic changes, not spaces",()=>{
 assert.equal(playerPreferencesChanged({...base,biography:"  "},base),false);
 assert.equal(playerPreferencesChanged({...base,province:"Kabul"},base),true);
 assert.equal(playerPreferencesChanged({...base,defaultTeamId:"team-one"},base),true);
 assert.equal(playerPreferencesChanged({...base,preferredFoot:"BOTH"},base),true);
});
test("validation respects backend string limits",()=>{
 assert.equal(playerPreferencesValid({...base,biography:"x".repeat(501)}),false);
 assert.equal(playerPreferencesValid({...base,district:"x".repeat(81)}),false);
 assert.equal(playerPreferencesValid({...base,province:"  Kabul  "}),true);
});
