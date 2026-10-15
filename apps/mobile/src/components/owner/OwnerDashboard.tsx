import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {OwnerOnboardingStatus} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {AppState,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {ApiRequestError,competitionApi,ownerApi} from "../../lib/api";
import {
  computeOwnerOverview,ownerAttentionItems,ownerPerformance,overviewTabs,percentage,
  type OverviewSnapshot,type OverviewTab,
} from "../../lib/owner-dashboard-overview";
import {addDays,formatCalendarDate,formatCalendarTime,todayKabul} from "../../lib/timetable-calendar";
import {useVisibleTab} from "../../hooks/useVisibleTab";
import {useAuth} from "../../providers/AuthProvider";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";
import {Screen} from "../ui/Screen";

type LoadedOverview={
  token:string;
  date:string;
  status:OwnerOnboardingStatus|null;
  snapshot:OverviewSnapshot|null;
  statusError:string|null;
};

/** All dashboard panels reuse authoritative venue-scoped booking, calendar,
 * competition and analytics endpoints. Optional section failure never hides
 * unrelated data; failed sections display unavailable rather than false zero. */
export function OwnerDashboard(){
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const token=session?.accessToken;
  const userId=session?.user.id;
  const [tab,setTab]=useState<OverviewTab>("today");
  const nav=useVisibleTab<OverviewTab>(tab);
  const [loaded,setLoaded]=useState<LoadedOverview|null>(null);
  const [loading,setLoading]=useState(true);
  const [now,setNow]=useState(Date.now());
  const generation=useRef(0);
  useEffect(()=>{
    // Never retain another owner's selected private overview section.
    setTab("today");
  },[userId]);
  const dayKey=todayKabul();
  const current=loaded?.token===token?loaded:null;
  const status=current?.status??null;
  const snapshot=current?.date===dayKey?current.snapshot:null;
  const summary=useMemo(()=>status&&snapshot
    ?computeOwnerOverview(snapshot,status,dayKey,now):null,
    [snapshot,status,dayKey,now]);
  const attention=useMemo(()=>summary?ownerAttentionItems(summary):[],[summary]);
  const performance=ownerPerformance(snapshot?.analytics??null);
  const formatNumber=useMemo(()=>new Intl.NumberFormat(language),[language]);
  const count=(value:number|null|undefined)=>value===null||value===undefined
    ?"—":formatNumber.format(value);
  const money=(value:number|null|undefined)=>value===null||value===undefined
    ?"—":`${formatNumber.format(value)} AFN`;

  const load=useCallback(async()=>{
    const request=++generation.current;
    if(!token){setLoaded(null);setLoading(false);return;}
    const date=todayKabul();
    setLoading(true);
    try{
      const status=await ownerApi.getStatus(token);
      if(request!==generation.current)return;
      if(!status.venue){
        setLoaded({token,date,status,snapshot:null,statusError:null});
        return;
      }
      const settled=await Promise.allSettled([
        ownerApi.timetableCalendar(token,date,date,null),
        ownerApi.pendingBookings(token),
        competitionApi.ownerList(token),
        ownerApi.analytics(token,addDays(date,-6),date),
      ] as const);
      if(request!==generation.current)return;
      const [calendar,pending,competitions,analytics]=settled;
      const failures:Array<OverviewSnapshot["failures"][number]>=[];
      if(calendar.status==="rejected")failures.push("calendar");
      if(pending.status==="rejected")failures.push("pending");
      if(competitions.status==="rejected")failures.push("competitions");
      if(analytics.status==="rejected")failures.push("analytics");
      setLoaded({
        token,date,status,statusError:null,
        snapshot:{
          day:calendar.status==="fulfilled"?calendar.value.days.find(day=>day.date===date)??null:null,
          pending:pending.status==="fulfilled"?pending.value.bookings:null,
          competitions:competitions.status==="fulfilled"?competitions.value.competitions:null,
          analytics:analytics.status==="fulfilled"?analytics.value:null,
          failures,
        },
      });
    }catch(cause){
      if(request!==generation.current)return;
      // Never mistake a failed status read for a venue that has not been set up.
      setLoaded({token,date,status:null,snapshot:null,statusError:
        cause instanceof ApiRequestError&&cause.isNetworkError
          ?t("owner.networkError"):t("owner.loadError")});
    }finally{
      if(request===generation.current){setNow(Date.now());setLoading(false);}
    }
  },[token,t]);

  useFocusEffect(useCallback(()=>{
    void load();
    // Dashboard returns current operational state even when the owner stays
    // on this screen while another user submits a booking.
    const timer=setInterval(()=>{
      if(AppState.currentState==="active")void load();
    },60_000);
    return()=>{generation.current++;clearInterval(timer);};
  },[load]));

  const links=[
    {key:"bookings",icon:"receipt-outline",label:"owner.dashboardNav.bookings",href:"/owner/bookings"},
    {key:"schedule",icon:"calendar-outline",label:"owner.dashboardNav.schedule",href:"/owner/schedule"},
    {key:"competitions",icon:"trophy-outline",label:"owner.dashboardNav.competitions",href:"/owner/competitions"},
    {key:"analysis",icon:"stats-chart-outline",label:"owner.dashboardNav.analysis",href:"/owner/analytics"},
  ] as const;
  const goSchedule=()=>router.push({pathname:"/owner/schedule",params:{date:dayKey}});
  if(loading&&!current)return <Screen embedded>
    <DataLoadingState variant="dashboard" minHeight={430}/>
  </Screen>;

  return <Screen embedded refreshing={loading&&!!current} onRefresh={()=>void load()}>
    <View testID="owner-phase1-overview" style={styles.hero}>
      <View style={[styles.heroRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.heroIcon}>
          <Ionicons name="business-outline" color="#FFFFFF" size={26}/>
        </View>
        <View style={{flex:1,gap:4}}>
          <AppText variant="bodyLarge" weight="bold" style={{color:"#FFFFFF"}}>
            {status?.venue?.name??t("owner.dashboardTitle")}
          </AppText>
          <AppText variant="caption" style={{color:"#DBEAFE"}}>
            {t("owner.phase2.subtitle")}
          </AppText>
          <AppText variant="caption" style={{color:"#FFFFFF"}}>
            {formatCalendarDate(dayKey,language,{weekday:"long",month:"long",day:"numeric",year:"numeric"})}
          </AppText>
        </View>
      </View>
      {status?<View style={[styles.subscriptionPill,{alignSelf:isRTL?"flex-end":"flex-start"}]}>
        <AppText variant="caption" weight="semibold" style={{color:"#FFFFFF"}}>
          {t(`owner.subscription.${status.subscription.state}` as never)}
        </AppText>
      </View>:null}
    </View>

    {current?.statusError?<Card style={styles.stack}>
      <AppText style={{color:colors.danger}}>{current.statusError}</AppText>
      <Button label={t("common.retry")} variant="secondary" onPress={()=>void load()}/>
    </Card>:null}

    {!status?.venue&&!current?.statusError?<Card style={styles.stack}>
      <AppText weight="semibold" style={{color:colors.primary}}>{t("owner.setupRequiredTitle")}</AppText>
      <AppText>{t("owner.setupRequiredBody")}</AppText>
      <Button label={t("owner.startSetup")} onPress={()=>router.push("/owner/onboarding")}/>
    </Card>:null}

    {status?.venue?<View style={styles.stack}>
      <ScrollView testID="owner-phase2-subnavigation" horizontal
        ref={nav.scrollRef} onLayout={nav.onViewport}
        onContentSizeChange={nav.onContentSize}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.tabs,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {overviewTabs.map(id=><Pressable
          key={id} testID={`owner-phase2-tab-${id}`}
          accessibilityRole="tab" accessibilityState={{selected:tab===id}}
          accessibilityLabel={t(`owner.phase2.tab.${id}` as never)}
          onLayout={event=>nav.cellLayout(id,event)}
          onPress={()=>{setTab(id);nav.focus(id,true);}}
          style={[styles.tab,tab===id&&styles.tabSelected]}>
          <AppText variant="caption" weight="semibold"
            style={tab===id?styles.tabTextSelected:undefined}>
            {t(`owner.phase2.tab.${id}` as never)}
          </AppText>
        </Pressable>)}
      </ScrollView>

      {snapshot?.failures.length?<Card style={styles.alert}>
        <AppText style={{color:colors.warning}}>{t("owner.phase2.partialError")}</AppText>
        <Button variant="secondary" label={t("common.retry")} onPress={()=>void load()}/>
      </Card>:null}
      {loading?<AppText variant="caption" muted>{t("owner.phase2.refreshing")}</AppText>:null}

      {tab==="today"?<>
        <AppText weight="bold" variant="bodyLarge">{t("owner.phase2.todayTitle")}</AppText>
        <View style={[styles.metricGrid,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Metric icon="checkmark-circle-outline" label={t("owner.phase2.confirmed")}
            value={count(summary?.confirmedToday)} />
          <Metric icon="hourglass-outline" label={t("owner.phase2.pending")}
            value={count(summary?.pendingCount)} onPress={()=>router.push("/owner/bookings")}/>
          <Metric icon="calendar-outline" label={t("owner.phase2.available")}
            value={count(summary?.availableToday)} onPress={goSchedule}/>
          <Metric icon="cash-outline" label={t("owner.phase2.confirmedValue")}
            value={money(summary?.confirmedBookingValueToday)}/>
          <Metric icon="trophy-outline" label={t("owner.phase2.activeCompetitions")}
            value={count(summary?.activeCompetitionCount)}
            onPress={()=>router.push("/owner/competitions")}/>
          <Metric icon="football-outline" label={t("owner.phase2.upcomingMatches")}
            value={count(summary?.upcomingMatchCount)} onPress={goSchedule}/>
        </View>

        {attention.length>0?<Pressable testID="owner-phase2-action-nudge"
          accessibilityRole="button" onPress={()=>setTab("actions")}
          style={[styles.nudge,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.warning}/>
          <AppText weight="semibold" style={{flex:1}}>
            {t("owner.phase2.needAttention",{count:attention.length})}
          </AppText>
          <Ionicons name="chevron-forward-outline" size={18} color={colors.primary}/>
        </Pressable>:null}

        <View style={[styles.sectionHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <AppText weight="bold" variant="bodyLarge" style={{flex:1}}>
            {t("owner.phase2.nextToday")}
          </AppText>
          <Button label={t("owner.phase2.viewCalendar")} variant="ghost" onPress={goSchedule}/>
        </View>
        {!snapshot?.day?<Card><AppText muted>{t("owner.phase2.unavailable")}</AppText></Card>
          :summary?.upcoming.length===0?<Card>
            <AppText muted>{t("owner.phase2.noUpcoming")}</AppText>
          </Card>:
          summary?.upcoming.slice(0,5).map(item=><Pressable key={item.id}
            testID={`owner-phase2-event-${item.id}`}
            accessibilityRole="button" onPress={goSchedule}
            style={[styles.eventRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <View style={styles.eventTime}>
              <AppText weight="bold" forceLtr variant="caption">
                {item.startsAt?formatCalendarTime(item.startsAt,language):"—"}
              </AppText>
            </View>
            <View style={{flex:1,gap:3}}>
              <AppText weight="semibold" numberOfLines={2}>{item.title}</AppText>
              <AppText variant="caption" muted>{item.areaName}</AppText>
            </View>
            <Ionicons name={item.type==="COMPETITION"?"trophy-outline":"checkmark-circle-outline"}
              size={20} color={colors.primary}/>
          </Pressable>)}

        <AppText weight="bold" variant="bodyLarge">{t("owner.phase1.quickAccess")}</AppText>
        <View style={[styles.quickGrid,{flexDirection:isRTL?"row-reverse":"row"}]}>
          {links.map(item=><Pressable key={item.key}
            testID={`owner-phase1-shortcut-${item.key}`}
            accessibilityRole="button" accessibilityLabel={t(item.label)}
            style={styles.quickLink} onPress={()=>router.push(item.href)}>
            <Ionicons name={item.icon} size={21} color={colors.primary}/>
            <AppText variant="caption" weight="semibold"
              style={{textAlign:"center"}}>{t(item.label)}</AppText>
          </Pressable>)}
        </View>
      </>:null}

      {tab==="actions"?<>
        <AppText weight="bold" variant="bodyLarge">{t("owner.phase2.actionCenter")}</AppText>
        <AppText variant="caption" muted>{t("owner.phase2.actionsSubtitle")}</AppText>
        {!summary?<Card><AppText muted>{t("owner.phase2.unavailable")}</AppText></Card>
          :attention.length===0&&summary.pendingCount!==null
            &&summary.registrationOpenCount!==null?<Card style={styles.stack}>
            <Ionicons name="checkmark-circle-outline" size={30} color={colors.success}/>
            <AppText weight="semibold">{t("owner.phase2.allCaughtUp")}</AppText>
            <AppText muted>{t("owner.phase2.allCaughtUpBody")}</AppText>
          </Card>:attention.map(item=><Pressable key={item.key}
            testID={`owner-phase2-attention-${item.key}`}
            accessibilityRole="button" onPress={()=>router.push(item.href)}
            style={[styles.actionRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Ionicons name={item.key==="pending"?"hourglass-outline":
              item.key==="subscription"?"card-outline":
              item.key==="paused"?"pause-circle-outline":"trophy-outline"}
              size={24} color={item.tone==="warning"?colors.warning:colors.primary}/>
            <View style={{flex:1,gap:4}}>
              <AppText weight="semibold">
                {t(`owner.phase2.action.${item.key}` as never)}
                {item.amount!==undefined?` (${count(item.amount)})`:""}
              </AppText>
              <AppText variant="caption" muted>
                {t(`owner.phase2.actionBody.${item.key}` as never)}
              </AppText>
            </View>
            <Ionicons name="chevron-forward-outline" size={18} color={colors.primary}/>
          </Pressable>)}
        {summary?.pendingCount===null?<Card>
          <AppText variant="caption" muted>{t("owner.phase2.pendingUnavailable")}</AppText>
          <Button label={t("owner.dashboardNav.bookings")} variant="secondary"
            onPress={()=>router.push("/owner/bookings")}/>
        </Card>:null}
      </>:null}

      {tab==="performance"?<>
        <AppText weight="bold" variant="bodyLarge">{t("owner.phase2.performanceTitle")}</AppText>
        <AppText variant="caption" muted>{t("owner.phase2.last7Days")}</AppText>
        {performance?<View style={[styles.metricGrid,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Metric icon="cash-outline" label={t("owner.phase2.grossBookingValue")}
            value={money(performance.grossBookingValue)}/>
          <Metric icon="calendar-outline" label={t("owner.phase2.periodBookings")}
            value={count(performance.bookings)}/>
          <Metric icon="speedometer-outline" label={t("owner.phase2.occupancy")}
            value={percentage(performance.occupancy)}/>
          <Metric icon="close-circle-outline" label={t("owner.phase2.cancellationRate")}
            value={percentage(performance.cancellations)}/>
          <Metric icon="phone-portrait-outline" label={t("owner.phase2.onlineShare")}
            value={percentage(performance.onlineShare)}/>
        </View>:<Card><AppText muted>{t("owner.phase2.unavailable")}</AppText></Card>}
        {performance?<Card style={styles.stack}>
          <AppText weight="bold">{t("owner.phase2.previousPeriod")}</AppText>
          <AppText>{t("owner.phase2.grossBookingValue")}: {percentage(performance.revenueChangeRate)}</AppText>
          <AppText>{t("owner.phase2.periodBookings")}: {percentage(performance.bookingChangeRate)}</AppText>
          <AppText>{t("owner.phase2.occupancy")}: {percentage(performance.occupancyChangeRate)}</AppText>
        </Card>:null}
        <AppText variant="caption" muted>{t("owner.phase2.valueDisclaimer")}</AppText>
        <Button label={t("owner.phase2.fullAnalytics")} variant="secondary"
          onPress={()=>router.push("/owner/analytics")}/>
      </>:null}
    </View>:null}
  </Screen>;
}

function Metric({label,value,icon,onPress}:{label:string;value:string;
  icon:keyof typeof Ionicons.glyphMap;onPress?:()=>void;}){
  const contents=<>
    <Ionicons name={icon} size={19} color={colors.primary}/>
    <AppText variant="bodyLarge" weight="bold" numberOfLines={1}>{value}</AppText>
    <AppText variant="caption" muted numberOfLines={2}>{label}</AppText>
  </>;
  return onPress
    ?<Pressable accessibilityRole="button" accessibilityLabel={label}
        onPress={onPress} style={styles.metric}>{contents}</Pressable>
    :<Card style={styles.metric}>{contents}</Card>;
}
const styles=StyleSheet.create({
  stack:{gap:spacing.md},
  hero:{backgroundColor:colors.primary,borderRadius:radius.lg,padding:spacing.lg,gap:spacing.md},
  heroRow:{gap:spacing.md,alignItems:"center"},
  heroIcon:{width:50,height:50,borderRadius:radius.md,
    backgroundColor:"#FFFFFF29",alignItems:"center",justifyContent:"center"},
  subscriptionPill:{paddingHorizontal:spacing.md,paddingVertical:spacing.xs,
    backgroundColor:"#FFFFFF29",borderRadius:radius.pill},
  tabs:{flexGrow:1,gap:spacing.sm,paddingBottom:spacing.sm,alignItems:"center"},
  tab:{minHeight:44,minWidth:110,paddingHorizontal:spacing.md,borderRadius:radius.pill,
    backgroundColor:colors.surface,borderColor:colors.border,borderWidth:1,
    justifyContent:"center",alignItems:"center"},
  tabSelected:{backgroundColor:colors.primarySoft,borderColor:colors.primary},
  tabTextSelected:{color:colors.primary},
  metricGrid:{flexWrap:"wrap",gap:spacing.sm},
  metric:{width:"48%",minHeight:108,padding:spacing.md,gap:spacing.xs,
    backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.lg,alignItems:"flex-start",justifyContent:"center"},
  sectionHeading:{alignItems:"center",gap:spacing.sm},
  eventRow:{minHeight:66,alignItems:"center",gap:spacing.md,
    padding:spacing.md,backgroundColor:colors.surface,borderRadius:radius.lg,
    borderWidth:1,borderColor:colors.border},
  eventTime:{minWidth:85,alignItems:"center",justifyContent:"center"},
  alert:{gap:spacing.sm},
  nudge:{alignItems:"center",gap:spacing.sm,borderRadius:radius.md,
    padding:spacing.md,backgroundColor:colors.primarySoft},
  actionRow:{minHeight:75,alignItems:"center",gap:spacing.md,
    backgroundColor:colors.surface,padding:spacing.md,borderRadius:radius.lg,
    borderWidth:1,borderColor:colors.border},
  quickGrid:{flexWrap:"wrap",gap:spacing.sm},
  quickLink:{width:"48%",minHeight:86,padding:spacing.sm,alignItems:"center",
    justifyContent:"center",gap:spacing.xs,borderRadius:radius.md,
    borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},
});
