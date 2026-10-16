import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, spacing, radius } from "@leaguekick/design-tokens";
import type { CompetitionDiscoveryItem, CompetitionParticipationDto, TeamDto } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  ApiRequestError, competitionApi, teamOperationsApi,
  type TeamActivityInput,type TeamOpsActivity,type TeamOpsCompetition,type TeamOpsMatch,
  type TeamOperations,type TeamAvailability,
} from "../../lib/api";
import { formatCompetitionDateTime } from "../../lib/date-time";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DateTimePickerField } from "../ui/DateTimePickerField";
import { DirectoryFilterSelect } from "../social/DirectoryFilterSelect";
import { DataLoadingState } from "../ui/DataLoadingState";
import { TextField } from "../ui/TextField";

type Tab="competitions"|"matches"|"schedule";
const done=(status:string)=>status==="COMPLETED"||status==="CORRECTED";
const upcoming=(match:TeamOpsMatch)=>!done(match.status)&&!["CANCELLED","IN_PROGRESS"].includes(match.status);
const emptyActivity:TeamActivityInput={kind:"TRAINING",title:"",notes:null,location:null,startsAt:"",endsAt:""};
function relativeKabulDay(value:string){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kabul",year:"numeric",month:"2-digit",day:"2-digit"})
    .formatToParts(new Date(value));
  const part=(kind:string)=>parts.find(p=>p.type===kind)?.value??"00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function Options({options,current,set}:{options:{id:string;label:string}[];current:string;set:(id:string)=>void}){
  return <ScrollView horizontal showsHorizontalScrollIndicator={false}
    contentContainerStyle={{gap:spacing.sm,alignItems:"center",paddingVertical:spacing.xs}}>
    {options.map(item=><Pressable key={item.id} accessibilityRole="button"
      accessibilityState={{selected:current===item.id}} onPress={()=>set(item.id)}
      style={[styles.chip,current===item.id&&styles.chipActive]}>
      <AppText variant="caption" weight="semibold" style={current===item.id?{color:colors.primary}:undefined}>{item.label}</AppText>
    </Pressable>)}
  </ScrollView>;
}
function CompetitionLink({id,label,tab}:{id:string;label:string;tab?:string}){
  return <Button label={label} variant="secondary"
    onPress={()=>router.push({pathname:"/competitions/[competitionId]",
      params:{competitionId:id,...(tab?{tab}:{})}})}/>;
}
function SmallStatus({status}:{status:string}){
  return <View style={styles.status}><AppText variant="caption" weight="semibold" style={{color:colors.primary}}>{status.replaceAll("_"," ")}</AppText></View>;
}

export function TeamCompetitionOps({tab,team,token,canWrite,onSelectTab,focusMatchId,onConsumedFocus}:{
  tab:Tab;team:TeamDto;token:string;canWrite:boolean;onSelectTab:(tab:Tab)=>void;
  focusMatchId?:string|null;onConsumedFocus?:()=>void;
}){
  const {t,language,isRTL}=useLocale();
  const [data,setData]=useState<TeamOperations|null>(null);
  const [available,setAvailable]=useState<CompetitionDiscoveryItem[]>([]);
  const [discoveryProvinces,setDiscoveryProvinces]=useState<string[]>([]);
  const [discoveryPage,setDiscoveryPage]=useState(1);
  const [discoveryHasMore,setDiscoveryHasMore]=useState(false);
  const [discoveryTotal,setDiscoveryTotal]=useState(0);
  const [discoveryLoading,setDiscoveryLoading]=useState(false);
  const [discoveryError,setDiscoveryError]=useState(false);
  const [discoveryRetry,setDiscoveryRetry]=useState(0);
  const [appliedSearch,setAppliedSearch]=useState("");
  const [participations,setParticipations]=useState<CompetitionParticipationDto[]>([]);
  const [participationReady,setParticipationReady]=useState(false);
  const [withdrawId,setWithdrawId]=useState<string|null>(null);
  const [competitionSection,setCompetitionSection]=useState<"MINE"|"INVITATIONS"|"DISCOVER">("MINE");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [note,setNote]=useState<string|null>(null);
  const [reload,setReload]=useState(0);
  const [filter,setFilter]=useState("ALL");
  const [search,setSearch]=useState("");
  const searchRef=useRef("");
  searchRef.current=search.trim();
  const [province,setProvince]=useState("ALL");
  const [matchFilter,setMatchFilter]=useState("UPCOMING");
  const [focusedCompetition,setFocusedCompetition]=useState<string|null>(null);
  const [rosterIds,setRosterIds]=useState<string[]>([]);
  const [focusedMatch,setFocusedMatch]=useState<string|null>(null);
  const [starters,setStarters]=useState<string[]>([]);
  const [substitutes,setSubstitutes]=useState<string[]>([]);
  const [captainId,setCaptainId]=useState<string|null>(null);
  const [view,setView]=useState<"DAY"|"WEEK"|"MONTH">("WEEK");
  const [cursor,setCursor]=useState(()=>new Date());
  const [activity,setActivity]=useState<TeamActivityInput>(emptyActivity);
  const [editingActivity,setEditingActivity]=useState<string|null>(null);
  const [showActivity,setShowActivity]=useState(false);
  const date=(value:string|null)=>value?formatCompetitionDateTime(value,language):t("tm2.unscheduled");
  const tr=(key:string)=>t(`tm2.${key}` as never);
  const reloadData=useCallback(()=>setReload(x=>x+1),[]);

  useEffect(()=>{
    let active=true;setLoading(true);setError(null);setFocusedCompetition(null);setFocusedMatch(null);
    void teamOperationsApi.list(token,team.id).then(result=>{if(active)setData(result);})
      .catch(e=>{if(active){setError(e instanceof ApiRequestError?e.message:t("tm2.loadFailed"));setData(null);}})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[token,team.id,reload,t]);

  // Search the server instead of downloading every competition/venue into the
  // manager dashboard. Results are paginated and scoped to open registration.
  useEffect(()=>{
    const timer=setTimeout(()=>{setAppliedSearch(search.trim());setDiscoveryPage(1);},350);
    return()=>clearTimeout(timer);
  },[search]);
  useEffect(()=>{
    if(tab!=="competitions"||competitionSection!=="DISCOVER")return;
    let active=true;
    setDiscoveryLoading(true);setDiscoveryError(false);
    void competitionApi.discover({
      q:appliedSearch,province:province==="ALL"?"":province,city:"",
      fee:"any",sort:"starting",scope:"registration",phase:"all",
      page:discoveryPage,limit:12,
    }).then(result=>{
      if(!active||searchRef.current!==appliedSearch)return;
      setAvailable(previous=>discoveryPage===1?result.competitions:[
        ...previous.filter(item=>!result.competitions.some(next=>next.id===item.id)),
        ...result.competitions,
      ]);
      setDiscoveryProvinces(result.facets.provinces);
      setDiscoveryTotal(result.total);setDiscoveryHasMore(result.hasMore);
    }).catch(()=>{
      if(active&&searchRef.current===appliedSearch)setDiscoveryError(true);
    }).finally(()=>{if(active&&searchRef.current===appliedSearch)setDiscoveryLoading(false);});
    return()=>{active=false;};
  },[tab,competitionSection,appliedSearch,province,discoveryPage,reload,discoveryRetry]);

  // Withdraw controls must only be shown when the server grants permission;
  // if participation data is unavailable, no speculative withdrawal is shown.
  useEffect(()=>{
    if(tab!=="competitions")return;
    let active=true;
    setParticipations([]);setParticipationReady(false);
    void competitionApi.myParticipations(token).then(result=>{
      if(!active)return;
      setParticipations(result.participations.filter(item=>item.teamId===team.id));
      setParticipationReady(true);
    }).catch(()=>{if(active)setParticipationReady(false);});
    return()=>{active=false;};
  },[tab,token,team.id,reload]);
  useEffect(()=>{
    setCompetitionSection("MINE");setFilter("ALL");setSearch("");
    setAppliedSearch("");setProvince("ALL");setDiscoveryPage(1);
    setAvailable([]);setWithdrawId(null);setFocusedCompetition(null);
  },[team.id]);

  async function execute(fn:()=>Promise<unknown>,after?:()=>void){
    if(busy)return;
    setBusy(true);setError(null);setNote(null);
    try{await fn();after?.();setNote(t("tm2.saved"));reloadData();}
    catch(e){setError(e instanceof ApiRequestError?e.message:t("tm2.actionFailed"));}
    finally{setBusy(false);}
  }
  const registrations=data?.competitions??[];
  const matches=data?.matches??[];
  const allActivity=data?.activities??[];
  const requestedCompetition=registrations.find(x=>x.id===focusedCompetition);
  const requestedMatch=matches.find(x=>x.id===focusedMatch);
  const matchCompetition=registrations.find(x=>x.id===requestedMatch?.competitionId);
  const today=relativeKabulDay(new Date().toISOString());
  const discovery=available.filter(c=>c.published&&c.status==="REGISTRATION_OPEN"&&
    !registrations.some(r=>r.id===c.id));
  const registrationsShown=registrations.filter(c=>c.registrationStatus!=="INVITED").filter(c=>filter==="ALL"||
    filter==="INVITED"&&c.registrationStatus==="INVITED"||
    filter==="PENDING"&&["APPLIED","PENDING"].includes(c.registrationStatus)||
    filter==="UPCOMING"&&c.registrationStatus==="ACCEPTED"&&["REGISTRATION_OPEN","REGISTRATION_CLOSED","SCHEDULED"].includes(c.status)||
    filter==="IN_PROGRESS"&&c.status==="IN_PROGRESS"||
    filter==="COMPLETED"&&["COMPLETED","ARCHIVED"].includes(c.status));
  const invitations=registrations.filter(c=>c.registrationStatus==="INVITED");
  const pendingRegistrations=registrations.filter(c=>["APPLIED","PENDING"].includes(c.registrationStatus));
  const openRosters=registrations.filter(c=>c.registrationStatus==="ACCEPTED"&&!c.rosterLocked&&c.rosterUserIds.length===0);
  const closingSoon=(value:string|null)=>{
    if(!value)return false;
    const remaining=Date.parse(value)-Date.now();
    return remaining>0&&remaining<=3*24*60*60*1000;
  };
  const registrationStatus=(status:string)=>t(`tm4.registrationStatus.${status}` as never);
  const competitionStatus=(status:string)=>t(`competition.status.${status}` as never);
  const canWithdraw=(id:string)=>participationReady&&participations.some(item=>item.competitionId===id&&item.canWithdraw);
  const visibleMatches=matches.filter(m=>matchFilter==="ALL"||
    matchFilter==="UPCOMING"&&upcoming(m)||
    matchFilter==="TODAY"&&!!m.startsAt&&relativeKabulDay(m.startsAt)===today||
    matchFilter==="COMPLETED"&&done(m.status)||
    matchFilter==="CANCELLED"&&m.status==="CANCELLED");
  const sortedMatches=[...visibleMatches].sort((a,b)=>(a.startsAt??"9999").localeCompare(b.startsAt??"9999"));
  function openRoster(c:TeamOpsCompetition){setFocusedCompetition(c.id);setRosterIds(c.rosterUserIds);}
  function openLineup(m:TeamOpsMatch){setFocusedMatch(m.id);setStarters(m.lineup?.starters??[]);
    setSubstitutes(m.lineup?.substitutes??[]);setCaptainId(m.lineup?.captainUserId??null);}
  // The Overview action center opens the intended fixture's lineup directly,
  // rather than landing on an unrelated date or competition.
  useEffect(()=>{
    if(tab!=="matches"||!focusMatchId||!data||loading)return;
    const match=data.matches.find(value=>value.id===focusMatchId);
    if(!match)return;
    openLineup(match);
    onConsumedFocus?.();
  },[tab,focusMatchId,data,loading,onConsumedFocus]);
  function setLineupMember(id:string,role:"START"|"SUB"|"NONE"){
    const isStart=starters.includes(id),isSub=substitutes.includes(id);
    if(role==="START"&&!isStart&&starters.length>=5){setError(t("tm2.fiveLimit"));return;}
    setStarters(old=>role==="START"?isStart?old:[...old,id]:old.filter(x=>x!==id));
    setSubstitutes(old=>role==="SUB"?isSub?old:[...old,id]:old.filter(x=>x!==id));
    if(role==="NONE"&&captainId===id)setCaptainId(null);
  }
  const lineupEligible=team.members.filter(x=>matchCompetition?.rosterUserIds.includes(x.userId));
  const lineupSelected=[...starters,...substitutes];
  const dateKey=relativeKabulDay(cursor.toISOString());
  function moveCursor(delta:number){
    const day=new Date(cursor);
    if(view==="MONTH")day.setUTCMonth(day.getUTCMonth()+delta);
    else day.setUTCDate(day.getUTCDate()+delta*(view==="WEEK"?7:1));
    setCursor(day);
  }
  function showOnCalendar(iso:string){
    const day=relativeKabulDay(iso);
    if(view==="DAY")return day===dateKey;
    // Date arithmetic is only for filtering; display remains Kabul localized.
    const eventDay=new Date(day+"T12:00:00Z");
    const focus=new Date(dateKey+"T12:00:00Z");
    if(view==="WEEK"){
      const start=focus.getTime()-focus.getUTCDay()*86400000;
      return eventDay.getTime()>=start&&eventDay.getTime()<start+7*86400000;
    }
    return day.slice(0,7)===dateKey.slice(0,7);
  }
  const schedule=allActivity.filter(a=>showOnCalendar(a.startsAt));
  const scheduledMatches=matches.filter(m=>!!m.startsAt&&showOnCalendar(m.startsAt));
  function startActivity(item?:TeamOpsActivity){
    setEditingActivity(item?.id??null);
    setActivity(item?{kind:item.kind,title:item.title,notes:item.notes,location:item.location,
      startsAt:item.startsAt,endsAt:item.endsAt}:emptyActivity);
    setShowActivity(true);
  }
  const setActivityValue=<K extends keyof TeamActivityInput,>(key:K,value:TeamActivityInput[K])=>
    setActivity(old=>({...old,[key]:value}));

  return <View style={{gap:spacing.md}}>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary" onPress={reloadData}/></Card>:null}
    {note?<Card style={{backgroundColor:colors.primarySoft}}><AppText style={{color:colors.primary}}>{note}</AppText></Card>:null}
    {loading?<DataLoadingState variant="list" minHeight={350}/>:data?<>
      {tab==="competitions"?<>
        <View testID="tm4-competition-tabs" style={styles.compSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.compTabs,{flexDirection:isRTL?"row-reverse":"row"}]}>
            {([
              {id:"MINE",icon:"shield-checkmark-outline",title:t("tm4.myCompetitions"),
                count:registrations.filter(c=>c.registrationStatus!=="INVITED").length},
              {id:"INVITATIONS",icon:"mail-unread-outline",title:t("tm4.invitations"),
                count:invitations.length},
              {id:"DISCOVER",icon:"search-outline",title:t("tm4.discover"),count:null},
            ] as const).map(item=><Pressable key={item.id}
              testID={`tm4-tab-${item.id}`} accessibilityRole="tab"
              accessibilityState={{selected:competitionSection===item.id}}
              onPress={()=>{setCompetitionSection(item.id);setFocusedCompetition(null);setWithdrawId(null);}}
              style={[styles.compTab,competitionSection===item.id&&styles.compTabSelected]}>
              <Ionicons name={item.icon} size={19}
                color={competitionSection===item.id?colors.primary:colors.textMuted}/>
              <AppText weight="semibold" variant="caption"
                style={competitionSection===item.id?{color:colors.primary}:undefined}>{item.title}</AppText>
              {item.count!==null?<View style={styles.compCount}>
                <AppText variant="caption" weight="bold" style={{color:colors.primary}}>{item.count}</AppText>
              </View>:null}
            </Pressable>)}
          </ScrollView>

          {competitionSection==="MINE"?<Card testID="tm4-my-competitions" style={styles.compCard}>
            <AppText variant="bodyLarge" weight="bold">{tr("joinedTitle")}</AppText>
            <View style={[styles.compSummary,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <View style={styles.compSummaryCell}>
                <AppText variant="title" weight="bold" style={{color:colors.primary}}>{registrations.length}</AppText>
                <AppText variant="caption" muted>{t("tm4.total")}</AppText>
              </View>
              <View style={styles.compSummaryCell}>
                <AppText variant="title" weight="bold" style={{color:colors.primary}}>{pendingRegistrations.length}</AppText>
                <AppText variant="caption" muted>{t("tm4.pending")}</AppText>
              </View>
              <View style={styles.compSummaryCell}>
                <AppText variant="title" weight="bold" style={{color:colors.primary}}>{openRosters.length}</AppText>
                <AppText variant="caption" muted>{t("tm4.incompleteRosters")}</AppText>
              </View>
            </View>
            <Options current={filter} set={setFilter}
              options={["ALL","PENDING","UPCOMING","IN_PROGRESS","COMPLETED"].map(id=>({id,label:tr("filter."+id)}))}/>
            {!registrationsShown.length?<View style={styles.compEmpty}>
              <Ionicons name="trophy-outline" size={28} color={colors.textMuted}/>
              <AppText muted>{tr("noRegistrations")}</AppText>
              <Button label={t("tm4.discover")} variant="secondary" onPress={()=>setCompetitionSection("DISCOVER")}/>
            </View>:null}
            {registrationsShown.map(c=>{
              const deadline=c.registrationClosesAt??c.startsAt;
              const incomplete=c.registrationStatus==="ACCEPTED"&&c.rosterUserIds.length===0;
              return <View key={c.id} style={styles.compItem}>
                <AppText weight="bold" variant="bodyLarge">{c.name}</AppText>
                <AppText variant="caption" muted>{c.venueName} · {date(c.startsAt)}</AppText>
                <View style={[styles.flexRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
                  <SmallStatus status={competitionStatus(c.status)}/>
                  <SmallStatus status={registrationStatus(c.registrationStatus)}/>
                </View>
                <AppText variant="caption" muted>{t("tm4.feeStatus")}: {t(`tm4.fee.${c.feeStatus}` as never)}</AppText>
                <AppText variant="caption" muted>{tr("deadline")}: {date(deadline)}</AppText>
                {incomplete?<AppText variant="caption" style={{color:colors.warning}}>
                  {t("tm4.rosterRequired")}
                </AppText>:null}
                {incomplete&&closingSoon(deadline)?<AppText variant="caption" style={{color:colors.danger}}>
                  {t("tm4.deadlineSoon")}
                </AppText>:null}
                {c.rosterLocked?<AppText variant="caption" muted>{tr("rosterLocked")}</AppText>:null}
                <View style={[styles.controls,{flexDirection:isRTL?"row-reverse":"row"}]}>
                  <CompetitionLink id={c.id} label={tr("details")}/>
                  {c.registrationStatus==="ACCEPTED"?<Button
                    label={c.rosterLocked?t("tm4.viewRoster"):incomplete?t("tm4.completeRoster"):tr("competitionRoster")}
                    variant="secondary" onPress={()=>openRoster(c)}/>:null}
                  {canWithdraw(c.id)?<Button variant="secondary" label={t("tm4.withdraw")}
                    disabled={!canWrite||busy} onPress={()=>setWithdrawId(c.id)}/>:null}
                </View>
                {withdrawId===c.id?<View testID="tm4-withdraw-confirm" style={styles.compDanger}>
                  <AppText weight="semibold">{t("tm4.withdrawConfirm")}</AppText>
                  <View style={[styles.controls,{flexDirection:isRTL?"row-reverse":"row"}]}>
                    <Button label={t("tm4.withdraw")} variant="danger" disabled={!canWrite||busy}
                      loading={busy} onPress={()=>void execute(
                        ()=>competitionApi.withdraw(token,c.id,team.id),()=>setWithdrawId(null))}/>
                    <Button label={t("common.cancel")} variant="secondary"
                      onPress={()=>setWithdrawId(null)}/>
                  </View>
                </View>:null}
              </View>;
            })}
          </Card>:null}

          {competitionSection==="INVITATIONS"?<Card testID="tm4-invitations" style={styles.compCard}>
            <AppText variant="bodyLarge" weight="bold">{t("tm4.invitations")} ({invitations.length})</AppText>
            <AppText variant="caption" muted>{t("tm4.invitationsHint")}</AppText>
            {!invitations.length?<View style={styles.compEmpty}>
              <Ionicons name="mail-outline" size={29} color={colors.textMuted}/>
              <AppText muted>{t("tm4.noInvitations")}</AppText>
            </View>:null}
            {invitations.map(c=><View key={c.id} style={styles.compItem}>
              <AppText weight="bold" variant="bodyLarge">{c.name}</AppText>
              <AppText variant="caption" muted>{c.venueName} · {date(c.startsAt)}</AppText>
              <SmallStatus status={registrationStatus(c.registrationStatus)}/>
              <AppText variant="caption" muted>{tr("deadline")}: {date(c.registrationClosesAt??c.startsAt)}</AppText>
              <View style={[styles.controls,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <CompetitionLink id={c.id} label={tr("details")}/>
                <Button label={tr("accept")} disabled={!canWrite||busy} loading={busy}
                  onPress={()=>void execute(()=>competitionApi.respondInvitation(token,c.id,team.id,{status:"ACCEPTED"}))}/>
                <Button label={tr("decline")} variant="secondary" disabled={!canWrite||busy}
                  onPress={()=>void execute(()=>competitionApi.respondInvitation(token,c.id,team.id,{status:"REJECTED"}))}/>
              </View>
            </View>)}
          </Card>:null}

          {requestedCompetition&&competitionSection==="MINE"?<Card testID="tm4-roster-editor" style={styles.compCard}>
            <AppText variant="bodyLarge" weight="bold">{tr("competitionRoster")}</AppText>
            <AppText weight="semibold">{requestedCompetition.name}</AppText>
            <AppText variant="caption" muted>{tr("rosterHint")}</AppText>
            <AppText variant="caption" muted>{tr("deadline")}: {date(requestedCompetition.registrationClosesAt??requestedCompetition.startsAt)}</AppText>
            <AppText variant="caption" muted>{t("tm4.currentRoster",{count:rosterIds.length})}</AppText>
            {team.members.map(player=><Pressable key={player.userId} style={[styles.rowCell,{flexDirection:isRTL?"row-reverse":"row"}]}
              disabled={!canWrite||requestedCompetition.rosterLocked}
              accessibilityRole="checkbox" accessibilityState={{checked:rosterIds.includes(player.userId)}}
              onPress={()=>setRosterIds(prev=>prev.includes(player.userId)?prev.filter(id=>id!==player.userId):prev.length>=40?prev:[...prev,player.userId])}>
              <Ionicons name={rosterIds.includes(player.userId)?"checkbox":"square-outline"} size={22} color={colors.primary}/>
              <AppText style={{flex:1}}>{player.publicDisplayName} {player.shirtNumber!==null?`#${player.shirtNumber}`:""}</AppText>
            </Pressable>)}
            <AppText muted variant="caption">{tr("selected")}: {rosterIds.length}/40</AppText>
            {!requestedCompetition.rosterLocked?<Button label={t("common.save")}
              disabled={!canWrite||busy} loading={busy}
              onPress={()=>void execute(()=>teamOperationsApi.roster(token,team.id,requestedCompetition.id,rosterIds),
                ()=>setFocusedCompetition(null))}/>:null}
            <Button label={t("common.cancel")} variant="secondary" onPress={()=>setFocusedCompetition(null)}/>
            {requestedCompetition.rosterLocked?<AppText muted>{tr("rosterLocked")}</AppText>:null}
          </Card>:null}

          {competitionSection==="DISCOVER"?<Card testID="tm4-discover" style={styles.compCard}>
            <AppText variant="bodyLarge" weight="bold">{tr("findTitle")}</AppText>
            <TextField testID="tm4-search" label={tr("search")} value={search}
              onChangeText={value=>{
                setSearch(value);setDiscoveryPage(1);setAvailable([]);
                setDiscoveryTotal(0);setDiscoveryHasMore(false);setDiscoveryLoading(true);
              }} maxLength={120}/>
            <DirectoryFilterSelect compact testID="tm4-province-select"
              label={tr("province")} allLabel={tr("filter.ALL")}
              value={province==="ALL"?"":province}
              options={discoveryProvinces.map(value=>({value,label:value}))}
              onSelect={value=>{
                setProvince(value||"ALL");setDiscoveryPage(1);setAvailable([]);
                setDiscoveryTotal(0);setDiscoveryHasMore(false);
              }}/>
            {discoveryError?<View style={styles.compDanger}>
              <AppText style={{color:colors.danger}}>{tr("discoveryFailed")}</AppText>
              <Button label={t("common.retry")} variant="secondary" onPress={()=>setDiscoveryRetry(x=>x+1)}/>
            </View>:null}
            <AppText variant="caption" muted>{t("tm4.results",{count:discoveryTotal})}</AppText>
            {discoveryLoading&&discoveryPage===1?<DataLoadingState variant="list" minHeight={180}/>:null}
            {!discoveryLoading&&!discoveryError&&!discovery.length?<View style={styles.compEmpty}>
              <Ionicons name="search-outline" size={27} color={colors.textMuted}/>
              <AppText muted>{tr("noAvailable")}</AppText>
            </View>:null}
            {discovery.map(c=>{
              const cutoff=c.registrationClosesAt??c.startsAt;
              const expired=!!cutoff&&Date.parse(cutoff)<=Date.now();
              const full=c.acceptedTeams>=c.maxTeams;
              return <View key={c.id} style={styles.compItem}>
                <AppText weight="semibold" variant="bodyLarge">{c.name}</AppText>
                <AppText variant="caption" muted>{c.venueName} · {c.province}</AppText>
                <AppText variant="caption" muted>{t(`competition.format.${c.format}` as never)} · {date(c.startsAt)}</AppText>
                <AppText variant="caption" muted>{tr("deadline")}: {date(cutoff)}</AppText>
                <AppText variant="caption" muted>{t("tm4.fee")}: {c.registrationFeeAfn} AFN</AppText>
                <AppText variant="caption" muted>{t("tm4.capacity",{accepted:c.acceptedTeams,max:c.maxTeams})}</AppText>
                <View style={[styles.controls,{flexDirection:isRTL?"row-reverse":"row"}]}>
                  <CompetitionLink id={c.id} label={tr("details")}/>
                  <Button label={full?t("tm4.full"):expired?t("tm4.closed"):tr("register")}
                    disabled={!canWrite||busy||expired||full} loading={busy}
                    onPress={()=>void execute(()=>competitionApi.register(token,c.id,team.id))}/>
                </View>
              </View>;
            })}
            {discoveryHasMore?<Button testID="tm4-show-more" label={t("tm4.showMore")}
              variant="secondary" loading={discoveryLoading} disabled={discoveryLoading}
              onPress={()=>setDiscoveryPage(v=>v+1)}/>:null}
            <Button label={tr("exploreAll")} variant="ghost" onPress={()=>router.push("/competitions")}/>
          </Card>:null}
        </View>
      </>:null}

      {tab==="matches"?<>
        {requestedMatch?<Card>
          <AppText variant="bodyLarge" weight="bold">{tr("lineup")}</AppText>
          <AppText weight="semibold">{requestedMatch.opponentName??tr("unknownOpponent")}</AppText>
          <AppText variant="caption" muted>{tr("lineupHint")}</AppText>
          {!matchCompetition?.rosterUserIds.length?<AppText style={{color:colors.danger}}>{tr("rosterFirst")}</AppText>:null}
          {lineupEligible.map(p=><View key={p.userId} style={styles.item}>
            <AppText weight="semibold">{p.publicDisplayName}</AppText>
            <Options current={starters.includes(p.userId)?"START":substitutes.includes(p.userId)?"SUB":"NONE"}
              set={role=>setLineupMember(p.userId,role as "START"|"SUB"|"NONE")}
              options={["START","SUB","NONE"].map(id=>({id,label:tr("lineup."+id)}))}/>
          </View>)}
          <AppText variant="caption" muted>{tr("selected")}: {starters.length}/5 · {tr("substitutes")}: {substitutes.length}</AppText>
          <AppText weight="semibold">{tr("captain")}</AppText>
          <Options current={captainId??"NONE"} set={id=>setCaptainId(id==="NONE"?null:id)}
            options={[{id:"NONE",label:tr("lineup.NONE")},...team.members.filter(x=>lineupSelected.includes(x.userId)).map(x=>({id:x.userId,label:x.publicDisplayName}))]}/>
          <Button label={t("common.save")} loading={busy} disabled={!canWrite||busy||!matchCompetition?.rosterUserIds.length}
            onPress={()=>void execute(()=>teamOperationsApi.lineup(token,team.id,requestedMatch.id,{starters,substitutes,captainUserId:captainId}),()=>setFocusedMatch(null))}/>
          <Button label={t("common.cancel")} variant="ghost" onPress={()=>setFocusedMatch(null)}/>
          <Button label={tr("goToRoster")} variant="secondary" onPress={()=>onSelectTab("competitions")}/>
        </Card>:null}
        <Card><AppText variant="bodyLarge" weight="bold">{tr("officialMatches")}</AppText>
          <Options current={matchFilter} set={setMatchFilter}
            options={["UPCOMING","TODAY","COMPLETED","CANCELLED","ALL"].map(id=>({id,label:tr("filter."+id)}))}/>
          {!sortedMatches.length?<AppText muted>{tr("noMatches")}</AppText>:null}
          {sortedMatches.map(match=>{
            const home=match.homeTeamId===team.id;
            const score=match.homeScore===null||match.awayScore===null?null:`${match.homeScore} : ${match.awayScore}`;
            return <View key={match.id} style={styles.item}>
              <AppText weight="bold">{team.name} · {match.opponentName??tr("unknownOpponent")}</AppText>
              <AppText variant="caption" muted>{match.competitionName} · {match.stage} · {tr("round")} {match.round}</AppText>
              <AppText variant="caption" muted>{date(match.startsAt)} · {match.status.replaceAll("_"," ")}</AppText>
              {score?<AppText weight="semibold" style={{color:colors.primary}}>{home?score:`${match.awayScore} : ${match.homeScore}`}</AppText>:null}
              <View style={styles.controls}>
                <Button label={tr("details")} variant="secondary"
                  onPress={()=>router.push({pathname:"/competitions/[competitionId]/matches/[matchId]",
                    params:{competitionId:match.competitionId,matchId:match.id}})}/>
                {upcoming(match)?<Button label={tr("lineup")} variant="secondary" onPress={()=>openLineup(match)}/>:null}
              </View>
            </View>;
          })}
        </Card>

      </>:null}

      {tab==="schedule"?<>
        <Card><AppText variant="bodyLarge" weight="bold">{tr("scheduleTitle")}</AppText>
          <Options current={view} set={v=>setView(v as typeof view)}
            options={["DAY","WEEK","MONTH"].map(id=>({id,label:tr("calendar."+id)}))}/>
          <View style={[styles.flexRow,{justifyContent:"space-between",flexDirection:isRTL?"row-reverse":"row"}]}>
            <Button label="‹" variant="secondary" onPress={()=>moveCursor(-1)}/>
            <AppText weight="semibold">{date(cursor.toISOString())}</AppText>
            <Button label="›" variant="secondary" onPress={()=>moveCursor(1)}/>
          </View>
          <Button label={tr("today")} variant="ghost" onPress={()=>setCursor(new Date())}/>
          {scheduledMatches.map(m=><View key={m.id} style={styles.item}>
            <AppText weight="semibold">{tr("officialMatch")}: {m.opponentName??tr("unknownOpponent")}</AppText>
            <AppText variant="caption" muted>{m.competitionName} · {date(m.startsAt)}</AppText>
            <CompetitionLink id={m.competitionId} label={tr("details")} tab="MATCHES"/>
          </View>)}
          {schedule.map(activity=>{
            const yes=activity.rsvps.filter(x=>x.availability==="AVAILABLE").length;
            const no=activity.rsvps.filter(x=>x.availability==="UNAVAILABLE").length;
            const unsure=activity.rsvps.filter(x=>x.availability==="UNSURE").length;
            return <View key={activity.id} style={styles.item}>
              <AppText weight="bold">{activity.title} · {tr("kind."+activity.kind)}</AppText>
              <AppText variant="caption" muted>{date(activity.startsAt)} – {date(activity.endsAt)}</AppText>
              {activity.location?<AppText variant="caption" muted>{activity.location}</AppText>:null}
              {activity.notes?<AppText variant="caption">{activity.notes}</AppText>:null}
              <AppText variant="caption" muted>{tr("rsvp.AVAILABLE")}: {yes} · {tr("rsvp.UNAVAILABLE")}: {no} · {tr("rsvp.UNSURE")}: {unsure}</AppText>
              <View style={styles.controls}>
                <Button label={tr("respond")} variant="secondary" onPress={()=>router.push({pathname:"/teams/[teamId]/activities",params:{teamId:team.id}})}/>
                {canWrite?<><Button label={tr("edit")} variant="secondary" onPress={()=>startActivity(activity)}/>
                  <Button label={tr("delete")} variant="ghost" loading={busy}
                    onPress={()=>void execute(()=>teamOperationsApi.deleteActivity(token,team.id,activity.id))}/></>:null}
              </View>
            </View>;
          })}
          {schedule.length===0&&scheduledMatches.length===0?<AppText muted>{tr("calendarEmpty")}</AppText>:null}
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{tr("manageActivities")}</AppText>
          <View style={styles.controls}>
            <Button label={tr("newActivity")} disabled={!canWrite} onPress={()=>startActivity()}/>
            <Button label={tr("bookVenue")} variant="secondary" onPress={()=>router.push("/venues")}/>
          </View>
          {showActivity?<View style={{gap:spacing.md}}>
            <Options current={activity.kind} set={v=>setActivityValue("kind",v as TeamActivityInput["kind"])}
              options={["TRAINING","MEETING","FRIENDLY","OTHER"].map(id=>({id,label:tr("kind."+id)}))}/>
            <TextField label={tr("activityTitle")} value={activity.title} onChangeText={v=>setActivityValue("title",v)}/>
            <TextField label={tr("activityNotes")} value={activity.notes??""} multiline onChangeText={v=>setActivityValue("notes",v||null)}/>
            <TextField label={tr("activityLocation")} value={activity.location??""} onChangeText={v=>setActivityValue("location",v||null)}/>
            <DateTimePickerField label={tr("start")} value={activity.startsAt} onChange={v=>setActivityValue("startsAt",v)} minimumDate={new Date()}/>
            <DateTimePickerField label={tr("end")} value={activity.endsAt} onChange={v=>setActivityValue("endsAt",v)}
              minimumDate={new Date(activity.startsAt||Date.now())}/>
            <Button label={t("common.save")} disabled={!canWrite||busy||activity.title.trim().length<2||
              !activity.startsAt||!activity.endsAt||Date.parse(activity.endsAt)<=Date.parse(activity.startsAt)} loading={busy}
              onPress={()=>void execute(async()=>{
                if(editingActivity)await teamOperationsApi.updateActivity(token,team.id,editingActivity,activity);
                else await teamOperationsApi.createActivity(token,team.id,activity);
              },()=>{setShowActivity(false);setEditingActivity(null);setActivity(emptyActivity);})}/>
            <Button label={t("common.cancel")} variant="ghost" onPress={()=>setShowActivity(false)}/>
          </View>:null}
          <AppText variant="caption" muted>{tr("scheduleNote")}</AppText>
        </Card>
      </>:null}
    </>:null}
  </View>;
}
const styles=StyleSheet.create({
  compSection:{gap:spacing.md},
  compTabs:{gap:spacing.sm,paddingHorizontal:spacing.xs,paddingVertical:spacing.xs},
  compTab:{minHeight:49,flexDirection:"row",alignItems:"center",gap:spacing.xs,
    paddingHorizontal:spacing.md,paddingVertical:spacing.xs,borderWidth:1,
    borderColor:colors.border,borderRadius:radius.md,backgroundColor:colors.surface},
  compTabSelected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  compCount:{minWidth:24,alignItems:"center",paddingHorizontal:spacing.xs,
    paddingVertical:spacing.xs,borderRadius:radius.pill,backgroundColor:colors.primarySoft},
  compCard:{gap:spacing.md},
  compSummary:{gap:spacing.sm},
  compSummaryCell:{flex:1,minWidth:0,alignItems:"center",gap:spacing.xs,
    padding:spacing.sm,borderWidth:1,borderColor:colors.border,
    backgroundColor:colors.surfaceMuted,borderRadius:radius.md},
  compItem:{gap:spacing.sm,paddingVertical:spacing.md,
    borderTopWidth:1,borderColor:colors.border},
  compEmpty:{gap:spacing.sm,alignItems:"center",paddingVertical:spacing.lg},
  compDanger:{gap:spacing.sm,padding:spacing.md,borderRadius:radius.md,
    borderWidth:1,borderColor:colors.danger},
  item:{borderTopWidth:1,borderColor:colors.border,paddingVertical:spacing.md,gap:spacing.sm},
  flexRow:{flexDirection:"row",alignItems:"center",gap:spacing.sm,flexWrap:"wrap"},
  controls:{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:spacing.sm},
  chip:{paddingHorizontal:spacing.md,paddingVertical:spacing.sm,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.pill,backgroundColor:colors.surface,minHeight:40,justifyContent:"center"},
  chipActive:{backgroundColor:colors.primarySoft,borderColor:colors.primary},
  status:{borderRadius:radius.pill,backgroundColor:colors.primarySoft,paddingHorizontal:spacing.sm,paddingVertical:spacing.xs},
  rowCell:{flexDirection:"row",alignItems:"center",gap:spacing.md,padding:spacing.sm,minHeight:46},
});
