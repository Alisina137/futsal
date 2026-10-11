import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {AdminAnalyticsDays,AdminAnalyticsResponse} from "@leaguekick/contracts";
import {useState} from "react";
import {Pressable,View} from "react-native";
import {formatCalendarDate} from "../../lib/timetable-calendar";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Card} from "../ui/Card";
import {AdminMetricChart,AdminPeriodPicker} from "./AdminAnalyticsVisuals";
import {safeRatio,type AnalyticsInterval} from "./admin-analytics-display";

const fullIntervals=["day","week","month"] as const;
const longIntervals=["week","month"] as const;
function Breakdown({title,description,entries}:{
  title:string;description:string;entries:{name:string;value:number}[];
}){
  const {language,t,isRTL}=useLocale();
  const fmt=new Intl.NumberFormat(language==="en"?"en-US":language);
  const max=Math.max(1,...entries.map(item=>item.value));
  return <Card style={{gap:spacing.md,padding:spacing.lg,flexGrow:1,flexBasis:280,flexShrink:1,minWidth:0}}>
    <AppText variant="bodyLarge" weight="bold">{title}</AppText>
    <AppText variant="caption" muted>{description}</AppText>
    {entries.length===0?<AppText variant="caption" muted>{t("admin2.empty" as never)}</AppText>:null}
    {entries.map(item=><View key={item.name} style={{gap:spacing.xs}}>
      <View style={{flexDirection:isRTL?"row-reverse":"row",justifyContent:"space-between",gap:spacing.sm}}>
        <AppText weight="medium" style={{flex:1}}>{item.name}</AppText>
        <AppText weight="bold" forceLtr>{fmt.format(item.value)}</AppText>
      </View>
      <View style={{height:9,borderRadius:radius.pill,backgroundColor:"#E9EFF7",
        overflow:"hidden",flexDirection:isRTL?"row-reverse":"row"}}>
        <View style={{width:`${item.value/max*100}%` as `${number}%`,backgroundColor:colors.primary,
          borderRadius:radius.pill}}/>
      </View>
    </View>)}
  </Card>;
}
export function AdminAnalyticsSection({data,days,onDays}:{
  data:AdminAnalyticsResponse|null;
  days:AdminAnalyticsDays;onDays:(days:AdminAnalyticsDays)=>void;
}){
  const {t,language,isRTL}=useLocale();
  const [interval,setInterval]=useState<AnalyticsInterval>(days===365?"month":days===90?"week":"day");
  const n=(v:number)=>new Intl.NumberFormat(language==="en"?"en-US":language).format(v);
  if(!data)return <AppText muted>{t("admin2.empty" as never)}</AppText>;
  const m=data.metrics,k=data.totals;
  const stats=[
    {key:"income",value:n(m.recordedVenuePaymentsAfn)+" AFN",sub:n(m.recordedVenuePaymentsCount)+" "+t("admin2.receipts" as never)},
    {key:"gmv",value:n(m.bookingGmvAfn)+" AFN",sub:t("admin2.gmvScope" as never)},
    {key:"newVenues",value:n(m.newVenues),sub:t("admin2.inPeriod" as never)},
    {key:"newTeams",value:n(m.newTeams),sub:t("admin2.inPeriod" as never)},
    {key:"newCompetitions",value:n(m.newCompetitions),sub:t("admin2.inPeriod" as never)},
    {key:"onlineShare",value:n(safeRatio(m.onlineConfirmedBookings,m.confirmedBookings))+"%",
      sub:n(m.onlineConfirmedBookings)+" / "+n(m.confirmedBookings)},
    {key:"trialConversion",value:n(safeRatio(k.trialConvertedVenues,k.trialStartedVenues))+"%",
      sub:n(k.trialConvertedVenues)+" / "+n(k.trialStartedVenues)},
    {key:"paidVenueShare",value:n(safeRatio(k.payingVenues,k.venues))+"%",
      sub:n(k.payingVenues)+" / "+n(k.venues)},
    {key:"activeExtraSlots",value:n(k.activeExtraTeamSlots),sub:t("admin2.currentTotal" as never)},
  ];
  return <View style={{gap:spacing.lg}}>
    <View style={{gap:spacing.sm}}>
      <AppText variant="title" weight="bold">{t("admin2.analyticsTitle" as never)}</AppText>
      <AppText muted>{t("admin2.analyticsSubtitle" as never)}</AppText>
      <AdminPeriodPicker value={days} onChange={next=>{
        setInterval(next===365?"month":next===90?"week":"day");onDays(next);
      }}/>
      <AppText variant="caption" muted>
        {formatCalendarDate(data.period.from,language,{year:"numeric",day:"numeric",month:"short"})}
        {" – "}{formatCalendarDate(data.period.to,language,{year:"numeric",day:"numeric",month:"short"})}
        {" · "}{t("admin2.kabulZone" as never)}
      </AppText>
    </View>
    <View style={{flexDirection:"row",flexWrap:"wrap",gap:spacing.md}}>
      {stats.map(stat=><Card key={stat.key} style={{flexGrow:1,flexBasis:200,minWidth:0,
        padding:spacing.md,gap:spacing.xs}}>
        <AppText variant="caption" muted>{t(("admin2."+stat.key) as never)}</AppText>
        <AppText variant="bodyLarge" weight="bold" forceLtr>{stat.value}</AppText>
        <AppText variant="caption" muted>{stat.sub}</AppText>
      </Card>)}
    </View>
    <View style={{gap:spacing.sm}}>
      <AppText variant="bodyLarge" weight="bold">{t("admin2.trendsTitle" as never)}</AppText>
      <View style={{flexDirection:isRTL?"row-reverse":"row",flexWrap:"wrap",gap:spacing.sm}}>
        {(days===365?longIntervals:fullIntervals).map(mode=><Pressable key={mode} onPress={()=>setInterval(mode)}
          accessibilityRole="button" accessibilityState={{selected:interval===mode}}
          style={{backgroundColor:interval===mode?colors.primary:colors.surface,borderRadius:radius.pill,
            borderWidth:1,borderColor:interval===mode?colors.primary:colors.border,
            minHeight:36,paddingHorizontal:spacing.md,justifyContent:"center"}}>
          <AppText variant="caption" weight="semibold" style={{color:interval===mode?"#FFFFFF":colors.text}}>
            {t(("admin2.interval."+mode) as never)}
          </AppText>
        </Pressable>)}
      </View>
    </View>
    <View style={{flexDirection:"row",flexWrap:"wrap",gap:spacing.md}}>
      <AdminMetricChart data={data} field="recordedVenuePaymentsAfn" interval={interval} currency
        title={t("admin2.income" as never)} color="#0F766E"/>
      <AdminMetricChart data={data} field="bookingGmvAfn" interval={interval} currency
        title={t("admin2.gmv" as never)} color="#6366F1"/>
      <AdminMetricChart data={data} field="newUsers" interval={interval}
        title={t("admin2.newUsers" as never)}/>
      <AdminMetricChart data={data} field="newVenues" interval={interval}
        title={t("admin2.newVenues" as never)}/>
      <AdminMetricChart data={data} field="confirmedBookings" interval={interval}
        title={t("admin2.bookings" as never)} color="#D97706"/>
      <AdminMetricChart data={data} field="newCompetitions" interval={interval}
        title={t("admin2.newCompetitions" as never)} color="#7C3AED"/>
    </View>
    <View style={{flexDirection:"row",flexWrap:"wrap",gap:spacing.md}}>
      <Breakdown title={t("admin2.roleBreakdown" as never)}
        description={t("admin2.roleScope" as never)}
        entries={data.roleGrants.map(v=>({name:t(("admin2.role."+v.role) as never),value:v.count}))}/>
      <Breakdown title={t("admin2.provinceBreakdown" as never)}
        description={t("admin2.provinceScope" as never)}
        entries={data.topProvinces.map(v=>({name:v.province,value:v.venues}))}/>
    </View>
    <Card style={{padding:spacing.lg,gap:spacing.sm,backgroundColor:"#EDF4FF"}}>
      <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
        <Ionicons name="information-circle-outline" size={22} color={colors.primary}/>
        <AppText weight="bold" style={{flex:1}}>{t("admin2.definitionsTitle" as never)}</AppText>
      </View>
      <AppText variant="caption">{t("admin2.revenueScope" as never)}</AppText>
      <AppText variant="caption">{t("admin2.gmvScope" as never)}</AppText>
      <AppText variant="caption">{t("admin2.noActivityData" as never)}</AppText>
      <AppText variant="caption">{t("admin2.noRolePaymentLedger" as never)}</AppText>
    </Card>
  </View>;
}
