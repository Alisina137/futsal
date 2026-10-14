import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,spacing} from "@leaguekick/design-tokens";
import type {NotificationDto,PublicVenueDto,PublicVenueScheduleChange} from "@leaguekick/contracts";
import {router,type Href} from "expo-router";
import {useCallback,useEffect,useRef,useState} from "react";
import {View} from "react-native";
import {notificationApi,venueApi} from "../../lib/api";
import {formatClock12From24Hour} from "../../lib/clock-display";
import {formatLocalDateTime} from "../../lib/date-time";
import {publishNotificationUnread} from "../../lib/notification-events";
import {safeNotificationDeepLink} from "../../lib/notification-routing";
import {useAuth} from "../../providers/AuthProvider";
import {useLocale} from "../../providers/LocaleProvider";
import {useNetwork} from "../../providers/NetworkProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";

function localDayKey(timeZone:string){
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone,year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(new Date());
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return values.year+"-"+values.month+"-"+values.day;
}
function addDays(key:string,days:number){
  const base=new Date(key+"T12:00:00Z");
  base.setUTCDate(base.getUTCDate()+days);
  return base.toISOString().slice(0,10);
}
export type VenueUpdateDetailSub="schedule"|"alerts";
export function VenueUpdatesPanel({venue,sub,onReserve}:{
  venue:PublicVenueDto;sub:VenueUpdateDetailSub;onReserve:()=>void;
}){
  const {session}=useAuth();
  const {language,isRTL,t}=useLocale();
  const {reconnectVersion,isOnline}=useNetwork();
  const tr=(key:string)=>t(("vd6."+key) as never);
  const [schedule,setSchedule]=useState<PublicVenueScheduleChange[]>([]);
  const [notices,setNotices]=useState<NotificationDto[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(false);
  const [loadingMore,setLoadingMore]=useState(false),[moreError,setMoreError]=useState(false);
  const [page,setPage]=useState(1),[hasMore,setHasMore]=useState(false);
  const [unread,setUnread]=useState(0),[busyId,setBusyId]=useState<string|null>(null);
  const [actionError,setActionError]=useState(false);
  const [version,setVersion]=useState(0);
  const epoch=useRef(0);
  const token=session?.accessToken;
  const dateLabel=(date:string)=>new Intl.DateTimeFormat(language==="en"?"en-GB":language,{
    timeZone:"UTC",calendar:"gregory",year:"numeric",month:"short",day:"numeric",weekday:"long",
  }).format(new Date(date+"T12:00:00Z"));
  const load=useCallback(async()=>{
    const request=++epoch.current;
    setSchedule([]);setNotices([]);setError(false);setMoreError(false);
    setLoading(true);setLoadingMore(false);setBusyId(null);setActionError(false);
    setUnread(0);setPage(1);setHasMore(false);
    try{
      if(sub==="schedule"){
        const from=localDayKey(venue.timezone),to=addDays(from,30);
        const result=await venueApi.scheduleChanges(venue.id,from,to);
        if(epoch.current!==request)return;
        setSchedule(result.changes);
      }else if(token){
        const result=await notificationApi.venue(token,venue.id,1);
        if(epoch.current!==request)return;
        setNotices(result.notifications.filter(item=>item.data.venueId===venue.id));
        setPage(result.page);setHasMore(result.hasMore);setUnread(result.unreadCount);
      }
    }catch{
      if(epoch.current===request)setError(true);
    }finally{if(epoch.current===request)setLoading(false);}
  },[sub,token,venue.id,venue.timezone]);
  useEffect(()=>{
    void load();
    return()=>{epoch.current+=1;};
  },[load,reconnectVersion,version]);
  async function loadMore(){
    if(!token||loading||loadingMore||!hasMore)return;
    const request=epoch.current;
    setLoadingMore(true);setMoreError(false);
    try{
      const result=await notificationApi.venue(token,venue.id,page+1);
      if(epoch.current!==request)return;
      setNotices(old=>[...old,...result.notifications.filter(item=>
        item.data.venueId===venue.id&&!old.some(previous=>previous.id===item.id))]);
      setPage(result.page);setHasMore(result.hasMore);setUnread(result.unreadCount);
    }catch{if(epoch.current===request)setMoreError(true);}
    finally{if(epoch.current===request)setLoadingMore(false);}
  }
  async function openNotice(notice:NotificationDto){
    if(!token||busyId)return;
    const request=epoch.current;
    setBusyId(notice.id);setActionError(false);
    try{
      if(!notice.readAt){
        const {notification}=await notificationApi.markRead(token,notice.id);
        if(request!==epoch.current)return;
        setNotices(old=>old.map(item=>item.id===notice.id?notification:item));
        setUnread(value=>Math.max(0,value-1));
        try{
          const count=await notificationApi.unreadCount(token);
          if(request===epoch.current)publishNotificationUnread(token,count.unreadCount);
        }catch{/* The server-side read was successful even if badge refresh failed. */}
      }
      if(request!==epoch.current)return;
      const destination=safeNotificationDeepLink(notice.deepLink);
      if(destination)router.push(destination as Href);
    }catch{if(request===epoch.current)setActionError(true);}
    finally{if(request===epoch.current)setBusyId(null);}
  }

  if(sub==="schedule")return <View style={{gap:spacing.md}} testID="venue-schedule-changes">
    <Card style={{gap:spacing.xs}}>
      <AppText variant="bodyLarge" weight="bold">{tr("scheduleTitle")}</AppText>
      <AppText variant="caption" muted>{tr("scheduleDescription")}</AppText>
    </Card>
    {loading?<DataLoadingState variant="list" minHeight={175}/>:null}
    {error?<Card style={{gap:spacing.sm}}>
      <AppText style={{color:colors.danger}}>{tr("scheduleError")}</AppText>
      <Button variant="secondary" label={t("common.retry")} onPress={()=>setVersion(v=>v+1)}/>
    </Card>:null}
    {!loading&&!error&&schedule.length===0?<Card style={{gap:spacing.sm}}>
      <AppText muted>{tr("noChanges")}</AppText>
    </Card>:null}
    {schedule.map((change,index)=><Card key={change.date+"-"+index}
      testID={"venue-schedule-change-"+change.date} style={{gap:spacing.sm}}>
      <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
        <Ionicons name={change.isClosed?"close-circle-outline":"calendar-outline"}
          size={20} color={change.isClosed?colors.danger:colors.primary}/>
        <AppText weight="bold" style={{flex:1}}>{dateLabel(change.date)}</AppText>
      </View>
      {change.areaName?<AppText variant="caption" muted>{change.areaName}</AppText>:null}
      <AppText weight="semibold">{change.isClosed?tr("closed"):
        tr("specialHours")}</AppText>
      {!change.isClosed?change.periods.map((period,i)=><AppText key={i} forceLtr>
        {formatClock12From24Hour(period.startsAt)+" – "+
          formatClock12From24Hour(period.endsAt)}
      </AppText>):null}
    </Card>)}
    <Button label={tr("checkAvailability")} variant="secondary" onPress={onReserve}/>
  </View>;

  return <View style={{gap:spacing.md}} testID="venue-specific-alerts">
    {!venue.onlineBookingEnabled?<Card style={{gap:spacing.sm}}>
      <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
        <Ionicons name="warning-outline" size={22} color={colors.warning}/>
        <AppText weight="bold" style={{flex:1}}>{tr("bookingPaused")}</AppText>
      </View>
      <AppText>{tr("bookingPausedDescription")}</AppText>
    </Card>:null}
    <Card style={{gap:spacing.sm}}>
      <AppText weight="bold">{tr("personalAlerts")}</AppText>
      <AppText variant="caption" muted>{tr("alertsDescription")}</AppText>
      {token?<AppText variant="caption" weight="semibold">
        {tr("unread")+": "+unread}</AppText>
        :<AppText muted>{tr("signInAlerts")}</AppText>}
      {loading?<DataLoadingState variant="list" minHeight={150}/>:null}
      {error?<AppText style={{color:colors.danger}}>{tr("alertsError")}</AppText>:null}
      {token&&!loading&&!error&&notices.length===0?
        <AppText muted>{tr("noAlerts")}</AppText>:null}
      {notices.map(item=><View key={item.id} testID={"venue-alert-"+item.id}
        style={{gap:spacing.sm,borderTopWidth:1,borderColor:colors.border,
          paddingTop:spacing.sm}}>
        <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.xs}}>
          <Ionicons name={item.readAt?"notifications-outline":"notifications"}
            size={19} color={colors.primary}/>
          <View style={{gap:spacing.xs,flex:1}}>
            <AppText weight="semibold">{item.title}</AppText>
            <AppText>{item.body}</AppText>
            <AppText variant="caption" muted>
              {formatLocalDateTime(item.createdAt,language,venue.timezone)}
            </AppText>
            {!item.readAt?<AppText variant="caption" style={{color:colors.primary}}>
              {tr("unread")}</AppText>:null}
          </View>
        </View>
        <Button variant="secondary" label={item.readAt?tr("open"):tr("readAndOpen")}
          disabled={busyId!==null||!isOnline} loading={busyId===item.id}
          onPress={()=>void openNotice(item)}/>
      </View>)}
      {actionError?<AppText style={{color:colors.danger}}>{tr("markReadError")}</AppText>:null}
      {moreError?<AppText style={{color:colors.danger}}>{tr("alertsError")}</AppText>:null}
      {hasMore?<Button variant="secondary" label={tr("loadMore")}
        disabled={loadingMore||!isOnline} loading={loadingMore}
        onPress={()=>void loadMore()}/>:null}
      {token?<Button variant="ghost" label={t("common.retry")}
        disabled={loading||!isOnline} onPress={()=>setVersion(v=>v+1)}/>:null}
      <Button label={tr("notificationSettings")} variant="secondary"
        onPress={()=>router.push("/notifications/preferences")}/>
      <AppText variant="caption" muted>{tr("globalSettingsNote")}</AppText>
    </Card>
  </View>;
}
