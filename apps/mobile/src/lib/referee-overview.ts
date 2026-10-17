import type {RefereeMatch} from "./api";

export type RefereeAttentionKind="UNSYNCED"|"CORRECTION"|"PENDING"|"IMMINENT";
export type RefereeAttentionItem={
  key:string;
  kind:RefereeAttentionKind;
  match:RefereeMatch;
  unsyncedCount:number;
};
const PRIORITY:Record<RefereeAttentionKind,number>={
  UNSYNCED:0,CORRECTION:1,PENDING:2,IMMINENT:3,
};
/** Actionable summary only. Never derive permission from locally cached data. */
export function refereeAttentionItems(
  assignments:ReadonlyArray<RefereeMatch>,
  nowMs:number=Date.now(),
  offlineCounts:Readonly<Record<string,number>>={},
):RefereeAttentionItem[]{
  const items:RefereeAttentionItem[]=[];
  for(const match of assignments){
    const start=match.startsAt?Date.parse(match.startsAt):Number.NaN;
    const future=Number.isFinite(start)&&start>nowMs;
    const unsyncedCount=Math.max(0,offlineCounts[match.id]??0);
    // Keep unsynced-event warnings even if a venue revoked authorization:
    // deleting that local queue would permanently lose the evidence.
    if(unsyncedCount>0)items.push({key:"UNSYNCED:"+match.id,
      kind:"UNSYNCED",match,unsyncedCount});
    if(!match.authorized)continue;
    if(match.responseStatus==="ACCEPTED"&&match.reportStatus==="CHANGES_REQUESTED")
      items.push({key:"CORRECTION:"+match.id,kind:"CORRECTION",match,unsyncedCount:0});
    if(match.responseStatus==="PENDING"&&match.matchStatus==="SCHEDULED"&&future)
      items.push({key:"PENDING:"+match.id,kind:"PENDING",match,unsyncedCount:0});
    if(match.responseStatus==="ACCEPTED"&&match.matchStatus==="SCHEDULED"&&
      !match.reportStartedAt&&future&&start-nowMs<=24*60*60*1000)
      items.push({key:"IMMINENT:"+match.id,kind:"IMMINENT",match,unsyncedCount:0});
  }
  return items.sort((a,b)=>PRIORITY[a.kind]-PRIORITY[b.kind]||
    (Date.parse(a.match.startsAt??"")||Number.MAX_SAFE_INTEGER)-
    (Date.parse(b.match.startsAt??"")||Number.MAX_SAFE_INTEGER)||
    a.key.localeCompare(b.key));
}
