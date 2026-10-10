import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,spacing,radius} from "@leaguekick/design-tokens";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useEffect,useRef,useState} from "react";
import {Linking,Pressable,ScrollView,StyleSheet,View,type LayoutChangeEvent} from "react-native";
import {ApiRequestError,refereeApi,type RefereeMatch,type RefereeOverview,type RefereeProfile} from "../../lib/api";
import {formatCompetitionDateTime} from "../../lib/date-time";
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

type Main="overview"|"assignments"|"center"|"stats"|"settings";
const tabs:{id:Main;icon:keyof typeof Ionicons.glyphMap}[]=[
  {id:"overview",icon:"grid-outline"},
  {id:"assignments",icon:"clipboard-outline"},
  {id:"center",icon:"football-outline"},
  {id:"stats",icon:"stats-chart-outline"},
  {id:"settings",icon:"settings-outline"},
];
const subTabs:Record<Exclude<Main,"overview">,string[]>={
  assignments:["pending","confirmed","calendar"],
  center:["upcoming","live","reports"],
  stats:["overview","history","performance"],
  settings:["profile","availability","venues","notifications"],
};
const days=["sun","mon","tue","wed","thu","fri","sat"] as const;
function RefStat({value,label}:{value:number;label:string}){
  return <View style={styles.stat}><AppText variant="title" weight="bold" style={{color:colors.primary}}>{value}</AppText>
    <AppText variant="caption" muted style={{textAlign:"center"}}>{label}</AppText></View>;
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
  const token=session?.accessToken;
  const tr=(key:string)=>t(("rf1."+key) as never);
  const [main,setMain]=useState<Main>("overview");
  const [sub,setSub]=useState<Record<string,string>>({assignments:"pending",center:"upcoming",stats:"overview",settings:"profile"});
  const [data,setData]=useState<RefereeOverview|null>(null);
  const [draft,setDraft]=useState<RefereeProfile|null>(null);
  const [busy,setBusy]=useState<string|null>(null),[loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null);
  const [reason,setReason]=useState<Record<string,string>>({});
  const [activeCenterMatch,setActiveCenterMatch]=useState<RefereeMatch|null>(null);
  const [exceptionDate,setExceptionDate]=useState("");
  const [calendarView,setCalendarView]=useState<"day"|"week"|"month">("week");
  const [calendarAnchor,setCalendarAnchor]=useState(new Date());
  const [refresh,setRefresh]=useState(0);
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
    if(!token){setLoading(false);return()=>{active=false;};}
    setLoading(true);
    void refereeApi.overview(token).then(value=>{
      if(active){setData(value);setDraft(value.profile);setError(null);}
    }).catch(e=>{if(active){setError(e instanceof ApiRequestError?e.message:tr("loadError"));setData(null);}})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[token,refresh,t]));
  const choose=(tab:Main)=>{setMain(tab);focusTab(tab,true);};
  async function act(key:string,fn:()=>Promise<unknown>){
    if(busy)return;
    setBusy(key);setError(null);setMessage(null);
    try{await fn();setMessage(tr("saved"));setRefresh(v=>v+1);}
    catch(e){setError(e instanceof ApiRequestError?e.message:tr("actionError"));}
    finally{setBusy(null);}
  }
  const fmt=(date:string|null)=>date?formatCompetitionDateTime(date,language):tr("notSet");
  async function map(latitude:number|null,longitude:number|null){
    if(latitude===null||longitude===null)return;
    try{await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);}
    catch{setError(tr("mapError"));}
  }
  const assignments=data?.assignments??[];
  const pending=assignments.filter(a=>a.responseStatus==="PENDING"&&a.authorized&&a.matchStatus==="SCHEDULED"&&
    !!a.startsAt&&Date.parse(a.startsAt)>Date.now());
  const accepted=assignments.filter(a=>a.responseStatus==="ACCEPTED");
  const upcoming=accepted.filter(a=>a.matchStatus==="SCHEDULED"&&!a.reportStartedAt);
  const active=accepted.filter(a=>!!a.reportStartedAt&&!a.reportFinishedAt&&
    (a.matchStatus==="SCHEDULED"||a.matchStatus==="IN_PROGRESS"));
  const reports=accepted.filter(a=>!!a.reportFinishedAt||!!a.reportStatus&&
    ["SUBMITTED","CHANGES_REQUESTED","APPROVING","APPROVED"].includes(a.reportStatus));
  const finished=accepted.filter(a=>["COMPLETED","CORRECTED"].includes(a.matchStatus));
  const future=upcoming.filter(a=>!!a.startsAt&&Date.parse(a.startsAt)>Date.now());
  const selectedSub=sub[main]??"";
  const kabulDay=(value:Date)=>{
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kabul",
      year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(value);
    const data=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    return `${data.year}-${data.month}-${data.day}`;
  };
  const calendarKey=kabulDay(calendarAnchor);
  const getWeek=(key:string)=>{
    const date=new Date(key+"T00:00:00Z");
    const weekday=(date.getUTCDay()+6)%7;
    date.setUTCDate(date.getUTCDate()-weekday);
    return date.toISOString().slice(0,10);
  };
  const shiftCalendar=(direction:number)=>{
    setCalendarAnchor(current=>{
      const result=new Date(current.getTime());
      if(calendarView==="month")result.setUTCMonth(result.getUTCMonth()+direction);
      else result.setUTCDate(result.getUTCDate()+(calendarView==="week"?7:1)*direction);
      return result;
    });
  };
  const calendarItems=assignments.filter(m=>{
    if(!m.startsAt)return false;
    const day=kabulDay(new Date(m.startsAt));
    if(calendarView==="day")return day===calendarKey;
    if(calendarView==="week")return getWeek(day)===getWeek(calendarKey);
    return day.slice(0,7)===calendarKey.slice(0,7);
  });
  const changeProfile=(patch:Partial<RefereeProfile>)=>setDraft(old=>old?{...old,...patch}:old);
  const editSlot=(day:number,field:"start"|"end",value:string)=>{
    if(!draft)return;
    const current=draft.weeklyAvailability.find(x=>x.day===day);
    if(!current)return;
    changeProfile({weeklyAvailability:draft.weeklyAvailability.map(x=>x.day===day?{...x,[field]:value}:x)});
  };
  function card(m:RefereeMatch){
    return <Card key={m.id} style={{gap:spacing.sm}}>
      <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={{flex:1}}>
          <AppText weight="bold">{m.homeTeamName}  VS  {m.awayTeamName}</AppText>
          <AppText variant="caption" muted>{m.competitionName} · {m.venueName}</AppText>
        </View>
        <StatusBadge status={m.responseStatus}/>
      </View>
      <AppText variant="caption" muted>{fmt(m.startsAt)} · {m.durationMinutes} {tr("minutes")}</AppText>
      <View style={styles.actions}>
        <Button label={tr("details")} variant="secondary" onPress={()=>router.push({
          pathname:"/competitions/[competitionId]/matches/[matchId]",
          params:{competitionId:m.competitionId,matchId:m.id},
        })}/>
        {m.latitude!==null&&m.longitude!==null?<Button label={tr("location")} variant="secondary"
          onPress={()=>void map(m.latitude,m.longitude)}/>:null}
        {m.responseStatus==="ACCEPTED"&&m.authorized&&
          (["SCHEDULED","IN_PROGRESS"].includes(m.matchStatus)||!!m.reportStatus)?
          <Button label={t("rf2.openMatch")} variant="secondary"
            onPress={()=>{setActiveCenterMatch(m);choose("center");setSub(x=>({...x,center:"live"}));}}/>:null}
      </View>
      {!m.authorized?<AppText variant="caption" style={{color:colors.danger}}>{tr("venueRevoked")}</AppText>:null}
      {m.responseStatus==="PENDING"&&m.authorized&&m.matchStatus==="SCHEDULED"?<>
        <TextField label={tr("declineReason")} value={reason[m.id]??""}
          onChangeText={v=>setReason(x=>({...x,[m.id]:v}))} maxLength={400}/>
        <View style={styles.actions}>
          <Button label={tr("accept")} disabled={busy!==null} loading={busy===m.id+":ACCEPTED"}
            onPress={()=>void act(m.id+":ACCEPTED",()=>refereeApi.respond(token!,m.id,"ACCEPTED"))}/>
          <Button label={tr("decline")} variant="danger" disabled={busy!==null}
            onPress={()=>void act(m.id+":DECLINED",()=>refereeApi.respond(token!,m.id,"DECLINED",reason[m.id]))}/>
        </View>
      </>:null}
      {m.responseStatus==="ACCEPTED"&&m.matchStatus==="SCHEDULED"?<>
        <TextField label={tr("withdrawReason")} value={reason[m.id]??""}
          onChangeText={v=>setReason(x=>({...x,[m.id]:v}))} maxLength={400}/>
        <Button label={tr("withdraw")} variant="secondary" disabled={busy!==null||!(reason[m.id]??"").trim()}
          onPress={()=>void act(m.id+":WITHDRAW",()=>refereeApi.respond(token!,m.id,"WITHDRAW_REQUESTED",reason[m.id]))}/>
      </>:null}
    </Card>;
  }
  return <Screen showHeader>
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
    {main!=="overview"?<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subNav}
      contentContainerStyle={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.xs}}>
      {subTabs[main].map(id=><Pressable key={id} accessibilityRole="tab" accessibilityState={{selected:selectedSub===id}}
        style={[styles.subItem,selectedSub===id&&styles.subActive]}
        onPress={()=>setSub(x=>({...x,[main]:id}))}>
        <AppText weight="semibold" variant="caption" style={selectedSub===id?{color:colors.primary}:undefined}>
          {tr(main+"."+id)}</AppText>
      </Pressable>)}
    </ScrollView>:null}
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={tr("retry")} variant="secondary" onPress={()=>setRefresh(v=>v+1)}/></Card>:null}
    {message?<Card style={{backgroundColor:colors.primarySoft}}><AppText>{message}</AppText></Card>:null}
    {loading?<DataLoadingState variant="dashboard" minHeight={460}/>:data?<>
      {main==="overview"?<>
        <Card><AppText variant="bodyLarge" weight="bold">{data.person.name}</AppText>
          <AppText variant="caption" muted>{tr("profileStatus")} · {data.venues.map(v=>v.name).join(", ")||tr("noVenues")}</AppText>
        </Card>
        <View style={styles.stats}>
          <RefStat value={data.stats.total} label={tr("stat.total")}/>
          <RefStat value={data.stats.upcoming} label={tr("stat.upcoming")}/>
          <RefStat value={data.stats.completed} label={tr("stat.completed")}/>
          <RefStat value={data.stats.pending} label={tr("stat.pending")}/>
        </View>
        <Card><AppText variant="bodyLarge" weight="bold">{tr("nextMatch")}</AppText>
          {data.nextMatch?<><AppText weight="bold">{data.nextMatch.homeTeamName} VS {data.nextMatch.awayTeamName}</AppText>
            <AppText variant="caption" muted>{fmt(data.nextMatch.startsAt)} · {data.nextMatch.venueName}</AppText>
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
        {pending.length>0?<Card><AppText weight="semibold">{tr("attention")}: {pending.length}</AppText>
          <Button label={tr("assignments.pending")} onPress={()=>{choose("assignments");setSub(x=>({...x,assignments:"pending"}));}}/></Card>:null}
      </>:null}
      {main==="assignments"&&selectedSub==="pending"?
        (pending.length?pending.map(card):<Card><AppText muted>{tr("emptyPending")}</AppText></Card>):null}
      {main==="assignments"&&selectedSub==="confirmed"?
        (accepted.length?accepted.map(card):<Card><AppText muted>{tr("emptyConfirmed")}</AppText></Card>):null}
      {main==="assignments"&&selectedSub==="calendar"?<>
        <Card>
          <AppText variant="bodyLarge" weight="bold">{tr("calendarHint")}</AppText>
          <View style={styles.actions}>
            {(["day","week","month"] as const).map(mode=><Button key={mode}
              label={tr("calendar."+mode)} variant={calendarView===mode?"primary":"secondary"}
              onPress={()=>setCalendarView(mode)}/>)}
          </View>
          <View style={styles.actions}>
            <Button variant="secondary" label={tr("calendar.prev")} onPress={()=>shiftCalendar(-1)}/>
            <AppText weight="semibold">{fmt(calendarAnchor.toISOString())}</AppText>
            <Button variant="secondary" label={tr("calendar.next")} onPress={()=>shiftCalendar(1)}/>
            <Button variant="secondary" label={tr("calendar.today")} onPress={()=>setCalendarAnchor(new Date())}/>
          </View>
        </Card>
        {calendarItems.length?calendarItems.map(card):
          <Card><AppText muted>{tr("calendar.empty")}</AppText></Card>}
      </>:null}
      {main==="center"&&activeCenterMatch?<RefereeMatchCenter
        key={activeCenterMatch.id} match={activeCenterMatch}
        onClose={()=>{setActiveCenterMatch(null);setRefresh(v=>v+1);}}/>:null}
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
              <View style={{flex:1}}><TextField label={tr("start")} value={slot.start} forceLtr
                onChangeText={v=>editSlot(index,"start",v)}/></View>
              <View style={{flex:1}}><TextField label={tr("end")} value={slot.end} forceLtr
                onChangeText={v=>editSlot(index,"end",v)}/></View>
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
  nav:{borderTopWidth:1,borderBottomWidth:1,borderColor:colors.border,flexGrow:0},
  navItem:{alignItems:"center",gap:4,minWidth:90,paddingVertical:spacing.sm,
    paddingHorizontal:spacing.sm,borderBottomWidth:3,borderBottomColor:"transparent"},
  navActive:{backgroundColor:colors.primarySoft,borderBottomColor:colors.primary,borderRadius:radius.sm},
  subNav:{flexGrow:0,borderBottomWidth:1,borderColor:colors.border},
  subItem:{paddingHorizontal:spacing.md,paddingVertical:spacing.sm,
    borderBottomWidth:2,borderBottomColor:"transparent"},
  subActive:{backgroundColor:colors.primarySoft,borderBottomColor:colors.primary},
  stats:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  stat:{flexGrow:1,flexBasis:"20%",minWidth:74,padding:spacing.md,backgroundColor:colors.surface,
    borderWidth:1,borderColor:colors.border,borderRadius:radius.md,
    alignItems:"center",gap:spacing.xs},
  row:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  badge:{paddingVertical:5,paddingHorizontal:9,borderRadius:radius.pill},
  actions:{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:spacing.sm},
  day:{gap:spacing.sm,paddingVertical:spacing.sm,borderBottomWidth:1,borderColor:colors.border},
});
