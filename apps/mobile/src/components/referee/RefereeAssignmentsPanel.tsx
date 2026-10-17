import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import {router} from "expo-router";
import {useEffect,useRef,useState} from "react";
import {Linking,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {ApiRequestError,refereeApi,type RefereeMatch} from "../../lib/api";
import {formatRefereeScheduleParts} from "../../lib/date-time";
import {refereeAssignmentHistoryStatus,refereeAssignmentTimeConflict,
  refereeVisibleAssignments,type RefereeAssignmentSection,type RefereeHistoryStatus}
  from "../../lib/referee-assignments";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {TextField} from "../ui/TextField";

type Decision="ACCEPTED"|"DECLINED"|"WITHDRAW_REQUESTED";
const historyOptions:RefereeHistoryStatus[]=[
  "ALL","DECLINED","WITHDRAW_REQUESTED","COMPLETED","CANCELLED",
  "POSTPONED","EXPIRED","REVOKED","OTHER",
];
export function RefereeAssignmentsPanel({assignments,section,token,onChanged,onOpenMatch}:{
  assignments:RefereeMatch[];
  section:RefereeAssignmentSection;
  token:string;
  onChanged:()=>void;
  onOpenMatch:(match:RefereeMatch)=>void;
}){
  const {t,language,isRTL}=useLocale();
  const tr=(key:string)=>t(("rf1."+key) as never);
  const [query,setQuery]=useState("");
  const [venue,setVenue]=useState("ALL");
  const [historyFilter,setHistoryFilter]=useState<RefereeHistoryStatus>("ALL");
  const [confirm,setConfirm]=useState<{id:string;decision:Decision}|null>(null);
  const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [limit,setLimit]=useState(15);
  const tokenRef=useRef(token);tokenRef.current=token;
  const mountedRef=useRef(true);
  useEffect(()=>{mountedRef.current=true;return()=>{mountedRef.current=false;};},[]);
  useEffect(()=>{setConfirm(null);setReason("");setError(null);setMessage(null);},[section]);
  useEffect(()=>{setConfirm(null);setReason("");setError(null);setMessage(null);
    setQuery("");setVenue("ALL");setHistoryFilter("ALL");setLimit(15);
  },[token]);
  useEffect(()=>{setLimit(15);},[query,venue,historyFilter,section]);
  const now=Date.now();
  const venueOptions=[...new Map(assignments.filter(m=>m.venueId)
    .map(m=>[m.venueId!,m.venueName] as const)).entries()]
    .sort((a,b)=>a[1].localeCompare(b[1]));
  const history=refereeVisibleAssignments(assignments,"history",query,venue,"ALL",now);
  const availableHistoryStatuses=new Set(history.map(m=>refereeAssignmentHistoryStatus(m,now)));
  const effectiveHistoryFilter=historyFilter==="ALL"||
    availableHistoryStatuses.has(historyFilter)?historyFilter:"ALL";
  const visible=refereeVisibleAssignments(assignments,section,query,venue,
    effectiveHistoryFilter,now);
  function dateTime(startsAt:string|null){
    if(!startsAt)return tr("notSet");
    const parts=formatRefereeScheduleParts(startsAt,language);
    return parts.date+" · "+parts.time;
  }
  async function decide(match:RefereeMatch,decision:Decision){
    if(busy||!confirm||confirm.id!==match.id||confirm.decision!==decision)return;
    const capturedToken=token;
    setBusy(true);setError(null);setMessage(null);
    try{
      await refereeApi.respond(capturedToken,match.id,decision,reason.trim()||undefined);
      if(!mountedRef.current||tokenRef.current!==capturedToken)return;
      setMessage(tr("assignments.saved"));
      setConfirm(null);setReason("");onChanged();
    }catch(e){
      if(mountedRef.current&&tokenRef.current===capturedToken)
        setError(e instanceof ApiRequestError?e.message:tr("actionError"));
    }finally{
      if(mountedRef.current&&tokenRef.current===capturedToken)setBusy(false);
    }
  }
  return <View style={styles.container}>
    <Card testID="referee-assignments-filters">
      <TextField label={tr("assignments.search")} value={query}
        placeholder={tr("assignments.searchPlaceholder")} onChangeText={setQuery}/>
      <AppText weight="semibold">{tr("assignments.venueFilter")}</AppText>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}
        style={styles.chipScroll} contentContainerStyle={[styles.chips,
          {flexDirection:isRTL?"row-reverse":"row"}]}>
        {[{id:"ALL",label:tr("assignments.allVenues")},
          ...venueOptions.map(([id,label])=>({id,label}))].map(option=>
          <Pressable key={option.id} accessibilityRole="button"
            accessibilityState={{selected:venue===option.id}}
            style={[styles.chip,venue===option.id&&styles.chipActive]}
            onPress={()=>{setVenue(option.id);setHistoryFilter("ALL");setConfirm(null);}}>
            <AppText variant="caption" weight="semibold"
              style={venue===option.id?{color:colors.primary}:undefined}>
              {option.label}</AppText>
          </Pressable>)}
      </ScrollView>
      {section==="history"?<>
        <AppText weight="semibold">{tr("assignments.historyFilter")}</AppText>
        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}
          style={styles.chipScroll} contentContainerStyle={[styles.chips,
            {flexDirection:isRTL?"row-reverse":"row"}]}>
          {historyOptions.filter(status=>status==="ALL"||
            availableHistoryStatuses.has(status)).map(status=>
            <Pressable key={status} accessibilityRole="button"
              accessibilityState={{selected:effectiveHistoryFilter===status}}
              style={[styles.chip,effectiveHistoryFilter===status&&styles.chipActive]}
              onPress={()=>{setHistoryFilter(status);setConfirm(null);}}>
              <AppText variant="caption" weight="semibold"
                style={effectiveHistoryFilter===status?{color:colors.primary}:undefined}>
                {tr("assignments.status."+status)}</AppText>
            </Pressable>)}
        </ScrollView>
      </>:null}
      <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <AppText variant="caption" muted style={{flex:1}}>
          {tr("assignments.results")}: {visible.length}</AppText>
        {(query||venue!=="ALL"||historyFilter!=="ALL")?<Button
          label={tr("assignments.clear")} variant="ghost"
          onPress={()=>{setQuery("");setVenue("ALL");setHistoryFilter("ALL");
            setConfirm(null);}}/>:null}
      </View>
    </Card>
    {error?<Card testID="referee-assignment-error">
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={tr("retry")} variant="secondary" onPress={()=>setError(null)}/>
    </Card>:null}
    {message?<Card><AppText style={{color:colors.success}}>{message}</AppText></Card>:null}
    {visible.length===0?<Card testID="referee-assignments-empty">
      <AppText muted>{tr("assignments.empty")}</AppText>
    </Card>:null}
    {visible.slice(0,limit).map(match=>{
      const conflict=section==="pending"?
        refereeAssignmentTimeConflict(match,assignments):null;
      const future=!!match.startsAt&&Date.parse(match.startsAt)>now;
      const canAccept=section==="pending"&&future&&!!match.endsAt&&!conflict;
      const canWithdraw=section==="confirmed"&&match.matchStatus==="SCHEDULED"&&future;
      const action=confirm?.id===match.id?confirm.decision:null;
      const permitted=action==="ACCEPTED"&&canAccept||
        action==="DECLINED"&&section==="pending"||
        action==="WITHDRAW_REQUESTED"&&canWithdraw;
      const status=refereeAssignmentHistoryStatus(match,now);
      return <Card testID={"referee-assignment-"+match.id}
        key={match.id} style={styles.assignment}>
        <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={{flex:1,gap:spacing.xs}}>
            <AppText weight="bold">{match.homeTeamName} VS {match.awayTeamName}</AppText>
            <AppText variant="caption" muted>{match.competitionName} · {match.venueName}</AppText>
          </View>
          <View style={styles.statusBadge}>
            <AppText weight="semibold" variant="caption" style={{color:colors.primary}}>
              {section==="history"?tr("assignments.status."+status):
                tr("status."+match.responseStatus)}</AppText>
          </View>
        </View>
        <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary}/>
          <AppText style={{flex:1}}>{dateTime(match.startsAt)}</AppText>
        </View>
        <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="location-outline" size={18} color={colors.primary}/>
          <AppText variant="caption" muted style={{flex:1}}>
            {match.venueAddress||match.venueName} · {match.durationMinutes} {tr("minutes")}
          </AppText>
        </View>
        {match.responseReason?<AppText variant="caption" muted>
          {tr("assignments.reason")}: {match.responseReason}</AppText>:null}
        {!match.authorized?<AppText variant="caption" style={{color:colors.danger}}>
          {tr("venueRevoked")}</AppText>:null}
        <View style={styles.actions}>
          <Button label={tr("details")} variant="secondary" onPress={()=>router.push({
            pathname:"/competitions/[competitionId]/matches/[matchId]",
            params:{competitionId:match.competitionId,matchId:match.id},
          })}/>
          {match.latitude!==null&&match.longitude!==null?<Button
            label={tr("location")} variant="secondary"
            onPress={()=>void Linking.openURL(
              `https://www.google.com/maps/search/?api=1&query=${match.latitude},${match.longitude}`
            ).catch(()=>setError(tr("mapError")))}/>:null}
          {section==="confirmed"&&match.authorized?
            <Button label={t("rf2.openMatch")} variant="secondary"
              onPress={()=>onOpenMatch(match)}/>:null}
        </View>
        {section==="pending"?<>
          {future&&Date.parse(match.startsAt!)-now<=24*60*60_000?
            <AppText variant="caption" style={{color:colors.warning}}>
              {tr("assignments.kickoffSoon")}</AppText>:null}
          {!match.endsAt?<AppText variant="caption" style={{color:colors.danger}}>
            {tr("assignments.missingEndTime")}</AppText>:null}
          {conflict?<View style={styles.conflict}>
            <AppText weight="semibold" style={{color:colors.danger}}>
              {tr("assignments.conflict")}</AppText>
            <AppText variant="caption">
              {conflict.homeTeamName} VS {conflict.awayTeamName} · {dateTime(conflict.startsAt)}
            </AppText>
          </View>:null}
          <View style={styles.actions}>
            <Button label={tr("accept")} disabled={busy||!canAccept}
              onPress={()=>{setConfirm({id:match.id,decision:"ACCEPTED"});setReason("");}}/>
            <Button label={tr("decline")} variant="secondary" disabled={busy}
              onPress={()=>{setConfirm({id:match.id,decision:"DECLINED"});setReason("");}}/>
          </View>
        </>:null}
        {canWithdraw?<Button label={tr("withdraw")} variant="secondary"
          disabled={busy}
          onPress={()=>{setConfirm({id:match.id,decision:"WITHDRAW_REQUESTED"});
            setReason("");}}/>:null}
        {action&&permitted?<View testID="referee-assignment-confirmation"
          style={styles.confirmation}>
          <AppText weight="bold" variant="bodyLarge">{tr("assignments.confirmTitle")}</AppText>
          <AppText variant="caption" muted>{tr(action==="ACCEPTED"?
            "assignments.confirmAccept":action==="DECLINED"?
            "assignments.confirmDecline":"assignments.confirmWithdraw")}</AppText>
          {action!=="ACCEPTED"?<TextField
            label={action==="DECLINED"?tr("declineReason"):tr("withdrawReason")}
            maxLength={400} value={reason} onChangeText={setReason}/>:null}
          <View style={styles.actions}>
            <Button label={tr("assignments.confirmAction")} loading={busy}
              disabled={busy||action==="WITHDRAW_REQUESTED"&&reason.trim().length<3}
              onPress={()=>void decide(match,action)}/>
            <Button label={tr("assignments.cancelAction")}
              disabled={busy} variant="secondary"
              onPress={()=>{setConfirm(null);setReason("");}}/>
          </View>
        </View>:null}
      </Card>;
    })}
    {visible.length>limit?<Button testID="referee-assignments-more"
      label={tr("assignments.showMore")} variant="secondary"
      onPress={()=>setLimit(value=>value+15)}/>:null}
  </View>;
}
const styles=StyleSheet.create({
  container:{gap:spacing.md},
  assignment:{gap:spacing.md},
  row:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  actions:{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:spacing.sm},
  statusBadge:{backgroundColor:colors.primarySoft,borderRadius:radius.md,
    paddingVertical:spacing.xs,paddingHorizontal:spacing.sm},
  chipScroll:{flexGrow:0,flexShrink:0,width:"100%"},
  chips:{alignItems:"center",gap:spacing.sm,paddingVertical:spacing.xs},
  chip:{minHeight:42,paddingHorizontal:spacing.md,justifyContent:"center",
    borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,
    borderRadius:radius.md},
  chipActive:{backgroundColor:colors.primarySoft,borderColor:colors.primary},
  conflict:{padding:spacing.md,gap:spacing.sm,backgroundColor:colors.surfaceMuted,
    borderRadius:radius.md,borderWidth:1,borderColor:colors.danger},
  confirmation:{padding:spacing.md,gap:spacing.md,backgroundColor:colors.primarySoft,
    borderRadius:radius.md,borderWidth:1,borderColor:colors.primary},
});
