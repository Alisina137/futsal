import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, spacing, radius } from "@leaguekick/design-tokens";
import type { CompetitionListItemDto, PublicVenueDto, TeamDto } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  ApiRequestError, competitionApi, teamOperationsApi, venueApi,
  type TeamActivityInput,type TeamOpsActivity,type TeamOpsCompetition,type TeamOpsMatch,
  type TeamOperations,type TeamAvailability,
} from "../../lib/api";
import { formatCompetitionDateTime } from "../../lib/date-time";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DateTimePickerField } from "../ui/DateTimePickerField";
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

export function TeamCompetitionOps({tab,team,token,canWrite,onSelectTab}:{tab:Tab;team:TeamDto;token:string;canWrite:boolean;onSelectTab:(tab:Tab)=>void}){
  const {t,language,isRTL}=useLocale();
  const [data,setData]=useState<TeamOperations|null>(null);
  const [available,setAvailable]=useState<CompetitionListItemDto[]>([]);
  const [venues,setVenues]=useState<PublicVenueDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [note,setNote]=useState<string|null>(null);
  const [reload,setReload]=useState(0);
  const [filter,setFilter]=useState("ALL");
  const [search,setSearch]=useState("");
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

  useEffect(()=>{
    if(tab!=="competitions")return;
    let active=true;
    void Promise.all([competitionApi.list(),venueApi.list()])
      .then(([competitions,results])=>{if(active){setAvailable(competitions.competitions);setVenues(results.venues);}})
      .catch(()=>{if(active)setError(t("tm2.discoveryFailed"));});
    return()=>{active=false;};
  },[tab,t]);

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
  const venueById=useMemo(()=>new Map(venues.map(v=>[v.id,v])),[venues]);
  const provinces=[...new Set(venues.map(v=>v.province).filter(Boolean))].sort();
  const discovery=available.filter(c=>c.published&&c.status==="REGISTRATION_OPEN"&&
    !registrations.some(r=>r.id===c.id)&&(!search||[c.name,c.venueName,c.format].some(v=>v.toLowerCase().includes(search.toLowerCase())))&&
    (province==="ALL"||venueById.get(c.venueId)?.province===province));
  const registrationsShown=registrations.filter(c=>filter==="ALL"||
    filter==="INVITED"&&c.registrationStatus==="INVITED"||
    filter==="PENDING"&&["APPLIED","PENDING"].includes(c.registrationStatus)||
    filter==="UPCOMING"&&c.registrationStatus==="ACCEPTED"&&["REGISTRATION_OPEN","REGISTRATION_CLOSED","SCHEDULED"].includes(c.status)||
    filter==="IN_PROGRESS"&&c.status==="IN_PROGRESS"||
    filter==="COMPLETED"&&["COMPLETED","ARCHIVED"].includes(c.status));
  const visibleMatches=matches.filter(m=>matchFilter==="ALL"||
    matchFilter==="UPCOMING"&&upcoming(m)||
    matchFilter==="TODAY"&&!!m.startsAt&&relativeKabulDay(m.startsAt)===today||
    matchFilter==="COMPLETED"&&done(m.status)||
    matchFilter==="CANCELLED"&&m.status==="CANCELLED");
  const sortedMatches=[...visibleMatches].sort((a,b)=>(a.startsAt??"9999").localeCompare(b.startsAt??"9999"));
  function openRoster(c:TeamOpsCompetition){setFocusedCompetition(c.id);setRosterIds(c.rosterUserIds);}
  function openLineup(m:TeamOpsMatch){setFocusedMatch(m.id);setStarters(m.lineup?.starters??[]);
    setSubstitutes(m.lineup?.substitutes??[]);setCaptainId(m.lineup?.captainUserId??null);}
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
        <Card>
          <AppText variant="bodyLarge" weight="bold">{tr("joinedTitle")}</AppText>
          <Options current={filter} set={setFilter}
            options={["ALL","INVITED","PENDING","UPCOMING","IN_PROGRESS","COMPLETED"].map(id=>({id,label:tr("filter."+id)}))}/>
          {!registrationsShown.length?<AppText muted>{tr("noRegistrations")}</AppText>:null}
          {registrationsShown.map(c=><View key={c.id} style={styles.item}>
            <AppText weight="bold">{c.name}</AppText>
            <AppText variant="caption" muted>{c.venueName} · {date(c.startsAt)}</AppText>
            <View style={styles.flexRow}><SmallStatus status={c.status}/><SmallStatus status={c.registrationStatus}/></View>
            <View style={styles.controls}>
              <CompetitionLink id={c.id} label={tr("details")}/>
              {c.registrationStatus==="INVITED"?<>
                <Button label={tr("accept")} disabled={!canWrite||busy} loading={busy}
                  onPress={()=>void execute(()=>competitionApi.respondInvitation(token,c.id,team.id,{status:"ACCEPTED"}))}/>
                <Button label={tr("decline")} variant="secondary" disabled={!canWrite||busy}
                  onPress={()=>void execute(()=>competitionApi.respondInvitation(token,c.id,team.id,{status:"REJECTED"}))}/>
              </>:null}
              {c.registrationStatus==="ACCEPTED"?<Button label={tr("competitionRoster")} variant="secondary"
                onPress={()=>openRoster(c)}/>:null}
            </View>
          </View>)}
        </Card>
        {requestedCompetition?<Card><AppText variant="bodyLarge" weight="bold">{tr("competitionRoster")}</AppText>
          <AppText weight="semibold">{requestedCompetition.name}</AppText>
          <AppText variant="caption" muted>{tr("rosterHint")}</AppText>
          <AppText variant="caption" muted>{tr("deadline")}: {date(requestedCompetition.registrationClosesAt??requestedCompetition.startsAt)}</AppText>
          {team.members.map(player=><Pressable key={player.userId} style={styles.rowCell}
            disabled={!canWrite||requestedCompetition.rosterLocked}
            accessibilityRole="checkbox" accessibilityState={{checked:rosterIds.includes(player.userId)}}
            onPress={()=>setRosterIds(prev=>prev.includes(player.userId)?prev.filter(id=>id!==player.userId):prev.length>=40?prev:[...prev,player.userId])}>
            <Ionicons name={rosterIds.includes(player.userId)?"checkbox":"square-outline"} size={22} color={colors.primary}/>
            <AppText style={{flex:1}}>{player.publicDisplayName} {player.shirtNumber?`#${player.shirtNumber}`:""}</AppText>
          </Pressable>)}
          <AppText muted variant="caption">{tr("selected")}: {rosterIds.length}</AppText>
          <Button label={t("common.save")} disabled={!canWrite||busy||requestedCompetition.rosterLocked} loading={busy}
            onPress={()=>void execute(()=>teamOperationsApi.roster(token,team.id,requestedCompetition.id,rosterIds),()=>setFocusedCompetition(null))}/>
          <Button label={t("common.cancel")} variant="ghost" onPress={()=>setFocusedCompetition(null)}/>
          {requestedCompetition.rosterLocked?<AppText muted>{tr("rosterLocked")}</AppText>:null}
        </Card>:null}
        <Card><AppText variant="bodyLarge" weight="bold">{tr("findTitle")}</AppText>
          <TextField label={tr("search")} value={search} onChangeText={setSearch}/>
          <AppText weight="semibold">{tr("province")}</AppText>
          <Options current={province} set={setProvince}
            options={[{id:"ALL",label:tr("filter.ALL")},...provinces.map(x=>({id:x,label:x}))]}/>
          {!discovery.length?<AppText muted>{tr("noAvailable")}</AppText>:null}
          {discovery.slice(0,30).map(c=><View key={c.id} style={styles.item}>
            <AppText weight="semibold">{c.name}</AppText>
            <AppText variant="caption" muted>{c.venueName} · {c.format} · {date(c.startsAt)}</AppText>
            <View style={styles.controls}>
              <CompetitionLink id={c.id} label={tr("details")}/>
              <Button label={tr("register")} disabled={!canWrite||busy} loading={busy}
                onPress={()=>void execute(()=>competitionApi.register(token,c.id,team.id))}/>
            </View>
          </View>)}
          <Button label={tr("exploreAll")} variant="ghost" onPress={()=>router.push("/competitions")}/>
        </Card>
      </>:null}

      {tab==="matches"?<>
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
  item:{borderTopWidth:1,borderColor:colors.border,paddingVertical:spacing.md,gap:spacing.sm},
  flexRow:{flexDirection:"row",alignItems:"center",gap:spacing.sm,flexWrap:"wrap"},
  controls:{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:spacing.sm},
  chip:{paddingHorizontal:spacing.md,paddingVertical:spacing.sm,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.pill,backgroundColor:colors.surface,minHeight:40,justifyContent:"center"},
  chipActive:{backgroundColor:colors.primarySoft,borderColor:colors.primary},
  status:{borderRadius:radius.pill,backgroundColor:colors.primarySoft,paddingHorizontal:spacing.sm,paddingVertical:spacing.xs},
  rowCell:{flexDirection:"row",alignItems:"center",gap:spacing.md,padding:spacing.sm,minHeight:46},
});
