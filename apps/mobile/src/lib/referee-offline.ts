import {partitionRefereeReplay} from "@leaguekick/contracts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {refereePhase2Api,type RefereeMatchEvent,type RefereeMatchReport,
  type RefereeReportMatch,type RefereeReportMember} from "./api";

export type CachedRefereeMatch={
  report:RefereeMatchReport|null;match:RefereeReportMatch;roster:RefereeReportMember[];
};
export type StagedRefereeEvent=Omit<RefereeMatchEvent,"elapsedSeconds">&{elapsedSeconds:number};
export type RefereeOfflineRecord={
  version:1;userId:string;matchId:string;cached:CachedRefereeMatch|null;pending:StagedRefereeEvent[];
};
const prefix="futsal.referee.offline.v1.";
const locks=new Map<string,Promise<unknown>>();
const maxPending=120;
export function refereeOfflineKey(userId:string,matchId:string){
  if(!/^[0-9a-f-]{36}$/i.test(userId)||!/^[0-9a-f-]{36}$/i.test(matchId))
    throw new Error("Invalid offline record scope.");
  return prefix+userId+"."+matchId;
}
function blank(userId:string,matchId:string):RefereeOfflineRecord{
  return {version:1,userId,matchId,cached:null,pending:[]};
}
async function load(userId:string,matchId:string):Promise<RefereeOfflineRecord>{
  const raw=await AsyncStorage.getItem(refereeOfflineKey(userId,matchId));
  if(!raw)return blank(userId,matchId);
  try{
    const decoded=JSON.parse(raw) as RefereeOfflineRecord;
    if(decoded.version!==1||decoded.userId!==userId||decoded.matchId!==matchId||
      !Array.isArray(decoded.pending)||decoded.pending.length>maxPending||
      decoded.cached!==null&&typeof decoded.cached!=="object")throw new Error("Invalid saved record.");
    return decoded;
  }catch{
    // Never erase a durable queue because its bytes are unexpected. Surface
    // the error so the referee can preserve/recover the device data.
    throw new Error("Saved referee events could not be read. Do not clear app storage.");
  }
}
async function locked<T>(userId:string,matchId:string,fn:()=>Promise<T>):Promise<T>{
  const key=refereeOfflineKey(userId,matchId),previous=locks.get(key)??Promise.resolve();
  const task=previous.catch(()=>undefined).then(fn);
  locks.set(key,task);
  try{return await task;}
  finally{if(locks.get(key)===task)locks.delete(key);}
}
async function store(state:RefereeOfflineRecord){
  await AsyncStorage.setItem(refereeOfflineKey(state.userId,state.matchId),JSON.stringify(state));
}
export async function readRefereeOffline(userId:string,matchId:string){
  return locked(userId,matchId,()=>load(userId,matchId));
}
export async function cacheRefereeMatch(userId:string,matchId:string,cached:CachedRefereeMatch){
  return locked(userId,matchId,async()=>{
    const existing=await load(userId,matchId);
    const next={...existing,cached};await store(next);return next;
  });
}
export async function enqueueRefereeEvent(userId:string,matchId:string,event:StagedRefereeEvent){
  return locked(userId,matchId,async()=>{
    const existing=await load(userId,matchId);
    if(existing.pending.some(item=>item.id===event.id))return existing;
    if(existing.pending.length>=maxPending)
      throw new Error("Offline event queue is full. Reconnect before recording more.");
    if(!Number.isInteger(event.elapsedSeconds)||event.elapsedSeconds<0||
      event.elapsedSeconds>10800||event.details.length>400)
      throw new Error("Offline event data is invalid.");
    const next={...existing,pending:[...existing.pending,event]};
    // Write-ahead: durable before attempting a network request. Retries keep the UUID.
    await store(next);return next;
  });
}
/** Fetch authoritative state, compare UUIDs, then replay sequentially. Never
 * silently discard a rejected event; keep it for the referee to resolve.
 * This lock prevents duplicate simultaneous replays and queue/write races.
 */
export async function syncRefereeOffline(userId:string,matchId:string,token:string){
  return locked(userId,matchId,async()=>{
    let state=await load(userId,matchId);
    let current=await refereePhase2Api.get(token,matchId);
    state={...state,cached:current};await store(state);
    for(const queued of [...state.pending]){
      const report=current.report;
      if(!report)throw new Error("Match has not started. Saved events remain on this device.");
      const exists=partitionRefereeReplay([queued],report.events).acknowledged.length===1;
      if(!exists&&(!report.startedAt||
          !["DRAFT","CHANGES_REQUESTED"].includes(report.status)||
          !!report.finishedAt&&report.status!=="CHANGES_REQUESTED"))
        throw new Error("The official match report cannot accept more events. Contact the organizer.");
      if(!exists){
        const result=await refereePhase2Api.event(token,matchId,{...queued,recordedOffline:true});
        current={...current,report:result.report};
        if(!result.report.events.some(e=>e.id===queued.id))
          throw new Error("Event acknowledgement did not include its ID.");
      }
      // Remove only after confirmed persisted or already present on the server.
      state={...state,cached:current,pending:state.pending.filter(e=>e.id!==queued.id)};
      await store(state);
    }
    return state;
  });
}
export function stagedScore(events:ReadonlyArray<RefereeMatchEvent>){
  return {homeScore:events.filter(e=>e.kind==="GOAL"&&e.side==="HOME").length,
    awayScore:events.filter(e=>e.kind==="GOAL"&&e.side==="AWAY").length};
}
