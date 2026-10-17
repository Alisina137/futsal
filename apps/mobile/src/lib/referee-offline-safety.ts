/** Disk cache is untrusted input, even when the storage key is account-scoped.
 * Do not erase corrupt data: the user may need a support-assisted recovery.
 */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds=new Set(["GOAL","YELLOW_CARD","RED_CARD","FOUL","TIMEOUT","SUBSTITUTION","INCIDENT"]);
export function refereeScopedUuid(value:unknown):value is string{
  return typeof value==="string"&&uuid.test(value);
}
export function validOfflineEvent(value:unknown):boolean{
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  const e=value as Record<string,unknown>;
  if(!refereeScopedUuid(e.id)||!kinds.has(String(e.kind))||
    !["HOME","AWAY",null].includes(e.side as string|null)||
    ![1,2].includes(e.period as number)||!Number.isInteger(e.elapsedSeconds)||
    (e.elapsedSeconds as number)<0||(e.elapsedSeconds as number)>10800||
    typeof e.details!=="string"||e.details.length>400)return false;
  if(e.playerUserId!==null&&!refereeScopedUuid(e.playerUserId))return false;
  if(e.assistingUserId!==undefined&&e.assistingUserId!==null&&!refereeScopedUuid(e.assistingUserId))
    return false;
  return (e.kind==="INCIDENT"||e.side!==null);
}
export function validRefereeOfflineRecord(value:unknown,userId:string,matchId:string):boolean{
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  const v=value as Record<string,unknown>;
  if(v.version!==1||v.userId!==userId||v.matchId!==matchId||
    !Array.isArray(v.pending)||v.pending.length>120||
    (v.summaryDraft!==undefined&&v.summaryDraft!==null&&
      (typeof v.summaryDraft!=="string"||v.summaryDraft.length>2000)))return false;
  const ids=new Set<string>();
  for(const event of v.pending){
    if(!validOfflineEvent(event))return false;
    const id=(event as {id:string}).id;
    if(ids.has(id))return false;
    ids.add(id);
  }
  if(v.cached===null)return true;
  if(!v.cached||typeof v.cached!=="object"||Array.isArray(v.cached))return false;
  const cached=v.cached as Record<string,unknown>;
  const match=cached.match;
  if(!match||typeof match!=="object"||Array.isArray(match)||
    (match as {id?:unknown}).id!==matchId||!Array.isArray(cached.roster))return false;
  const report=cached.report;
  return report===null||Boolean(report&&typeof report==="object"&&!Array.isArray(report)&&
    (report as {matchId?:unknown}).matchId===matchId);
}
