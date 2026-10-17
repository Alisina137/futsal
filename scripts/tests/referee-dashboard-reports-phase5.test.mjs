import test from "node:test";
import assert from "node:assert/strict";
import {
  refereeReportCanEdit,refereeReportNeedsChanges,
  refereeReportUnsavedSummary,refereeReportCanSubmit,
  refereeReportNeedsExitWarning,
} from "../../apps/mobile/src/lib/referee-report-workflow.ts";

const report=(overrides={})=>({
  status:"DRAFT",summary:"Final score and incidents",startedAt:"2026-10-17T08:00:00Z",
  finishedAt:"2026-10-17T09:00:00Z",revision:3,
  ...overrides,
});
test("Editable only when draft or corrections requested",()=>{
  assert.equal(refereeReportCanEdit(null),false);
  assert.equal(refereeReportCanEdit(report()),true);
  assert.equal(refereeReportCanEdit(report({status:"CHANGES_REQUESTED"})),true);
  for(const status of ["SUBMITTED","APPROVING","APPROVED"])
    assert.equal(refereeReportCanEdit(report({status})),false);
});
test("Returned reports are explicitly actionable and preserve organizer feedback",()=>{
  assert.equal(refereeReportNeedsChanges(report({status:"CHANGES_REQUESTED",
    feedback:"Correct scorer"})),true);
  assert.equal(refereeReportNeedsChanges(report({status:"APPROVED"})),false);
});
test("Summary updates distinguish a locally edited draft from the official report",()=>{
  assert.equal(refereeReportUnsavedSummary(report(),"Final score and incidents"),false);
  assert.equal(refereeReportUnsavedSummary(report(),"Different score"),true);
  assert.equal(refereeReportUnsavedSummary(report({status:"SUBMITTED"}),"Different score"),false);
});
test("Submitted, approved, unfinished and missing reports cannot be submitted again",()=>{
  for(const status of ["SUBMITTED","APPROVING","APPROVED"])
    assert.equal(refereeReportCanSubmit(report({status}),"Final score and incidents",0,true,false),false);
  assert.equal(refereeReportCanSubmit(null,"",0,true,false),false);
  assert.equal(refereeReportCanSubmit(report({finishedAt:null}),"Final score and incidents",0,true,false),false);
});
test("Offline, queued, busy and unsaved edits block official submission",()=>{
  const r=report();
  assert.equal(refereeReportCanSubmit(r,r.summary,1,true,false),false);
  assert.equal(refereeReportCanSubmit(r,r.summary,0,false,false),false);
  assert.equal(refereeReportCanSubmit(r,r.summary,0,true,true),false);
  assert.equal(refereeReportCanSubmit(r,"Uncommitted edit",0,true,false),false);
  assert.equal(refereeReportCanSubmit(r,r.summary,0,true,false),true);
});
test("Organizer-returned report may be resubmitted after corrections are saved",()=>{
  const r=report({status:"CHANGES_REQUESTED"});
  assert.equal(refereeReportCanSubmit(r,r.summary,0,true,false),true);
  assert.equal(refereeReportCanSubmit(r,r.summary+" unsaved",0,true,false),false);
});
test("Leave warning respects pending events, local edits and active writes",()=>{
  assert.equal(refereeReportNeedsExitWarning(1,false,false,false),true);
  assert.equal(refereeReportNeedsExitWarning(0,true,false,false),true);
  assert.equal(refereeReportNeedsExitWarning(0,false,true,false),true);
  assert.equal(refereeReportNeedsExitWarning(0,false,false,true),true);
  assert.equal(refereeReportNeedsExitWarning(0,false,false,false),false);
});
