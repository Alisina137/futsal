import {TimeOfDayPickerField} from "../ui/TimeOfDayPickerField";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,spacing,radius} from "@leaguekick/design-tokens";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useEffect,useRef,useState} from "react";
import {Linking,Pressable,ScrollView,StyleSheet,View,type LayoutChangeEvent} from "react-native";
import {ApiRequestError,refereeApi,type RefereeMatch,type RefereeOverview,type RefereeProfile} from "../../lib/api";
import {readRefereeOffline} from "../../lib/referee-offline";
import {refereeAttentionItems,type RefereeAttentionItem} from "../../lib/referee-overview";
import {formatRefereeScheduleParts,formatRefereeCalendarPeriod} from "../../lib/date-time";
import {refereeKabulDay,refereeCalendarIncludes,refereeCalendarMove,
  refereeCalendarWeekDays,refereeAvailabilityPreview} from "../../lib/referee-calendar";
import {refereeAssignmentTimeConflict,refereeAssignmentSection} from "../../lib/referee-assignments";
import {useAuth} from "../../providers/AuthProvider";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";
import {Screen} from "../ui/Screen";
import {TextField} from "../ui/TextField";
import {RefereeMatchCenter} from "./RefereeMatchCenter";
import {RefereeCareerPanel} from "./RefereeCareerPanel";
import {RefereeAssignmentsPanel} from "./RefereeAssignmentsPanel";
import {refereeWorkspaceInitialTab,refereeCenterSectionForMatch} from "../../lib/referee-match-center";

type Main="overview"|"assignments"|"center"|"stats"|"settings";
const tabs:{id:Main;icon:keyof typeof Ionicons.glyphMap}[]=[
  {id:"overview",icon:"grid-outline"},
  {id:"assignments",icon:"clipboard-outline"},
  {id:"center",icon:"football-outline"},
  {id:"stats",icon:"stats-chart-outline"},
  {id:"settings",icon:"settings-outline"},
];
const subTabs:Record<Exclude<Main,"overview">,string[]>={
  assignments:["pending","confirmed","calendar","history"],
  center:["upcoming","live","reports"],
  stats:["overview","history","performance"],
  settings:["profile","availability","venues","notifications"],
};
const days=["sun","mon","tue","wed","thu","fri","sat"] as const;
function RefStat({value,label}:{value:number;label:string}){
  return <View style={styles.stat} accessibilityLabel={label+": "+value}>
    <AppText variant="title" weight="bold" style={{color:colors.primary,textAlign:"center"}}>{value}</AppText>
    <AppText variant="body" weight="medium" style={styles.statLabel}>{label}</AppText>
  </View>;
}
function StatusBadge({status}:{status:string}){
  const {t}=useLocale();
  return <View style={[styles.badge,{backgroundColor:status==="ACCEPTED"?"#DCFCE7":
    status==="PENDING"?"#FEF3C7":"#E9EDF4"}]}>
    <AppText variant="caption" weight="bold" style={{color:colors.text}}>
      {t(("rf1.status."+status) as never)}</AppText>
  </View>;
}
export function RefereeDashboard(){
  const {session}=useAuth(),{t,isRTL,language}=useLocale();
  const token=session?.accessToken,userId=session?.user.id;
  const tr=(key:string)=>t(("rf1."+key) as never);
  const [main,setMain]=useState<Main>("overview");
  const [sub,setSub]=useState<Record<string,string>>({assignments:"pending",center:"upcoming",stats:"overview",settings:"profile"});
  const [storedData,setData]=useState<RefereeOverview|null>(null);
  const data=storedData?.person.id===userId?storedData:null;
  const [draft,setDraft]=useState<RefereeProfile|null>(null);
  const [busy,setBusy]=useState<string|null>(null),[loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null);
  const [activeCenterMatch,setActiveCenterMatch]=useState<RefereeMatch|null>(null);
  const [centerUnsafe,setCenterUnsafe]=useState(false);
  const [centerExitTarget,setCenterExitTarget]=useState<Main|null>(null);
  const [exceptionDate,setExceptionDate]=useState("");
  const [calendarView,setCalendarView]=useState<"day"|"week"|"month">("week");
  const [calendarFilter,setCalendarFilter]=useState<"ALL"|"PENDING"|"CONFIRMED"|"HISTORY">("ALL");
  const [calendarLimit,setCalendarLimit]=useState(20);
  const [calendarAnchor,setCalendarAnchor]=useState(new Date());
  const [refresh,setRefresh]=useState(0);
  const [offlineCounts,setOfflineCounts]=useState<Record<string,number>>({});
  const [offlineScanError,setOfflineScanError]=useState(false);
  const [offlineChecking,setOfflineChecking]=useState(false);
  const [attentionLimit,setAttentionLimit]=useState(5);
  const previousScope=useRef<string|null>(null);
  const activeActor=useRef(userId);
  activeActor.current=userId;
  useEffect(()=>{
    setMain("overview");
    setSub({assignments:"pending",center:"upcoming",stats:"overview",settings:"profile"});
    setActiveCenterMatch(null);setCenterUnsafe(false);setCenterExitTarget(null);
    setError(null);setMessage(null);setBusy(null);
    setAttentionLimit(5);
  },[userId]);
  const navRef=useRef<ScrollView|null>(null),navViewport=useRef(0),navWidth=useRef(0);
  const cells=useRef<Partial<Record<Main,{x:number;width:number}>>>({});
  const focusTab=useCallback((id:Main,animated=false)=>{
    const c=cells.current[id];if(!c||!navViewport.current)return;
    navRef.current?.scrollTo({x:Math.max(0,Math.min(Math.max(0,navWidth.current-navViewport.current),
      c.x+c.width/2-navViewport.current/2)),animated});
  },[]);
  useEffect(()=>{const h=requestAnimationFrame(()=>focusTab(main));return()=>cancelAnimationFrame(h);},[main,focusTab]);
  useFocusEffect(useCallback(()=>{
    let active=true;
    if(!token||!userId){setData(null);setLoading(false);return()=>{active=false;};}
    if(previousScope.current!==userId){
      previousScope.current=userId;setData(null);setDraft(null);
    }
    setLoading(true);
    void (async()=>{
      let cached=false;
      try{
        const json=await AsyncStorage.getItem("futsal.referee.overview.v1."+userId);
        if(json){
          const value=JSON.parse(json) as RefereeOverview;
          if(value.person?.id===userId){
            cached=true;
            if(active){setData(value);setDraft(value.profile);setLoading(false);}
          }
        }
      }catch{/* Cache is optional; a corrupt entry never grants permissions. */}
      try{
        const value=await refereeApi.overview(token);
        if(active){setData(value);setDraft(value.profile);setError(null);}
        await AsyncStorage.setItem("futsal.referee.overview.v1."+userId,JSON.stringify(value));
      }catch(e){if(active){
        setError(e instanceof ApiRequestError?e.message:tr("loadError"));
        if(!cached)setData(null);
      }}finally{if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[token,userId,refresh,t]));
  // Count account-scoped offline events without deleting or attempting to sync them.
  // Invalid durable records remain intact and surface an explicit warning.
  useEffect(()=>{
    let mounted=true;
    setOfflineCounts({});setOfflineScanError(false);
    setOfflineChecking(Boolean(userId&&data));
    if(!userId||!data)return()=>{mounted=false;};
    void Promise.all(data.assignments.map(async match=>{
      try{
        const record=await readRefereeOffline(userId,match.id);
        return [match.id,record.pending.length] as const;
      }catch{return [match.id,-1] as const;}
    })).then(entries=>{
      if(!mounted)return;
      setOfflineCounts(Object.fromEntries(entries.filter(([,count])=>count>0)));
      setOfflineScanError(entries.some(([,count])=>count<0));
      setOfflineChecking(false);
    }).catch(()=>{
      if(mounted){setOfflineScanError(true);setOfflineChecking(false);}
    });
    return()=>{mounted=false;};
  },[userId,data?.assignments,refresh]);
  const choose=(tab:Main)=>{
    if(tab!=="center"&&activeCenterMatch&&centerUnsafe){
      setCenterExitTarget(tab);return;
    }
    if(tab!=="center"){setActiveCenterMatch(null);setCenterUnsafe(false);}
    setMain(tab);focusTab(tab,true);
  };
  async function act(key:string,fn:()=>Promise<unknown>){
    if(busy)return;
    const actor=userId;
    setBusy(key);setError(null);setMessage(null);
    try{
      await fn();
      if(activeActor.current!==actor)return;
      setMessage(tr("saved"));setRefresh(v=>v+1);
    }catch(e){
      if(activeActor.current===actor)
        setError(e instanceof ApiRequestError?e.message:tr("actionError"));
    }finally{if(activeActor.current===actor)setBusy(null);}
  }
  async function map(latitude:number|null,longitude:number|null){
    if(latitude===null||longitude===null)return;
    try{await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);}
    catch{setError(tr("mapError"));}
  }
  const assignments=data?.assignments??[];
  const attention=refereeAttentionItems(assignments,Date.now(),offlineCounts);
  const openAttention=(item:RefereeAttentionItem)=>{
    if(item.kind==="PENDING"){
      setSub(value=>({...value,assignments:"pending"}));choose("assignments");
      return;
    }
    if(!item.match.authorized){setError(tr("venueRevoked"));return;}
    setSub(value=>({...value,center:item.kind==="IMMINENT"?"upcoming":"reports"}));
    setActiveCenterMatch(item.match);choose("center");
  };
  const accepted=assignments.filter(a=>a.responseStatus==="ACCEPTED");
  const upcoming=accepted.filter(a=>a.matchStatus==="SCHEDULED"&&!a.reportStartedAt);
  const active=accepted.filter(a=>!!a.reportStartedAt&&!a.reportFinishedAt&&
    (a.matchStatus==="SCHEDULED"||a.matchStatus==="IN_PROGRESS"));
  const reports=accepted.filter(a=>!!a.reportFinishedAt||!!a.reportStatus&&
    ["SUBMITTED","CHANGES_REQUESTED","APPROVING","APPROVED"].includes(a.reportStatus));
  const future=upcoming.filter(a=>!!a.startsAt&&Date.parse(a.startsAt)>Date.now());
  const selectedSub=sub[main]??"";
  const calendarKey=refereeKabulDay(calendarAnchor)??refereeKabulDay(new Date())!;
  const calendarPeriod=formatRefereeCalendarPeriod(calendarAnchor,calendarView,language);
  const shiftCalendar=(direction:number)=>{
    setCalendarAnchor(current=>{
      const day=refereeKabulDay(current);
      if(!day)return current;
      const next=refereeCalendarMove(day,calendarView,direction,language);
      return new Date(next+"T12:00:00Z");
    });
  };
  const calendarMatches=assignments.filter(m=>
    !!m.startsAt&&refereeCalendarIncludes(m.startsAt,calendarKey,calendarView,language))
    .sort((a,b)=>(a.startsAt??"").localeCompare(b.startsAt??"")||a.id.localeCompare(b.id));
  const calendarStatus=(m:RefereeMatch)=>{
    const section=refereeAssignmentSection(m,Date.now());
    return section==="pending"?"PENDING":section==="confirmed"?"CONFIRMED":"HISTORY";
  };
  const calendarItems=calendarMatches.filter(m=>calendarFilter==="ALL"||
    calendarStatus(m)===calendarFilter);
  const calendarWeekDays=refereeCalendarWeekDays(calendarKey,language);
  useEffect(()=>{setCalendarLimit(20);},
    [calendarKey,calendarView,calendarFilter,userId]);
  const calendarDayLabel=(day:string)=>formatRefereeCalendarPeriod(
    new Date(day+"T12:00:00Z"),"day",language);
  function scheduledDateTime(value:string|null,durationMinutes?:number){
    if(!value)return <AppText variant="caption" muted>{tr("notSet")}</AppText>;
    const parts=formatRefereeScheduleParts(value,language);
    return <View style={styles.appointmentDateTime}>
      <View style={[styles.dateTimeLine,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="calendar-outline" size={18} color={colors.primary}/>
        <AppText weight="medium" style={styles.dateTimeText}>{parts.date}</AppText>
      </View>
      <View style={[styles.dateTimeLine,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="time-outline" size={18} color={colors.primary}/>
        <AppText weight="semibold" style={styles.dateTimeText}>
          {parts.time} · {tr("calendar.kabulTime")}
          {durationMinutes===undefined?"":" · "+durationMinutes+" "+tr("minutes")}
        </AppText>
      </View>
    </View>;
  }
  const changeProfile=(patch:Partial<RefereeProfile>)=>setDraft(old=>old?{...old,...patch}:old);
  const editSlot=(day:number,field:"start"|"end",value:string)=>{
    if(!draft)return;
    const current=draft.weeklyAvailability.find(x=>x.day===day);
    if(!current)return;
    changeProfile({weeklyAvailability:draft.weeklyAvailability.map(x=>x.day===day?{...x,[field]:value}:x)});
  };
  function card(m:RefereeMatch,showCalendarWarnings=false){
    const conflict=showCalendarWarnings&&m.authorized&&
      ["PENDING","ACCEPTED"].includes(m.responseStatus)?
      refereeAssignmentTimeConflict(m,assignments):null;
    const availability=showCalendarWarnings&&data?.profile&&
      m.authorized&&refereeAssignmentSection(m,Date.now())==="pending"?
      refereeAvailabilityPreview(m,data.profile):null;
    return <Card key={m.id} style={{gap:spacing.sm}}>
      <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={{flex:1}}>
          <AppText weight="bold">{m.homeTeamName}  VS  {m.awayTeamName}</AppText>
          <AppText variant="caption" muted>{m.competitionName} · {m.venueName}</AppText>
        </View>
        <StatusBadge status={m.responseStatus}/>
      </View>
      {scheduledDateTime(m.startsAt,m.durationMinutes)}
      {showCalendarWarnings&&conflict?<View style={styles.calendarWarning}>
        <Ionicons name="alert-circle-outline" size={18} color={colors.danger}/>
        <AppText style={{flex:1,color:colors.danger}}>
          {tr("calendar.conflict")} · {conflict.homeTeamName} VS {conflict.awayTeamName}
        </AppText>
      </View>:null}
      {availability==="UNAVAILABLE"?<View style={styles.calendarWarning}>
        <Ionicons name="time-outline" size={18} color={colors.warning}/>
        <AppText style={{flex:1}}>{tr("calendar.unavailable")}</AppText>
        <Button label={tr("calendar.manageAvailability")} variant="secondary"
          onPress={()=>{choose("settings");setSub(x=>({...x,settings:"availability"}));}}/>
      </View>:null}
      {showCalendarWarnings&&availability==="MISSING_SCHEDULE"?
        <AppText variant="caption" style={{color:colors.danger}}>
          {tr("calendar.missingEnd")}</AppText>:null}
      <View style={styles.actions}>
        <Button label={tr("details")} variant="secondary" onPress={()=>router.push({
          pathname:"/competitions/[competitionId]/matches/[matchId]",
          params:{competitionId:m.competitionId,matchId:m.id},
        })}/>
        {m.latitude!==null&&m.longitude!==null?<Button label={tr("location")} variant="secondary"
          onPress={()=>void map(m.latitude,m.longitude)}/>:null}
        {showCalendarWarnings&&refereeAssignmentSection(m,Date.now())==="pending"?
          <Button label={tr("calendar.reviewInvitation")} variant="secondary"
            onPress={()=>{setSub(x=>({...x,assignments:"pending"}));choose("assignments");}}/>:null}
        {m.responseStatus==="ACCEPTED"&&m.authorized&&
          (["SCHEDULED","IN_PROGRESS"].includes(m.matchStatus)||!!m.reportStatus)?
          <Button label={t("rf2.openMatch")} variant="secondary"
            onPress={()=>{
              const section=main==="center"&&["upcoming","live","reports"].includes(selectedSub)?
                selectedSub:refereeCenterSectionForMatch(m);
              setSub(x=>({...x,center:section}));
              setActiveCenterMatch(m);choose("center");
            }}/>:null}
      </View>
      {!m.authorized?<AppText variant="caption" style={{color:colors.danger}}>{tr("venueRevoked")}</AppText>:null}
    </Card>;
  }
  return <Screen showHeader refreshing={loading&&!!data}
    onRefresh={()=>setRefresh(value=>value+1)}>
    <ScrollView ref={navRef} horizontal showsHorizontalScrollIndicator={false}
      style={styles.nav} onLayout={e=>{navViewport.current=e.nativeEvent.layout.width;focusTab(main);}}
      onContentSizeChange={w=>{navWidth.current=w;focusTab(main);}}
      contentContainerStyle={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,alignItems:"center"}}>
      {tabs.map(tab=><Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{selected:main===tab.id}}
        onLayout={(e:LayoutChangeEvent)=>{cells.current[tab.id]=e.nativeEvent.layout;}}
        onPress={()=>choose(tab.id)} style={[styles.navItem,main===tab.id&&styles.navActive]}>
        <Ionicons name={tab.icon} size={20} color={main===tab.id?colors.primary:colors.textMuted}/>
        <AppText variant="caption" weight="semibold" style={main===tab.id?{color:colors.primary}:undefined}>
          {tr("nav."+tab.id)}</AppText>
      </Pressable>)}
    </ScrollView>
    {main!=="overview"&&!(main==="center"&&activeCenterMatch)?<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subNav}
      contentContainerStyle={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.xs}}>
      {subTabs[main].map(id=><Pressable key={id} accessibilityRole="tab" accessibilityState={{selected:selectedSub===id}}
        style={[styles.subItem,selectedSub===id&&styles.subActive]}
        onPress={()=>{
          if(main==="center"&&selectedSub!==id)setActiveCenterMatch(null);
          setSub(x=>({...x,[main]:id}));
        }}>
        <AppText weight="semibold" variant="caption" style={selectedSub===id?{color:colors.primary}:undefined}>
          {tr(main+"."+id)}</AppText>
      </Pressable>)}
    </ScrollView>:null}
    {centerExitTarget?<Card testID="referee-dashboard-exit-guard"
      style={{gap:spacing.sm,borderColor:colors.warning}}>
      <AppText weight="bold">{t("rf2.safeLeaveTitle")}</AppText>
      <AppText variant="caption" muted>{t("rf2.safeLeaveBody")}</AppText>
      <View style={styles.actions}>
        <Button label={t("rf2.keepEditing")} onPress={()=>setCenterExitTarget(null)}/>
        <Button label={t("rf2.leaveAnyway")} variant="secondary"
          onPress={()=>{
            const destination=centerExitTarget;
            setCenterExitTarget(null);setCenterUnsafe(false);setActiveCenterMatch(null);
            setMain(destination);focusTab(destination,true);
          }}/>
      </View>
    </Card>:null}
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={tr("retry")} variant="secondary" onPress={()=>setRefresh(v=>v+1)}/></Card>:null}
    {message?<Card style={{backgroundColor:colors.primarySoft}}><AppText>{message}</AppText></Card>:null}
    {loading?<DataLoadingState variant="dashboard" minHeight={460}/>:data?<>
      {main==="overview"?<>
        <Card testID="referee-overview-identity">
          <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <View style={{flex:1,gap:spacing.xs}}>
              <AppText variant="bodyLarge" weight="bold">{data.person.name}</AppText>
              <AppText variant="caption" muted>
                {tr("profileStatus")} · {data.venues.map(v=>v.name).join(", ")||tr("noVenues")}
              </AppText>
            </View>
            <Pressable testID="referee-overview-refresh" accessibilityRole="button"
              accessibilityLabel={tr("overview.refresh")}
              disabled={loading||busy!==null}
              accessibilityState={{disabled:loading||busy!==null}}
              onPress={()=>setRefresh(value=>value+1)} style={styles.refreshButton}>
              <Ionicons name="refresh-outline" size={22} color={colors.primary}/>
            </Pressable>
          </View>
        </Card>
        <View testID="referee-overview-kpis" style={styles.stats}>
          <RefStat value={data.stats.total} label={tr("stat.total")}/>
          <RefStat value={data.stats.upcoming} label={tr("stat.upcoming")}/>
          <RefStat value={data.stats.completed} label={tr("stat.completed")}/>
          <RefStat value={data.stats.pending} label={tr("stat.pending")}/>
        </View>
        <Card testID="referee-overview-attention" style={styles.attentionCard}>
          <View style={[styles.attentionHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Ionicons name="alert-circle-outline" size={21}
              color={attention.length||offlineScanError?colors.warning:colors.success}/>
            <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>
              {tr("overview.attentionTitle")}
            </AppText>
            {attention.length>0?<AppText weight="bold" style={{color:colors.primary}}>
              {attention.length}</AppText>:null}
          </View>
          {offlineScanError?<AppText variant="caption" style={{color:colors.danger}}>
            {tr("overview.offlineScanError")}</AppText>:null}
          {offlineChecking?<AppText variant="caption" muted>
            {tr("overview.checkingOffline")}</AppText>:null}
          {attention.length===0&&!offlineScanError&&!offlineChecking?<View style={styles.attentionEmpty}>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.success}/>
            <AppText muted style={{flex:1}}>{tr("overview.allClear")}</AppText>
          </View>:null}
          {attention.slice(0,attentionLimit).map(item=><View key={item.key} style={styles.attentionItem}>
            <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Ionicons name={item.kind==="UNSYNCED"?"cloud-offline-outline":
                item.kind==="CORRECTION"?"document-text-outline":
                item.kind==="PENDING"?"mail-unread-outline":"time-outline"}
                size={21} color={item.kind==="UNSYNCED"?colors.danger:colors.primary}/>
              <View style={{flex:1,gap:spacing.xs}}>
                <AppText weight="semibold">{tr(item.kind==="UNSYNCED"?"overview.unsynced":
                  item.kind==="CORRECTION"?"overview.reportCorrection":
                  item.kind==="PENDING"?"overview.invitation":"overview.kickoffSoon")}
                  {item.kind==="UNSYNCED"?" ("+item.unsyncedCount+")":""}</AppText>
                <AppText variant="caption" muted numberOfLines={2}>
                  {item.match.homeTeamName} VS {item.match.awayTeamName} · {item.match.venueName}
                </AppText>
              </View>
            </View>
            {item.kind==="IMMINENT"?scheduledDateTime(item.match.startsAt):null}
            <Button variant="secondary" label={tr("overview.review")}
              onPress={()=>openAttention(item)}/>
          </View>)}
          {attention.length>attentionLimit?<Button testID="referee-overview-show-more"
            variant="secondary" label={tr("overview.showMore")}
            onPress={()=>setAttentionLimit(value=>value+5)}/>:null}
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{tr("nextMatch")}</AppText>
          {data.nextMatch?<><AppText weight="bold">{data.nextMatch.homeTeamName} VS {data.nextMatch.awayTeamName}</AppText>
            {scheduledDateTime(data.nextMatch.startsAt)}
             <AppText variant="caption" muted>{data.nextMatch.venueName}</AppText>
            <Button label={tr("details")} variant="secondary" onPress={()=>router.push({
              pathname:"/competitions/[competitionId]/matches/[matchId]",
              params:{competitionId:data.nextMatch!.competitionId,matchId:data.nextMatch!.id},
            })}/></>:<AppText muted>{tr("noUpcoming")}</AppText>}
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{tr("quickActions")}</AppText>
          <View style={styles.actions}>
            <Button label={tr("nav.assignments")} variant="secondary" onPress={()=>choose("assignments")}/>
            <Button label={tr("nav.center")} variant="secondary" onPress={()=>choose("center")}/>
            <Button label={tr("assignments.calendar")} variant="secondary" onPress={()=>{choose("assignments");setSub(x=>({...x,assignments:"calendar"}));}}/>
          </View>
        </Card>
        
      </>:null}
      {main==="assignments"&&
        ["pending","confirmed","history"].includes(selectedSub)&&token?
        <RefereeAssignmentsPanel key={userId} assignments={assignments}
          section={selectedSub as "pending"|"confirmed"|"history"}
          token={token} profile={data.profile}
          onChanged={()=>setRefresh(value=>value+1)}
          onOpenAvailability={()=>{choose("settings");
            setSub(previous=>({...previous,settings:"availability"}));}}
          onOpenMatch={match=>{setActiveCenterMatch(match);choose("center");
            setSub(previous=>({...previous,center:"live"}));}}/>:null}
      {main==="assignments"&&selectedSub==="calendar"?<>
        <Card style={{gap:spacing.md}}>
          <AppText variant="bodyLarge" weight="bold">{tr("calendarHint")}</AppText>
          <View style={[styles.calendarModes,{flexDirection:isRTL?"row-reverse":"row"}]}>
            {(["day","week","month"] as const).map(mode=><Pressable
              key={mode} accessibilityRole="tab"
              accessibilityState={{selected:calendarView===mode}}
              style={[styles.calendarMode,calendarView===mode&&styles.calendarModeActive]}
              onPress={()=>setCalendarView(mode)}>
              <AppText weight="semibold" style={{
                color:calendarView===mode?"#FFFFFF":colors.primary,textAlign:"center",
              }}>{tr("calendar."+mode)}</AppText>
            </Pressable>)}
          </View>
          <View style={styles.calendarPeriodPanel}>
            <View style={[styles.calendarPeriodCaption,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Ionicons name="calendar-clear-outline" size={18} color={colors.primary}/>
              <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
                {tr("calendar.selectedPeriod")}
              </AppText>
            </View>
            <AppText variant="bodyLarge" weight="bold" style={styles.calendarPeriodText}>
              {calendarPeriod}
            </AppText>
          </View>
          <View style={[styles.calendarControls,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Button variant="secondary" style={styles.calendarControl}
              label={tr("calendar.prev")} onPress={()=>shiftCalendar(-1)}/>
            <Button variant="secondary" style={styles.calendarControl}
              label={tr("calendar.today")} onPress={()=>setCalendarAnchor(new Date())}/>
            <Button variant="secondary" style={styles.calendarControl}
              label={tr("calendar.next")} onPress={()=>shiftCalendar(1)}/>
          </View>
          <View style={styles.calendarCountRow}>
            {(["ALL","PENDING","CONFIRMED","HISTORY"] as const).map(option=>{
              const count=option==="ALL"?calendarMatches.length:
                calendarMatches.filter(m=>calendarStatus(m)===option).length;
              return <Pressable key={option} accessibilityRole="button"
                accessibilityState={{selected:calendarFilter===option}}
                onPress={()=>setCalendarFilter(option)}
                style={[styles.calendarFilter,
                  calendarFilter===option&&styles.calendarFilterSelected]}>
                <AppText variant="caption" weight="semibold"
                  style={calendarFilter===option?{color:colors.primary}:undefined}>
                  {tr("calendar.filter."+option)} · {count}
                </AppText>
              </Pressable>;
            })}
          </View>
        </Card>
        {calendarView==="week"?<Card style={styles.weekDaysCard}>
          <AppText weight="semibold">{tr("calendar.weekDays")}</AppText>
          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}
            style={{flexGrow:0}} contentContainerStyle={[styles.weekDayRow,
              {flexDirection:isRTL?"row-reverse":"row"}]}>
            {calendarWeekDays.map(day=>{
              const matchCount=assignments.filter(m=>m.startsAt&&
                refereeKabulDay(m.startsAt)===day).length;
              const today=day===refereeKabulDay(new Date());
              return <Pressable key={day} accessibilityRole="button"
                accessibilityLabel={calendarDayLabel(day)}
                onPress={()=>{setCalendarAnchor(new Date(day+"T12:00:00Z"));
                  setCalendarView("day");}}
                style={[styles.weekDayButton,today&&styles.weekDayToday]}>
                <AppText variant="caption" weight="semibold"
                  style={today?{color:colors.primary}:undefined}>
                  {calendarDayLabel(day)}
                </AppText>
                <AppText variant="caption" muted>
                  {tr("calendar.matches")}: {matchCount}
                </AppText>
              </Pressable>;
            })}
          </ScrollView>
        </Card>:null}
        {calendarItems.length?calendarItems.slice(0,calendarLimit).map((m,index,displayed)=>{
          const day=refereeKabulDay(m.startsAt!);
          const previous=index?refereeKabulDay(displayed[index-1]!.startsAt!):null;
          return <View key={m.id} style={{gap:spacing.sm}}>
            {day!==previous?<View style={styles.calendarDayHeading}>
              <Ionicons name="calendar-outline" color={colors.primary} size={18}/>
              <AppText weight="semibold" style={{flex:1}}>
                {formatRefereeScheduleParts(m.startsAt!,language).date}
              </AppText>
            </View>:null}
            {card(m,true)}
          </View>;
        }):<Card><AppText muted>{tr("calendar.empty")}</AppText></Card>}
        {calendarItems.length>calendarLimit?<Button variant="secondary"
          testID="referee-calendar-show-more" label={tr("calendar.showMore")}
          onPress={()=>setCalendarLimit(value=>value+20)}/>:null}
      </>:null}
      {main==="center"&&activeCenterMatch?<RefereeMatchCenter
        key={userId+":"+activeCenterMatch.id} match={activeCenterMatch}
        initialTab={refereeWorkspaceInitialTab(selectedSub as "upcoming"|"live"|"reports")}
        onRiskChange={setCenterUnsafe}
        onClose={()=>{setCenterUnsafe(false);setCenterExitTarget(null);
          setActiveCenterMatch(null);setRefresh(v=>v+1);}}/>:null}
      {main==="center"&&!activeCenterMatch&&selectedSub==="upcoming"?
        (future.length?future.map(card):<Card><AppText muted>{tr("noUpcoming")}</AppText></Card>):null}
      {main==="center"&&!activeCenterMatch&&selectedSub==="live"?
        (active.length?active.map(card):<Card><AppText muted>{t("rf2.noLiveMatches")}</AppText></Card>):null}
      {main==="center"&&!activeCenterMatch&&selectedSub==="reports"?
        (reports.length?reports.map(card):<Card><AppText muted>{t("rf2.noReports")}</AppText></Card>):null}
      {main==="stats"&&["overview","history","performance"].includes(selectedSub)&&token?
        <RefereeCareerPanel token={token} section={selectedSub as "overview"|"history"|"performance"}/>:null}
      {main==="settings"&&selectedSub==="profile"&&draft?<Card>
        <AppText variant="bodyLarge" weight="bold">{tr("settings.profile")}</AppText>
        <TextField label={tr("level")} value={draft.level??""} maxLength={60}
          onChangeText={v=>changeProfile({level:v||null})}/>
        <TextField label={tr("experience")} keyboardType="numeric" value={String(draft.experienceYears)}
          onChangeText={v=>changeProfile({experienceYears:Number(v)||0})}/>
        <TextField label={tr("biography")} multiline maxLength={500} value={draft.biography??""}
          onChangeText={v=>changeProfile({biography:v||null})}/>
        <Button label={tr("save")} loading={busy==="profile"} disabled={busy!==null}
          onPress={()=>void act("profile",()=>refereeApi.updateProfile(token!,draft))}/>
        <Button label={tr("accountProfile")} variant="secondary" onPress={()=>router.push("/settings")}/>
      </Card>:null}
      {main==="settings"&&selectedSub==="availability"&&draft?<Card>
        <AppText variant="bodyLarge" weight="bold">{tr("settings.availability")}</AppText>
        <AppText variant="caption" muted>{tr("availabilityHint")}</AppText>
        {days.map((day,index)=>{
          const slot=draft.weeklyAvailability.find(s=>s.day===index);
          return <View key={day} style={styles.day}>
            <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <AppText weight="bold" style={{flex:1}}>{tr("day."+day)}</AppText>
              <Button label={slot?tr("disable"):tr("enable")} variant="secondary"
                onPress={()=>{
                  changeProfile({weeklyAvailability:slot?
                    draft.weeklyAvailability.filter(s=>s.day!==index):
                    [...draft.weeklyAvailability,{day:index,start:"09:00",end:"21:00"}]});
                }}/>
            </View>
            {slot?<View style={styles.actions}>
              <View style={{flex:1}}><TimeOfDayPickerField label={tr("start")} value={slot.start}
                onChange={v=>editSlot(index,"start",v)}/></View>
              <View style={{flex:1}}><TimeOfDayPickerField label={tr("end")} value={slot.end}
                onChange={v=>editSlot(index,"end",v)}/></View>
            </View>:null}
          </View>;
        })}
        <AppText weight="semibold">{tr("exceptions")}</AppText>
        <TextField label={tr("exceptionDate")} placeholder="YYYY-MM-DD" value={exceptionDate}
          onChangeText={setExceptionDate} forceLtr/>
        <View style={styles.actions}>
          <Button label={tr("markUnavailable")} variant="secondary"
            disabled={!/^\d{4}-\d{2}-\d{2}$/.test(exceptionDate)}
            onPress={()=>{
              changeProfile({exceptions:[...draft.exceptions.filter(e=>e.date!==exceptionDate),
                {date:exceptionDate,available:false}]});setExceptionDate("");
            }}/>
          <Button label={tr("markAvailable")} variant="secondary"
            disabled={!/^\d{4}-\d{2}-\d{2}$/.test(exceptionDate)}
            onPress={()=>{
              changeProfile({exceptions:[...draft.exceptions.filter(e=>e.date!==exceptionDate),
                {date:exceptionDate,available:true}]});setExceptionDate("");
            }}/>
        </View>
        {draft.exceptions.map(ex=><View key={ex.date} style={styles.actions}>
          <AppText style={{flex:1}}>{ex.date} · {ex.available?tr("available"):tr("unavailable")}</AppText>
          <Button label={tr("remove")} variant="ghost" onPress={()=>
            changeProfile({exceptions:draft.exceptions.filter(e=>e.date!==ex.date)})}/>
        </View>)}
        <Button label={tr("save")} loading={busy==="availability"} disabled={busy!==null}
          onPress={()=>void act("availability",()=>refereeApi.updateProfile(token!,draft))}/>
      </Card>:null}
      {main==="settings"&&selectedSub==="venues"?<>
        {data.venues.length?data.venues.map(v=><Card key={v.id}>
          <AppText weight="bold">{v.name}</AppText>
          <AppText muted>{v.address} · {v.province}, {v.city}</AppText>
          {v.latitude!==null&&v.longitude!==null?<Button label={tr("location")} variant="secondary"
            onPress={()=>void map(v.latitude,v.longitude)}/>:null}
        </Card>):<Card><AppText muted>{tr("noVenues")}</AppText></Card>}
      </>:null}
      {main==="settings"&&selectedSub==="notifications"?<Card>
        <AppText variant="bodyLarge" weight="bold">{tr("settings.notifications")}</AppText>
        <AppText muted>{tr("notificationsHint")}</AppText>
        <Button label={tr("accountProfile")} variant="secondary" onPress={()=>router.push("/settings")}/>
        <Button label={tr("openNotifications")} onPress={()=>router.push("/notifications")}/>
      </Card>:null}
    </>:null}
  </Screen>;
}
const styles=StyleSheet.create({
  calendarDayHeading:{flexDirection:"row",alignItems:"center",gap:spacing.sm,
    borderBottomWidth:1,borderColor:colors.border,paddingVertical:spacing.sm},
  calendarWarning:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",
    gap:spacing.sm,padding:spacing.sm,borderWidth:1,borderColor:colors.border,
    backgroundColor:colors.surfaceMuted,borderRadius:radius.md},
  calendarCountRow:{flexDirection:"row",flexWrap:"wrap",gap:spacing.xs},
  calendarFilter:{paddingHorizontal:spacing.sm,paddingVertical:spacing.sm,minHeight:40,
    justifyContent:"center",borderWidth:1,borderColor:colors.border,
    backgroundColor:colors.surface,borderRadius:radius.md},
  calendarFilterSelected:{backgroundColor:colors.primarySoft,borderColor:colors.primary},
  weekDaysCard:{gap:spacing.md},
  weekDayRow:{gap:spacing.sm,alignItems:"stretch"},
  weekDayButton:{minWidth:112,maxWidth:142,justifyContent:"center",
    padding:spacing.sm,borderRadius:radius.md,borderWidth:1,
    borderColor:colors.border,gap:spacing.xs,backgroundColor:colors.surfaceMuted},
  weekDayToday:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  attentionCard:{gap:spacing.md},
  attentionHeading:{alignItems:"center",gap:spacing.sm},
  attentionEmpty:{flexDirection:"row",alignItems:"center",gap:spacing.sm,
    padding:spacing.sm,backgroundColor:colors.surfaceMuted,borderRadius:radius.md},
  attentionItem:{gap:spacing.sm,borderTopWidth:1,borderTopColor:colors.border,
    paddingTop:spacing.md},
  refreshButton:{minHeight:44,minWidth:44,alignItems:"center",justifyContent:"center",
    backgroundColor:colors.primarySoft,borderRadius:radius.md},
  nav:{borderTopWidth:1,borderBottomWidth:1,borderColor:colors.border,flexGrow:0},
  navItem:{alignItems:"center",gap:4,minWidth:90,paddingVertical:spacing.sm,
    paddingHorizontal:spacing.sm,borderBottomWidth:3,borderBottomColor:"transparent"},
  navActive:{backgroundColor:colors.primarySoft,borderBottomColor:colors.primary,borderRadius:radius.sm},
  subNav:{flexGrow:0,borderBottomWidth:1,borderColor:colors.border},
  subItem:{paddingHorizontal:spacing.md,paddingVertical:spacing.sm,
    borderBottomWidth:2,borderBottomColor:"transparent"},
  subActive:{backgroundColor:colors.primarySoft,borderBottomColor:colors.primary},
  stats:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  stat:{flexGrow:1,flexBasis:"46%",minWidth:0,minHeight:112,padding:spacing.md,
    backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,
    alignItems:"center",justifyContent:"center",gap:spacing.sm},
  statLabel:{textAlign:"center",lineHeight:23,flexShrink:1},
  appointmentDateTime:{gap:spacing.sm,padding:spacing.md,
    backgroundColor:colors.surfaceMuted,borderRadius:radius.md},
  dateTimeLine:{alignItems:"center",gap:spacing.sm},
  dateTimeText:{flex:1,flexShrink:1},
  calendarModes:{gap:spacing.sm},
  calendarMode:{flex:1,minWidth:0,minHeight:48,alignItems:"center",justifyContent:"center",
    borderRadius:radius.md,borderWidth:1,borderColor:colors.border,
    backgroundColor:colors.primarySoft,paddingHorizontal:spacing.xs,paddingVertical:spacing.sm},
  calendarModeActive:{backgroundColor:colors.primary,borderColor:colors.primary},
  calendarPeriodPanel:{gap:spacing.sm,alignItems:"center",
    backgroundColor:colors.primarySoft,borderRadius:radius.md,
    borderWidth:1,borderColor:colors.border,paddingHorizontal:spacing.md,paddingVertical:spacing.lg},
  calendarPeriodCaption:{alignItems:"center",justifyContent:"center",gap:spacing.sm},
  calendarPeriodText:{textAlign:"center",lineHeight:28,alignSelf:"stretch"},
  calendarControls:{gap:spacing.sm},
  calendarControl:{flex:1,minWidth:0,paddingHorizontal:spacing.xs},
  row:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  badge:{paddingVertical:5,paddingHorizontal:9,borderRadius:radius.pill},
  actions:{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:spacing.sm},
  day:{gap:spacing.sm,paddingVertical:spacing.sm,borderBottomWidth:1,borderColor:colors.border},
});
