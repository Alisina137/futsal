import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import {useCallback,useEffect,useRef,useState} from "react";
import {Linking,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {refereeCareerApi,refereePhase2Api,type RefereeMatch,type RefereeMatchEvent,
  type RefereeMatchReport,type RefereeReportMember} from "../../lib/api";
import {useAuth} from "../../providers/AuthProvider";
import {useLocale} from "../../providers/LocaleProvider";
import {useNetwork} from "../../providers/NetworkProvider";
import {cacheRefereeMatch,enqueueRefereeEvent,readRefereeOffline,
  stagedScore,syncRefereeOffline,type StagedRefereeEvent} from "../../lib/referee-offline";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";
import {TextField} from "../ui/TextField";

type Kind=RefereeMatchEvent["kind"];
const kinds:Kind[]=["GOAL","YELLOW_CARD","RED_CARD","FOUL","TIMEOUT","SUBSTITUTION","INCIDENT"];
type MatchData=Awaited<ReturnType<typeof refereePhase2Api.get>>;
function eventId(){
  // Unique correlation ID for retry-safe event insertion; not a security token.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{
    const r=Math.floor(Math.random()*16);return (c==="x"?r:(r&3)|8).toString(16);
  });
}
function clockText(seconds:number){const n=Math.max(0,Math.floor(seconds));
  return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");}
export function RefereeMatchCenter({match,onClose}:{match:RefereeMatch;onClose:()=>void}){
  const {session}=useAuth(),{t,isRTL}=useLocale();
  const {isOnline,apiReachable,apiReconnectVersion}=useNetwork();
  const connected=isOnline&&apiReachable!==false;
  const userId=session?.user.id;
  const tr=(s:string)=>t(("rf2."+s) as never),token=session?.accessToken;
  const [data,setData]=useState<MatchData|null>(null),[loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const [summary,setSummary]=useState("");
  const [editingKind,setEditingKind]=useState<Kind|null>(null);
  const [side,setSide]=useState<"HOME"|"AWAY">("HOME");
  const [player,setPlayer]=useState<string|null>(null),[details,setDetails]=useState("");
  const [assistingUserId,setAssistingUserId]=useState<string|null>(null);
  const [deleteId,setDeleteId]=useState<string|null>(null),[deleteReason,setDeleteReason]=useState("");
  const [now,setNow]=useState(Date.now());
  const [pending,setPending]=useState<StagedRefereeEvent[]>([]);
  const [syncing,setSyncing]=useState(false);
  const syncRef=useRef(false);
  const load=useCallback(async()=>{
    if(!token||!userId)return;
    setLoading(true);
    try{
      const local=await readRefereeOffline(userId,match.id);
      setPending(local.pending);
      if(local.cached){setData(local.cached);setSummary(local.cached.report?.summary??"");}
      if(!connected){
        if(!local.cached)setError(tr("offlineNoCache"));
        else setMessage(tr("offlineSnapshot"));
        return;
      }
      const value=await refereePhase2Api.get(token,match.id);
      setData(value);setSummary(value.report?.summary??"");setError(null);
      await cacheRefereeMatch(userId,match.id,value);
    }catch(e){setError(e instanceof Error?e.message:tr("loadFailed"));}
    finally{setLoading(false);}
  },[token,userId,match.id,t,connected]);
  useEffect(()=>{void load();},[load]);
  const synchronize=useCallback(async()=>{
    if(!token||!userId||!connected||syncRef.current)return;
    syncRef.current=true;setSyncing(true);
    try{
      const state=await syncRefereeOffline(userId,match.id,token);
      setData(state.cached);setPending(state.pending);
      setError(null);setMessage(tr("eventsSynced"));
    }catch(e){setError(e instanceof Error?e.message:tr("syncFailed"));}
    finally{syncRef.current=false;setSyncing(false);}
  },[token,userId,match.id,connected,t]);
  useEffect(()=>{
    if(connected&&pending.length>0)void synchronize();
  },[connected,apiReconnectVersion,pending.length,synchronize]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const report=data?.report??null,clock=report?.clock??{elapsedSeconds:0,period:1,runningSince:null};
  const seconds=clock.elapsedSeconds+(clock.runningSince?
    Math.max(0,Math.floor((now-Date.parse(clock.runningSince))/1000)):0);
  const editable=!report||report.status==="DRAFT"||report.status==="CHANGES_REQUESTED";
  const active=!!report?.startedAt&&!report.finishedAt;
  const recording=editable&&(active||report?.status==="CHANGES_REQUESTED");
  const canStart=editable&&!report?.startedAt;
  const visibleEvents:RefereeMatchEvent[]=[
    ...(report?.events??[]),
    ...pending.filter(e=>!(report?.events??[]).some(saved=>saved.id===e.id)),
  ];
  const scores=stagedScore(visibleEvents);
  const fouls=(s:"HOME"|"AWAY")=>visibleEvents.filter(e=>
    e.kind==="FOUL"&&e.side===s&&e.period===clock.period).length;
  const repeatCautions=visibleEvents.filter(e=>e.kind==="YELLOW_CARD"&&e.playerUserId)
    .reduce<Record<string,number>>((acc,e)=>({...acc,[e.playerUserId!]:
      (acc[e.playerUserId!]??0)+1}),{});
  const secondCaution=Object.entries(repeatCautions).some(([,count])=>count>=2);
  async function perform(fn:()=>Promise<{report:RefereeMatchReport}>){
    if(busy||!token)return;
    if(!connected||pending.length>0){setError(tr("syncBeforeChanges"));return;}
    setBusy(true);setError(null);setMessage(null);
    try{const result=await fn();
      setData(previous=>{
        if(!previous)return previous;
        const next={...previous,report:result.report};
        if(userId)void cacheRefereeMatch(userId,match.id,next);
        return next;
      });
      setSummary(result.report.summary);setMessage(tr("saved"));}
    catch(e){setError(e instanceof Error?e.message:tr("actionFailed"));}
    finally{setBusy(false);}
  }
  async function addOfflineSafeEvent(){
    if(!userId||!token||!editingKind||busy)return;
    setBusy(true);setError(null);
    const event:StagedRefereeEvent={
      id:eventId(),kind:editingKind,side:editingKind==="INCIDENT"?null:side,
      playerUserId:editingKind==="INCIDENT"?null:player,
      assistingUserId:editingKind==="GOAL"&&assistingUserId!==player?assistingUserId:null,
      period:clock.period,details,elapsedSeconds:seconds,
    };
    try{
      const state=await enqueueRefereeEvent(userId,match.id,event);
      setPending(state.pending);setEditingKind(null);setMessage(tr("eventSavedLocally"));
      if(connected){
        const flushed=await syncRefereeOffline(userId,match.id,token);
        setData(flushed.cached);setPending(flushed.pending);setMessage(tr("eventsSynced"));
      }
    }catch(e){
      // The durable queue remains intact after any transient or server failure.
      setError(e instanceof Error?e.message:tr("syncFailed"));
    }finally{setBusy(false);}
  }
  async function downloadPdf(){
    if(!token||!connected)return;
    setBusy(true);setError(null);
    try{
      const {token:ticket}=await refereeCareerApi.pdfTicket(token,match.id);
      await Linking.openURL(refereeCareerApi.pdfUrl(ticket));
    }catch(e){setError(e instanceof Error?e.message:tr("pdfError"));}
    finally{setBusy(false);}
  }
  const roster=data?.roster??[];
  const selectedTeam=side==="HOME"?data?.match.homeTeamId:data?.match.awayTeamId;
  const players=roster.filter(p=>p.teamId===selectedTeam);
  const allowsPlayer=editingKind==="GOAL"||editingKind==="YELLOW_CARD"||
    editingKind==="RED_CARD"||editingKind==="SUBSTITUTION";
  const status=report?.status??"DRAFT";
  return <View style={{gap:spacing.md}}>
    <Button variant="secondary" label={tr("back")} onPress={onClose}/>
    <Card style={{gap:spacing.sm}}>
      <AppText variant="caption" muted>{match.competitionName} · {match.venueName}</AppText>
      <View style={[styles.scoreRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={{flex:1}}><AppText weight="bold">{match.homeTeamName}</AppText></View>
        <AppText variant="title" weight="bold" forceLtr>
          {scores.homeScore}  :  {scores.awayScore}
        </AppText>
        <View style={{flex:1}}><AppText weight="bold" style={{textAlign:"right"}}>{match.awayTeamName}</AppText></View>
      </View>
      <View style={styles.clockRow}>
        <Ionicons name="timer-outline" size={26} color={colors.primary}/>
        <AppText variant="title" weight="bold" forceLtr>{clockText(seconds)}</AppText>
        <AppText variant="caption" muted>{tr("period")} {clock.period} · {data?.match.durationMinutes??match.durationMinutes} {tr("minutes")}</AppText>
      </View>
      <AppText variant="caption" muted>{tr("foulCount")}: {match.homeTeamName} {fouls("HOME")} · {match.awayTeamName} {fouls("AWAY")}</AppText>
      {(fouls("HOME")>=5||fouls("AWAY")>=5)?
        <AppText variant="caption" style={{color:colors.warning}}>{tr("foulWarning")}</AppText>:null}
      {secondCaution?<AppText variant="caption" style={{color:colors.warning}}>{tr("secondCaution")}</AppText>:null}
      <AppText variant="caption" muted>{tr("reportStatus")}: {tr("status."+status)}</AppText>
      {report?.feedback?<AppText variant="caption" style={{color:colors.warning}}>
        {tr("reviewFeedback")}: {report.feedback}</AppText>:null}
    </Card>
    {(pending.length>0||!connected)?<Card style={{gap:spacing.sm}}>
      <AppText weight="semibold" style={{color:colors.primary}}>
        {connected?tr("pendingCount")+": "+pending.length:tr("offlineMode")}</AppText>
      <AppText variant="caption" muted>{tr("offlineHint")}</AppText>
      {pending.length>0?<Button label={syncing?tr("syncing"):tr("syncNow")} variant="secondary"
        disabled={!connected||busy||syncing} onPress={()=>void synchronize()}/>:null}
    </Card>:null}
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={tr("retry")} variant="secondary" onPress={()=>void load()}/></Card>:null}
    {message?<AppText variant="caption" style={{color:colors.success}}>{message}</AppText>:null}
    {loading?<DataLoadingState variant="dashboard" minHeight={260}/>:data?<>
      {canStart?<Card style={{gap:spacing.md}}>
        <AppText variant="bodyLarge" weight="bold">{tr("checklist")}</AppText>
        {(["homePresent","awayPresent","rosterChecked","venueReady"] as const).map(key=>{
          const checks=report?.checks??{homePresent:false,awayPresent:false,rosterChecked:false,venueReady:false};
          return <Pressable key={key} accessibilityRole="checkbox"
            accessibilityState={{checked:checks[key],disabled:busy}}
            style={styles.checkRow}
            onPress={()=>void perform(()=>refereePhase2Api.update(token!,match.id,
              {revision:report?.revision??0,checks:{...checks,[key]:!checks[key]}}))}>
            <Ionicons name={checks[key]?"checkbox":"square-outline"} size={24} color={colors.primary}/>
            <AppText>{tr("checks."+key)}</AppText>
          </Pressable>;
        })}
        <Button label={tr("startMatch")} disabled={busy||!connected||pending.length>0||!report||
          !Object.values(report.checks).every(Boolean)}
          onPress={()=>void perform(()=>refereePhase2Api.clock(token!,match.id,"START",report!.revision))}/>
      </Card>:null}
      {active?<Card style={{gap:spacing.sm}}>
        <AppText variant="bodyLarge" weight="bold">{tr("clockControls")}</AppText>
        <View style={styles.actions}>
          <Button label={clock.runningSince?tr("pause"):tr("resume")} disabled={busy||!connected||pending.length>0}
            onPress={()=>void perform(()=>refereePhase2Api.clock(token!,match.id,
              clock.runningSince?"PAUSE":"RESUME",report!.revision))}/>
          {clock.period===1?<Button label={tr("secondPeriod")} variant="secondary"
            disabled={busy||!connected||pending.length>0||!!clock.runningSince} onPress={()=>void perform(()=>
              refereePhase2Api.clock(token!,match.id,"NEXT_PERIOD",report!.revision))}/>:null}
          <Button label={tr("finishMatch")} variant="danger" disabled={busy||!connected||pending.length>0}
            onPress={()=>void perform(()=>refereePhase2Api.clock(token!,match.id,"FINISH",report!.revision))}/>
        </View>
      </Card>:null}
      {recording?<Card style={{gap:spacing.md}}>
        <AppText variant="bodyLarge" weight="bold">{tr("recordEvent")}</AppText>
        <View style={styles.actions}>{kinds.map(kind=><Pressable key={kind}
          accessibilityRole="button" onPress={()=>{setEditingKind(kind);setPlayer(null);setAssistingUserId(null);setDetails("");}}
          style={[styles.kind,editingKind===kind&&styles.kindActive]}>
          <AppText variant="caption" weight="semibold">{tr("kind."+kind)}</AppText>
        </Pressable>)}</View>
        {editingKind?<View style={{gap:spacing.sm}}>
          <AppText weight="semibold">{tr("chooseTeam")}</AppText>
          <View style={styles.actions}>
            {(["HOME","AWAY"] as const).map(choice=><Button key={choice}
              label={choice==="HOME"?match.homeTeamName:match.awayTeamName}
              variant={side===choice?"primary":"secondary"}
              onPress={()=>{setSide(choice);setPlayer(null);setAssistingUserId(null);}}/>)}
          </View>
          {allowsPlayer?<><AppText variant="caption" muted>{tr("optionalPlayer")}</AppText>
            <ScrollView style={{maxHeight:180}}>
              <View style={styles.actions}>
                <Button label={tr("unassignedPlayer")} variant={player===null?"primary":"secondary"}
                  onPress={()=>setPlayer(null)}/>
                {players.map(p=><Button key={p.userId} label={p.name+(p.shirtNumber?" #"+p.shirtNumber:"")}
                  variant={player===p.userId?"primary":"secondary"}
                  onPress={()=>setPlayer(p.userId)}/>)}
              </View>
            </ScrollView></>:null}
          {editingKind==="GOAL"&&players.length>0?<View style={{gap:spacing.xs}}>
            <AppText variant="caption" muted>{tr("optionalAssister")}</AppText>
            <ScrollView style={{maxHeight:130}}><View style={styles.actions}>
              <Button label={tr("unassignedPlayer")} variant={assistingUserId===null?"primary":"secondary"}
                onPress={()=>setAssistingUserId(null)}/>
              {players.filter(p=>p.userId!==player).map(p=><Button key={p.userId}
                label={p.name} variant={assistingUserId===p.userId?"primary":"secondary"}
                onPress={()=>setAssistingUserId(p.userId)}/>)}
            </View></ScrollView>
          </View>:null}
          <TextField label={tr("eventDetails")} value={details} onChangeText={setDetails} maxLength={400}/>
          <View style={styles.actions}>
            <Button label={tr("addEvent")} disabled={busy} onPress={()=>void addOfflineSafeEvent()}/>
            <Button label={tr("cancel")} variant="secondary" onPress={()=>setEditingKind(null)}/>
          </View>
        </View>:null}
      </Card>:null}
      <Card style={{gap:spacing.sm}}>
        <AppText variant="bodyLarge" weight="bold">{tr("timeline")}</AppText>
        {!visibleEvents.length?<AppText muted>{tr("noEvents")}</AppText>:null}
        {visibleEvents.slice().reverse().map(event=><View key={event.id} style={styles.event}>
          <View style={{flex:1}}>
            <AppText weight="semibold">{tr("kind."+event.kind)} · {event.side?tr("side."+event.side):""}</AppText>
            <AppText variant="caption" muted>{tr("period")} {event.period} · {clockText(event.elapsedSeconds)}</AppText>
            {event.details?<AppText variant="caption" muted>{event.details}</AppText>:null}
            {pending.some(e=>e.id===event.id)?<AppText variant="caption"
              style={{color:colors.primary}}>{tr("unsyncedEvent")}</AppText>:null}
            {event.playerUserId?<AppText variant="caption" muted>
              {roster.find(p=>p.userId===event.playerUserId)?.name??event.playerUserId}</AppText>:null}
            {event.assistingUserId?<AppText variant="caption" muted>
              {tr("assist")}: {roster.find(p=>p.userId===event.assistingUserId)?.name??event.assistingUserId}
            </AppText>:null}
          </View>
          {recording&&connected&&pending.length===0?<Button label={tr("correctEvent")} variant="secondary"
            onPress={()=>{setDeleteId(event.id);setDeleteReason("");}}/>:null}
        </View>)}
        {deleteId?<View style={{gap:spacing.sm}}>
          <TextField label={tr("correctionReason")} value={deleteReason}
            onChangeText={setDeleteReason} maxLength={400}/>
          <View style={styles.actions}>
            <Button label={tr("confirmCorrection")} variant="danger"
              disabled={busy||deleteReason.trim().length<3}
              onPress={()=>void (async()=>{
                await perform(()=>refereePhase2Api.removeEvent(token!,match.id,deleteId,report!.revision,deleteReason));
                setDeleteId(null);
              })()}/>
            <Button label={tr("cancel")} variant="secondary" onPress={()=>setDeleteId(null)}/>
          </View>
        </View>:null}
      </Card>
      {report?.finishedAt?<Card style={{gap:spacing.md}}>
        <AppText variant="bodyLarge" weight="bold">{tr("officialReport")}</AppText>
        <AppText weight="semibold">{tr("finalScore")}: {scores.homeScore} – {scores.awayScore}</AppText>
        <TextField label={tr("summary")} multiline value={summary}
          editable={editable&&connected&&pending.length===0} maxLength={2000} onChangeText={setSummary}/>
        {editable?<Button label={tr("saveSummary")} variant="secondary" disabled={busy||!connected||pending.length>0}
          onPress={()=>void perform(()=>refereePhase2Api.update(token!,match.id,
            {revision:report.revision,summary}))}/>:null}
        {editable?<Button label={tr("submitReport")} disabled={busy||!connected||pending.length>0}
          onPress={()=>void perform(()=>refereePhase2Api.submit(token!,match.id,report.revision))}/>:null}
        {!editable?<AppText variant="caption" muted>{tr("waitingReview")}</AppText>:null}
        {report.status==="APPROVED"?<Button variant="secondary" label={tr("downloadPdf")}
          disabled={busy||!connected} onPress={()=>void downloadPdf()}/>:null}
      </Card>:null}
    </>:null}
  </View>;
}
const styles=StyleSheet.create({
  scoreRow:{alignItems:"center",gap:spacing.sm},
  clockRow:{flexDirection:"row",gap:spacing.md,alignItems:"center",flexWrap:"wrap"},
  actions:{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:spacing.sm},
  kind:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,
    backgroundColor:colors.surface,padding:spacing.sm},
  kindActive:{backgroundColor:colors.primarySoft,borderColor:colors.primary},
  checkRow:{flexDirection:"row",alignItems:"center",gap:spacing.sm,minHeight:48,
    borderBottomWidth:1,borderBottomColor:colors.border},
  event:{flexDirection:"row",alignItems:"center",gap:spacing.sm,
    borderBottomWidth:1,borderBottomColor:colors.border,paddingVertical:spacing.sm},
});
