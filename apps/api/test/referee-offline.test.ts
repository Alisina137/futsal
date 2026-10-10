import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({
  entries:new Map<string,string>(),
  get:vi.fn(),event:vi.fn(),
}));
vi.mock("@react-native-async-storage/async-storage",()=>({
  default:{
    getItem:async (key:string)=>mocks.entries.get(key)??null,
    setItem:async (key:string,value:string)=>{mocks.entries.set(key,value);},
    removeItem:async (key:string)=>{mocks.entries.delete(key);},
  },
}));
vi.mock("../../mobile/src/lib/api",()=>({
  refereePhase2Api:{get:mocks.get,event:mocks.event},
}));
import {cacheRefereeMatch,enqueueRefereeEvent,readRefereeOffline,refereeOfflineKey,
  syncRefereeOffline,stagedScore} from "../../mobile/src/lib/referee-offline.js";

const user="11111111-1111-4111-8111-111111111111";
const other="99999999-9999-4999-8999-999999999999";
const match="22222222-2222-4222-8222-222222222222";
const event={id:"33333333-3333-4333-8333-333333333333",
  kind:"GOAL" as const,side:"HOME" as const,playerUserId:null,period:1,elapsedSeconds:140,details:"Offline goal"};
const baseReport={matchId:match,status:"DRAFT" as const,events:[],checks:{
  homePresent:true,awayPresent:true,rosterChecked:true,venueReady:true},
  clock:{elapsedSeconds:180,period:1,runningSince:null},currentSeconds:180,score:{homeScore:0,awayScore:0},
  startedAt:"2026-10-10T10:00:00Z",finishedAt:null,summary:"",revision:1,
  submittedAt:null,reviewedAt:null,feedback:null};
const matchInfo={id:match,competitionId:"44444444-4444-4444-8444-444444444444",
  homeTeamId:null,awayTeamId:null,matchStatus:"SCHEDULED",stage:"LEAGUE",
  startsAt:"2026-10-10T10:00:00Z",durationMinutes:60};
beforeEach(()=>{mocks.entries.clear();mocks.get.mockReset();mocks.event.mockReset();});
describe("referee durable offline event queue",()=>{
  it("writes the local event before any network action and scopes it to one user",async()=>{
    const saved=await enqueueRefereeEvent(user,match,event);
    expect(saved.pending).toEqual([event]);
    expect((await readRefereeOffline(user,match)).pending).toEqual([event]);
    expect((await readRefereeOffline(other,match)).pending).toHaveLength(0);
    expect(stagedScore([event])).toEqual({homeScore:1,awayScore:0});
  });
  it("synchronizes exactly once and removes only server-acknowledged UUIDs",async()=>{
    await enqueueRefereeEvent(user,match,event);
    const remote={report:baseReport,match:matchInfo,roster:[]};
    mocks.get.mockResolvedValue(remote);
    mocks.event.mockResolvedValue({report:{...baseReport,
      events:[{...event}],score:{homeScore:1,awayScore:0},revision:2}});
    const done=await syncRefereeOffline(user,match,"token");
    expect(done.pending).toHaveLength(0);
    expect(mocks.event).toHaveBeenCalledTimes(1);
    expect(mocks.event.mock.calls[0]?.[2]).toMatchObject({id:event.id,recordedOffline:true});
  });
  it("keeps rejected events for a later explicit retry without regenerating UUIDs",async()=>{
    await enqueueRefereeEvent(user,match,event);
    mocks.get.mockResolvedValue({report:baseReport,match:matchInfo,roster:[]});
    mocks.event.mockRejectedValueOnce(new Error("network failed"));
    await expect(syncRefereeOffline(user,match,"token")).rejects.toThrow("network failed");
    expect((await readRefereeOffline(user,match)).pending.map(e=>e.id)).toEqual([event.id]);
    mocks.event.mockResolvedValueOnce({report:{...baseReport,events:[event]}});
    expect((await syncRefereeOffline(user,match,"token")).pending).toHaveLength(0);
  });
  it("reconciles a persisted event without posting a duplicate",async()=>{
    await enqueueRefereeEvent(user,match,event);
    mocks.get.mockResolvedValue({report:{...baseReport,events:[event]},match:matchInfo,roster:[]});
    expect((await syncRefereeOffline(user,match,"token")).pending).toHaveLength(0);
    expect(mocks.event).not.toHaveBeenCalled();
  });
  it("does not silently overwrite an unreadable queue",async()=>{
    mocks.entries.set(refereeOfflineKey(user,match),"{invalid-json");
    await expect(readRefereeOffline(user,match)).rejects.toThrow("Do not clear app storage");
    expect(mocks.entries.get(refereeOfflineKey(user,match))).toBe("{invalid-json");
  });
  it("retains authorized cached match context along with staged events",async()=>{
    await cacheRefereeMatch(user,match,{report:baseReport,match:matchInfo,roster:[]});
    await enqueueRefereeEvent(user,match,event);
    const state=await readRefereeOffline(user,match);
    expect(state.cached?.report?.startedAt).toBe("2026-10-10T10:00:00Z");
    expect(state.pending).toHaveLength(1);
  });
});
