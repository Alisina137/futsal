import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {AdminAnalyticsDays,AdminAnalyticsResponse} from "@leaguekick/contracts";
import {Pressable,View} from "react-native";
import {formatCalendarDate} from "../../lib/timetable-calendar";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Card} from "../ui/Card";
import {AdminMetricChart,AdminPeriodPicker} from "./AdminAnalyticsVisuals";
import {styles} from "./AdminStyles";
import type {SectionKey} from "./admin-navigation";

type Icon=keyof typeof Ionicons.glyphMap;
export function DashboardSection({data,days,onDays,setSection}:{
  data:AdminAnalyticsResponse|null;
  days:AdminAnalyticsDays;onDays:(days:AdminAnalyticsDays)=>void;
  setSection:(section:SectionKey)=>void;
}){
  const {t,language,isRTL}=useLocale();
  if(!data)return <AppText muted>{t("admin2.empty" as never)}</AppText>;
  const n=(value:number)=>new Intl.NumberFormat(language==="en"?"en-US":language).format(value);
  const money=(value:number)=>n(value)+" AFN";
  const m=data.metrics,k=data.totals,a=data.attention;
  const stats:{key:string;value:string;icon:Icon;detail?:string}[]=[
    {key:"users",value:n(k.users),icon:"people-outline",detail:n(k.activeAccounts)+" "+t("admin2.activeAccounts" as never)},
    {key:"venues",value:n(k.venues),icon:"business-outline",detail:n(k.activeVenues)+" "+t("admin2.activeVenues" as never)},
    {key:"payingVenues",value:n(k.payingVenues),icon:"checkmark-circle-outline"},
    {key:"payingTeams",value:n(k.payingTeamManagers),icon:"shirt-outline"},
    {key:"competitions",value:n(k.activeCompetitions),icon:"trophy-outline"},
    {key:"newUsers",value:n(m.newUsers),icon:"person-add-outline"},
    {key:"bookings",value:n(m.confirmedBookings),icon:"calendar-outline"},
    {key:"income",value:money(m.recordedVenuePaymentsAfn),icon:"wallet-outline"},
    {key:"gmv",value:money(m.bookingGmvAfn),icon:"analytics-outline"},
  ];
  const queues:{key:string;count:number;section:SectionKey;icon:Icon}[]=[
    {key:"venueApprovals",count:a.pendingVenueVerifications,section:"venues",icon:"business-outline"},
    {key:"roleApprovals",count:a.pendingRoleSubscriptions,section:"subscriptions",icon:"card-outline"},
    {key:"teamSlotApprovals",count:a.pendingExtraTeamSlots,section:"subscriptions",icon:"people-outline"},
    {key:"pendingBookings",count:a.pendingBookings,section:"venues",icon:"calendar-outline"},
    {key:"expiring",count:a.expiringPaidVenues7d,section:"subscriptions",icon:"time-outline"},
  ];
  return <View style={{gap:spacing.lg}}>
    <View style={[styles.sectionIntro,{gap:spacing.sm}]}>
      <AppText variant="title" weight="bold">{t("admin2.dashboardTitle" as never)}</AppText>
      <AppText muted>{t("admin2.dashboardSubtitle" as never)}</AppText>
      <AdminPeriodPicker value={days} onChange={onDays}/>
      <AppText variant="caption" muted>{t("admin2.periodRange" as never)}: {
        formatCalendarDate(data.period.from,language,{day:"numeric",month:"short",year:"numeric"})
      } – {formatCalendarDate(data.period.to,language,{day:"numeric",month:"short",year:"numeric"})}
        {" · "}{t("admin2.kabulZone" as never)}
      </AppText>
    </View>
    <View style={styles.metricGrid}>
      {stats.map(stat=><View key={stat.key} style={styles.metricCard}>
        <View style={[styles.metricIcon,{backgroundColor:"#E7F0FF"}]}>
          <Ionicons name={stat.icon} size={22} color={colors.primary}/>
        </View>
        <AppText variant="caption" muted>{t(("admin2."+stat.key) as never)}</AppText>
        <AppText variant="title" weight="bold" forceLtr>{stat.value}</AppText>
        {stat.detail?<AppText variant="caption" muted>{stat.detail}</AppText>:null}
      </View>)}
    </View>
    <Card style={{gap:spacing.md,padding:spacing.lg}}>
      <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
        <Ionicons name="notifications-outline" size={23} color={colors.primary}/>
        <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>
          {t("admin2.attention" as never)}
        </AppText>
        <AppText variant="caption" muted>{t("admin2.liveCounts" as never)}</AppText>
      </View>
      <View style={{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm}}>
        {queues.map(item=><Pressable key={item.key} accessibilityRole="button"
          accessibilityLabel={t(("admin2."+item.key) as never)+": "+n(item.count)}
          onPress={()=>setSection(item.section)}
          style={({pressed})=>[{flexGrow:1,flexBasis:195,minWidth:0,
            borderWidth:1,borderColor:item.count>0?"#F6D5A7":colors.border,
            backgroundColor:item.count>0?"#FFFAED":"#F8FAFC",borderRadius:radius.md,
            padding:spacing.md,gap:spacing.sm},pressed&&{opacity:.8}]}>
          <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
            <Ionicons name={item.icon} size={20} color={item.count>0?"#92400E":colors.primary}/>
            <AppText weight="bold" variant="bodyLarge" style={{flex:1}}>{n(item.count)}</AppText>
            <Ionicons name={isRTL?"arrow-back-outline":"arrow-forward-outline"} size={18} color={colors.primary}/>
          </View>
          <AppText variant="caption" weight="semibold">{t(("admin2."+item.key) as never)}</AppText>
        </Pressable>)}
      </View>
      <AppText variant="caption" muted>{t("admin2.attentionScope" as never)}</AppText>
    </Card>
    <View style={{flexDirection:"row",flexWrap:"wrap",gap:spacing.md}}>
      <AdminMetricChart data={data} title={t("admin2.newUsers" as never)}
        field="newUsers" interval={days<=30?"day":days===90?"week":"month"}/>
      <AdminMetricChart data={data} title={t("admin2.income" as never)}
        field="recordedVenuePaymentsAfn" interval={days<=30?"day":days===90?"week":"month"} currency
        color="#0F766E"/>
    </View>
    <Card style={{gap:spacing.sm,padding:spacing.lg}}>
      <AppText weight="bold">{t("admin2.financialNote" as never)}</AppText>
      <AppText variant="caption" muted>{t("admin2.revenueScope" as never)}</AppText>
      <Pressable accessibilityRole="button" onPress={()=>setSection("analytics")}
        style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm,
          alignSelf:"flex-start",minHeight:42}}>
        <AppText weight="semibold" style={{color:colors.primary}}>{t("admin2.openAnalytics" as never)}</AppText>
        <Ionicons name={isRTL?"arrow-back":"arrow-forward"} color={colors.primary} size={17}/>
      </Pressable>
    </Card>
  </View>;
}
