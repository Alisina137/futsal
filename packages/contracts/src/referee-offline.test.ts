import {describe,it,expect} from "vitest";
import {partitionRefereeReplay} from "./index.js";
describe("offline referee UUID replay policy",()=>{
 const e1={id:"first",period:1},e2={id:"second",period:1},e3={id:"third",period:2};
 it("retains original order of unsynchronized events",()=>{
   expect(partitionRefereeReplay([e1,e2,e3],[{id:"second"}]))
     .toEqual({acknowledged:[e2],toReplay:[e1,e3]});
 });
 it("never replays acknowledged UUIDs after a lost HTTP response",()=>{
   expect(partitionRefereeReplay([e1,e2],[{id:"first"},{id:"second"}]).toReplay).toEqual([]);
 });
 it("keeps all unacknowledged events when the remote report is empty",()=>{
   expect(partitionRefereeReplay([e1,e2],[]).toReplay).toEqual([e1,e2]);
 });
});
