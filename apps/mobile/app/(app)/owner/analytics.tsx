import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type {
  OwnerAnalyticsDailyPoint,
  OwnerAnalyticsHourPoint,
  OwnerAnalyticsResponse,
  OwnerAnalyticsWeekdayPoint,
} from "@leaguekick/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ownerApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

type SectionKey="OVERVIEW"|"REVENUE"|"BOOKINGS"|"CUSTOMERS"|"MARKETING"|"COMPETITIONS";
type RangePreset="7D"|"30D"|"90D"|"CUSTOM";

const sections:SectionKey[]=["OVERVIEW","REVENUE","BOOKINGS","CUSTOMERS","MARKETING","COMPETITIONS"];

function kabulDate(daysAgo = 0) {
  const now = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kabul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function presetDates(preset:Exclude<RangePreset,"CUSTOM">){
  const days=preset==="7D"?7:preset==="30D"?30:90;
  return {from:kabulDate(days-1),to:kabulDate()};
}

function percent(value:number){return `${(value*100).toFixed(1)}%`;}
function hours(value:number){return (value/60).toFixed(value%60===0?0:1);}

export default function OwnerAnalyticsScreen() {
  const { session } = useAuth();
  const { t, isRTL, language } = useLocale();
  const [preset,setPreset]=useState<RangePreset>("30D");
  const [from, setFrom] = useState(kabulDate(29));
  const [to, setTo] = useState(kabulDate());
  const [section,setSection]=useState<SectionKey>("OVERVIEW");
  const [data, setData] = useState<OwnerAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const number=useMemo(()=>new Intl.NumberFormat(language),[language]);
  const afn=(value:number)=>`${number.format(value)} AFN`;

  const load = useCallback(async (nextFrom=from,nextTo=to) => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      setData(await ownerApi.analytics(session.accessToken, nextFrom, nextTo));
    } catch {
      setError(t("phase7.analytics.loadError"));
    } finally {
      setLoading(false);
    }
  }, [from, session, t, to]);

  useEffect(() => { void load(); }, []);

  function applyPreset(value:Exclude<RangePreset,"CUSTOM">){
    const next=presetDates(value);
    setPreset(value);
    setFrom(next.from);
    setTo(next.to);
    void load(next.from,next.to);
  }

  const insights=useMemo(()=>{
    if(!data)return [];
    const result:Array<{icon:keyof typeof Ionicons.glyphMap;title:string;body:string;tone:"good"|"warn"|"info"}>=[];
    if(data.occupancyRate>=.7){
      result.push({icon:"trending-up-outline",title:t("phase7.analytics.insight.strongOccupancy"),body:t("phase7.analytics.insight.strongOccupancyBody",{value:percent(data.occupancyRate)}),tone:"good"});
    }else if(data.scheduledMinutes>0&&data.occupancyRate<.4){
      result.push({icon:"calendar-outline",title:t("phase7.analytics.insight.lowOccupancy"),body:t("phase7.analytics.insight.lowOccupancyBody",{value:percent(data.occupancyRate)}),tone:"warn"});
    }
    if(data.cancellationRate>=.15){
      result.push({icon:"close-circle-outline",title:t("phase7.analytics.insight.cancellations"),body:t("phase7.analytics.insight.cancellationsBody",{value:percent(data.cancellationRate),amount:afn(data.cancelledBookingValueAfn)}),tone:"warn"});
    }
    if(data.repeatCustomerRate>=.3){
      result.push({icon:"people-outline",title:t("phase7.analytics.insight.loyalCustomers"),body:t("phase7.analytics.insight.loyalCustomersBody",{value:percent(data.repeatCustomerRate)}),tone:"good"});
    }
    if(data.promotionCount>0&&data.promotionBookingCount===0){
      result.push({icon:"pricetag-outline",title:t("phase7.analytics.insight.promotion"),body:t("phase7.analytics.insight.promotionBody"),tone:"warn"});
    }
    if(data.peakDayOfWeek!==null||data.peakHour!==null){
      const day=data.peakDayOfWeek===null?"—":weekdayName(data.peakDayOfWeek,language);
      const hour=data.peakHour===null?"—":`${String(data.peakHour).padStart(2,"0")}:00`;
      result.push({icon:"time-outline",title:t("phase7.analytics.insight.peak"),body:t("phase7.analytics.insight.peakBody",{day,hour}),tone:"info"});
    }
    return result.slice(0,4);
  },[data,language,t]);

  if(loading&&!data)return <Screen embedded><DataLoadingState variant="dashboard" minHeight={600}/></Screen>;

  return <Screen embedded>
    <View style={[styles.hero,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.heroIcon}><Ionicons name="analytics-outline" size={28} color="#FFFFFF"/></View>
      <View style={{flex:1,gap:3,alignItems:isRTL?"flex-end":"flex-start"}}>
        <AppText variant="title" weight="bold" style={styles.heroTitle}>{t("phase7.analytics.title")}</AppText>
        <AppText style={styles.heroBody}>{t("phase7.analytics.subtitleFull")}</AppText>
      </View>
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
      {(["7D","30D","90D"] as const).map((value)=><Pressable
        key={value}
        onPress={()=>applyPreset(value)}
        style={[styles.presetChip,preset===value&&styles.presetChipActive]}
      >
        <AppText variant="caption" weight="bold" style={preset===value?styles.presetTextActive:undefined}>
          {t(`phase7.analytics.range.${value}` as never)}
        </AppText>
      </Pressable>)}
      <Pressable onPress={()=>setPreset("CUSTOM")} style={[styles.presetChip,preset==="CUSTOM"&&styles.presetChipActive]}>
        <AppText variant="caption" weight="bold" style={preset==="CUSTOM"?styles.presetTextActive:undefined}>{t("phase7.analytics.range.CUSTOM")}</AppText>
      </Pressable>
    </ScrollView>

    {preset==="CUSTOM"?<Card style={styles.rangeCard}>
      <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: spacing.sm }}>
        <TextField label={t("phase7.analytics.from")} value={from} onChangeText={setFrom} forceLtr containerStyle={{ flex: 1 }} />
        <TextField label={t("phase7.analytics.to")} value={to} onChangeText={setTo} forceLtr containerStyle={{ flex: 1 }} />
      </View>
      <Button label={t("phase7.analytics.applyRange")} onPress={() => void load()} loading={loading} />
    </Card>:null}

    {error?<Card style={styles.errorCard}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} onPress={()=>void load()} variant="secondary"/>
    </Card>:null}

    {data?<View style={styles.periodLine}>
      <AppText variant="caption" muted forceLtr>{data.from} → {data.to}</AppText>
      {loading?<AppText variant="caption" style={{color:colors.primary}}>{t("phase7.analytics.refreshing")}</AppText>:null}
    </View>:null}

    {data?<>
      <View style={styles.metricGrid}>
        <MetricCard icon="cash-outline" title={t("phase7.analytics.revenue")} value={afn(data.grossBookingValueAfn)} trend={data.comparison.revenueChangeRate}/>
        <MetricCard icon="calendar-outline" title={t("phase7.analytics.bookings")} value={number.format(data.bookingCount)} trend={data.comparison.bookingChangeRate}/>
        <MetricCard icon="speedometer-outline" title={t("phase7.analytics.occupancy")} value={percent(data.occupancyRate)} trend={data.comparison.occupancyChangeRate}/>
        <MetricCard icon="receipt-outline" title={t("phase7.analytics.avgBooking")} value={afn(data.averageBookingValueAfn)}/>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionTabs}>
        {sections.map((value)=><Pressable key={value} onPress={()=>setSection(value)} style={[styles.sectionTab,section===value&&styles.sectionTabActive]}>
          <AppText variant="caption" weight="bold" style={section===value?styles.sectionTabTextActive:undefined}>
            {t(`phase7.analytics.section.${value}` as never)}
          </AppText>
        </Pressable>)}
      </ScrollView>

      {section==="OVERVIEW"?<Overview
        data={data}
        insights={insights}
        t={t}
        language={language}
        afn={afn}
        number={number}
        isRTL={isRTL}
      />:null}

      {section==="REVENUE"?<RevenueSection data={data} t={t} afn={afn} language={language}/>:null}
      {section==="BOOKINGS"?<BookingsSection data={data} t={t} number={number} language={language} isRTL={isRTL}/>:null}
      {section==="CUSTOMERS"?<CustomersSection data={data} t={t} number={number}/>:null}
      {section==="MARKETING"?<MarketingSection data={data} t={t} number={number} afn={afn}/>:null}
      {section==="COMPETITIONS"?<CompetitionsSection data={data} t={t} number={number} afn={afn}/>:null}
    </>:null}
  </Screen>;
}

function Overview({
  data,insights,t,language,afn,number,isRTL,
}:{
  data:OwnerAnalyticsResponse;
  insights:Array<{icon:keyof typeof Ionicons.glyphMap;title:string;body:string;tone:"good"|"warn"|"info"}>;
  t:(key:any,params?:Record<string,string|number>)=>string;
  language:string;
  afn:(value:number)=>string;
  number:Intl.NumberFormat;
  isRTL:boolean;
}){
  return <View style={styles.sectionStack}>
    <SectionHeading icon="sparkles-outline" title={t("phase7.analytics.insights")} body={t("phase7.analytics.insightsBody")}/>
    {insights.length?<View style={styles.insightGrid}>{insights.map((item,index)=><InsightCard key={index} {...item}/>)}</View>
      :<Card><AppText muted>{t("phase7.analytics.noInsights")}</AppText></Card>}

    <SectionHeading icon="pulse-outline" title={t("phase7.analytics.businessHealth")} body={t("phase7.analytics.businessHealthBody")}/>
    <Card style={styles.summaryCard}>
      <ProgressRow label={t("phase7.analytics.confirmedRate")} value={data.confirmedRate} text={percent(data.confirmedRate)}/>
      <ProgressRow label={t("phase7.analytics.onlineShare")} value={data.onlineBookingShare} text={percent(data.onlineBookingShare)}/>
      <ProgressRow label={t("phase7.analytics.repeatRate")} value={data.repeatCustomerRate} text={percent(data.repeatCustomerRate)}/>
      <ProgressRow label={t("phase7.analytics.productiveUse")} value={data.productiveUtilizationRate} text={percent(data.productiveUtilizationRate)}/>
    </Card>

    <SectionHeading icon="calendar-number-outline" title={t("phase7.analytics.capacity")} body={t("phase7.analytics.capacityBody")}/>
    <View style={styles.metricGrid}>
      <SmallMetric label={t("phase7.analytics.scheduledHours")} value={number.format(Number(hours(data.scheduledMinutes)))}/>
      <SmallMetric label={t("phase7.analytics.bookedHours")} value={number.format(Number(hours(data.bookedMinutes)))}/>
      <SmallMetric label={t("phase7.analytics.competitionHours")} value={number.format(Number(hours(data.competitionMinutes)))}/>
      <SmallMetric label={t("phase7.analytics.openHours")} value={number.format(Number(hours(data.remainingOpenMinutes)))}/>
    </View>

    <SectionHeading icon="bar-chart-outline" title={t("phase7.analytics.revenueTrend")} body={t("phase7.analytics.revenueTrendBody")}/>
    <Card style={styles.chartCard}><DailyBars points={data.daily} value={(point)=>point.revenueAfn} format={afn} language={language}/></Card>

    {data.bestRevenueDate?<Card style={styles.callout}>
      <Ionicons name="trophy-outline" size={22} color={colors.primary}/>
      <View style={{flex:1}}>
        <AppText weight="bold">{t("phase7.analytics.bestRevenueDay")}</AppText>
        <AppText variant="caption" muted forceLtr>{data.bestRevenueDate}</AppText>
      </View>
    </Card>:null}

    <Card style={styles.sourceCard}>
      <View style={[styles.sourceRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <SourcePill icon="globe-outline" label={t("phase7.analytics.online")} value={number.format(data.onlineBookingCount)}/>
        <SourcePill icon="person-outline" label={t("phase7.analytics.manual")} value={number.format(data.manualBookingCount)}/>
      </View>
    </Card>
  </View>;
}

function RevenueSection({data,t,afn,language}:{
  data:OwnerAnalyticsResponse;t:(key:any,params?:Record<string,string|number>)=>string;afn:(value:number)=>string;language:string;
}){
  return <View style={styles.sectionStack}>
    <SectionHeading icon="cash-outline" title={t("phase7.analytics.revenuePerformance")} body={t("phase7.analytics.revenuePerformanceBody")}/>
    <View style={styles.metricGrid}>
      <SmallMetric label={t("phase7.analytics.totalRevenue")} value={afn(data.grossBookingValueAfn)}/>
      <SmallMetric label={t("phase7.analytics.avgBooking")} value={afn(data.averageBookingValueAfn)}/>
      <SmallMetric label={t("phase7.analytics.revenuePerHour")} value={afn(data.revenuePerBookedHourAfn)}/>
      <SmallMetric label={t("phase7.analytics.cancelledValue")} value={afn(data.cancelledBookingValueAfn)}/>
    </View>
    <ComparisonCard data={data} t={t}/>
    <Card style={styles.chartCard}><DailyBars points={data.daily} value={(point)=>point.revenueAfn} format={afn} language={language}/></Card>
    <SectionHeading icon="pricetag-outline" title={t("phase7.analytics.discountImpact")} body={t("phase7.analytics.discountImpactBody")}/>
    <View style={styles.metricGrid}>
      <SmallMetric label={t("phase7.analytics.promotionRevenue")} value={afn(data.promotionRevenueAfn)}/>
      <SmallMetric label={t("phase7.analytics.discountGranted")} value={afn(data.discountGrantedAfn)}/>
      <SmallMetric label={t("phase7.analytics.promotionBookings")} value={String(data.promotionBookingCount)}/>
      <SmallMetric label={t("phase7.analytics.avgDiscount")} value={`${data.averageDiscountPercent.toFixed(1)}%`}/>
    </View>
  </View>;
}

function BookingsSection({data,t,number,language,isRTL}:{
  data:OwnerAnalyticsResponse;t:(key:any,params?:Record<string,string|number>)=>string;number:Intl.NumberFormat;language:string;isRTL:boolean;
}){
  const topHours=[...data.hours].sort((a,b)=>b.bookingCount-a.bookingCount||b.revenueAfn-a.revenueAfn).slice(0,6);
  return <View style={styles.sectionStack}>
    <SectionHeading icon="calendar-outline" title={t("phase7.analytics.bookingPerformance")} body={t("phase7.analytics.bookingPerformanceBody")}/>
    <View style={styles.metricGrid}>
      <SmallMetric label={t("phase7.analytics.confirmed")} value={number.format(data.confirmedBookingCount)}/>
      <SmallMetric label={t("phase7.analytics.cancelled")} value={number.format(data.cancelledBookingCount)}/>
      <SmallMetric label={t("phase7.analytics.cancellationRate")} value={percent(data.cancellationRate)}/>
      <SmallMetric label={t("phase7.analytics.onlineShare")} value={percent(data.onlineBookingShare)}/>
    </View>
    <Card style={styles.summaryCard}>
      <ProgressRow label={t("phase7.analytics.bookedCapacity")} value={data.occupancyRate} text={percent(data.occupancyRate)}/>
      <ProgressRow label={t("phase7.analytics.competitionUse")} value={data.scheduledMinutes?Math.min(1,data.competitionMinutes/data.scheduledMinutes):0} text={percent(data.scheduledMinutes?Math.min(1,data.competitionMinutes/data.scheduledMinutes):0)}/>
      <ProgressRow label={t("phase7.analytics.blockedCapacity")} value={data.blockedRate} text={percent(data.blockedRate)}/>
      <ProgressRow label={t("phase7.analytics.remainingCapacity")} value={data.scheduledMinutes?Math.min(1,data.remainingOpenMinutes/data.scheduledMinutes):0} text={percent(data.scheduledMinutes?Math.min(1,data.remainingOpenMinutes/data.scheduledMinutes):0)}/>
    </Card>

    <SectionHeading icon="calendar-number-outline" title={t("phase7.analytics.weekdayPerformance")} body={t("phase7.analytics.weekdayPerformanceBody")}/>
    <Card style={styles.chartCard}><WeekdayBars points={data.weekdays} language={language}/></Card>

    <SectionHeading icon="time-outline" title={t("phase7.analytics.peakHours")} body={t("phase7.analytics.peakHoursBody")}/>
    <Card style={styles.chartCard}>{topHours.map((point)=><HourRow key={point.hour} point={point} max={Math.max(1,...topHours.map((item)=>item.bookingCount))} number={number}/>)}</Card>

    <SectionHeading icon="close-circle-outline" title={t("phase7.analytics.cancellationReasons")} body={t("phase7.analytics.cancellationReasonsBody")}/>
    {data.cancellationReasons.length?<Card style={styles.reasonCard}>{data.cancellationReasons.map((item)=><View key={item.reason} style={[styles.reasonRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <AppText style={{flex:1}}>{item.reason==="UNSPECIFIED"?t("phase7.analytics.unspecified"):item.reason}</AppText>
      <AppText weight="bold">{number.format(item.count)}</AppText>
    </View>)}</Card>:<Card><AppText muted>{t("phase7.analytics.noCancellations")}</AppText></Card>}
  </View>;
}

function CustomersSection({data,t,number}:{
  data:OwnerAnalyticsResponse;t:(key:any,params?:Record<string,string|number>)=>string;number:Intl.NumberFormat;
}){
  return <View style={styles.sectionStack}>
    <SectionHeading icon="people-outline" title={t("phase7.analytics.customerHealth")} body={t("phase7.analytics.customerHealthBody")}/>
    <View style={styles.metricGrid}>
      <SmallMetric label={t("phase7.analytics.uniqueCustomers")} value={number.format(data.uniqueCustomerCount)}/>
      <SmallMetric label={t("phase7.analytics.repeatCustomers")} value={number.format(data.repeatCustomerCount)}/>
      <SmallMetric label={t("phase7.analytics.repeatRate")} value={percent(data.repeatCustomerRate)}/>
      <SmallMetric label={t("phase7.analytics.bookingsPerCustomer")} value={data.averageBookingsPerCustomer.toFixed(1)}/>
    </View>
    <Card style={styles.summaryCard}>
      <ProgressRow label={t("phase7.analytics.customerRetention")} value={data.repeatCustomerRate} text={percent(data.repeatCustomerRate)}/>
      <ProgressRow label={t("phase7.analytics.digitalAdoption")} value={data.onlineBookingShare} text={percent(data.onlineBookingShare)}/>
    </Card>
    <Card style={styles.privacyCard}>
      <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary}/>
      <View style={{flex:1,gap:2}}>
        <AppText weight="bold">{t("phase7.analytics.customerPrivacy")}</AppText>
        <AppText variant="caption" muted>{t("phase7.analytics.customerPrivacyBody")}</AppText>
      </View>
    </Card>
  </View>;
}

function MarketingSection({data,t,number,afn}:{
  data:OwnerAnalyticsResponse;t:(key:any,params?:Record<string,string|number>)=>string;number:Intl.NumberFormat;afn:(value:number)=>string;
}){
  return <View style={styles.sectionStack}>
    <SectionHeading icon="megaphone-outline" title={t("phase7.analytics.audience")} body={t("phase7.analytics.audienceBody")}/>
    <View style={styles.metricGrid}>
      <SmallMetric label={t("phase7.analytics.followers")} value={number.format(data.followerCount)}/>
      <SmallMetric label={t("phase7.analytics.newFollowers")} value={number.format(data.newFollowerCount)}/>
      <SmallMetric label={t("phase7.analytics.posts")} value={number.format(data.postCount)}/>
      <SmallMetric label={t("phase7.analytics.engagementPerPost")} value={data.engagementPerPost.toFixed(1)}/>
      <SmallMetric label={t("phase7.analytics.likes")} value={number.format(data.postLikeCount)}/>
      <SmallMetric label={t("phase7.analytics.comments")} value={number.format(data.postCommentCount)}/>
    </View>

    <SectionHeading icon="pricetag-outline" title={t("phase7.analytics.promotions")} body={t("phase7.analytics.promotionsBody")}/>
    <View style={styles.metricGrid}>
      <SmallMetric label={t("phase7.analytics.promotionsRun")} value={number.format(data.promotionCount)}/>
      <SmallMetric label={t("phase7.analytics.promotionBookings")} value={number.format(data.promotionBookingCount)}/>
      <SmallMetric label={t("phase7.analytics.promotionRevenue")} value={afn(data.promotionRevenueAfn)}/>
      <SmallMetric label={t("phase7.analytics.discountGranted")} value={afn(data.discountGrantedAfn)}/>
    </View>
    <Card style={styles.summaryCard}>
      <ProgressRow
        label={t("phase7.analytics.promotionConversion")}
        value={data.promotionCount?Math.min(1,data.promotionBookingCount/data.promotionCount):0}
        text={data.promotionCount?`${data.promotionBookingCount}/${data.promotionCount}`:"—"}
      />
    </Card>
  </View>;
}

function CompetitionsSection({data,t,number,afn}:{
  data:OwnerAnalyticsResponse;t:(key:any,params?:Record<string,string|number>)=>string;number:Intl.NumberFormat;afn:(value:number)=>string;
}){
  return <View style={styles.sectionStack}>
    <SectionHeading icon="trophy-outline" title={t("phase7.analytics.competitionBusiness")} body={t("phase7.analytics.competitionBusinessBody")}/>
    <View style={styles.metricGrid}>
      <SmallMetric label={t("phase7.analytics.competitions")} value={number.format(data.competitionCount)}/>
      <SmallMetric label={t("phase7.analytics.activeCompetitions")} value={number.format(data.activeCompetitionCount)}/>
      <SmallMetric label={t("phase7.analytics.completedCompetitions")} value={number.format(data.completedCompetitionCount)}/>
      <SmallMetric label={t("phase7.analytics.registeredTeams")} value={number.format(data.competitionTeamCount)}/>
      <SmallMetric label={t("phase7.analytics.matches")} value={number.format(data.competitionMatchCount)}/>
      <SmallMetric label={t("phase7.analytics.feesCollected")} value={afn(data.competitionFeesCollectedAfn)}/>
    </View>
    <Card style={styles.callout}>
      <Ionicons name="time-outline" size={22} color={colors.primary}/>
      <View style={{flex:1}}>
        <AppText weight="bold">{t("phase7.analytics.courtTimeUsed")}</AppText>
        <AppText variant="caption" muted>{t("phase7.analytics.courtTimeUsedBody",{hours:hours(data.competitionMinutes)})}</AppText>
      </View>
    </Card>
  </View>;
}

function MetricCard({icon,title,value,trend}:{icon:keyof typeof Ionicons.glyphMap;title:string;value:string;trend?:number|null}){
  return <Card style={styles.metricCard}>
    <View style={styles.metricIcon}><Ionicons name={icon} size={20} color={colors.primary}/></View>
    <AppText variant="caption" muted>{title}</AppText>
    <AppText variant="bodyLarge" weight="bold" numberOfLines={1}>{value}</AppText>
    {trend!==undefined?<Trend value={trend}/>:null}
  </Card>;
}

function Trend({value}:{value:number|null}){
  if(value===null)return <AppText variant="caption" muted>—</AppText>;
  const good=value>=0;
  return <View style={styles.trendRow}>
    <Ionicons name={good?"trending-up-outline":"trending-down-outline"} size={15} color={good?colors.success:colors.danger}/>
    <AppText variant="caption" weight="semibold" style={{color:good?colors.success:colors.danger}}>
      {value>0?"+":""}{(value*100).toFixed(1)}%
    </AppText>
  </View>;
}

function SmallMetric({label,value}:{label:string;value:string}){
  return <Card style={styles.smallMetric}>
    <AppText variant="bodyLarge" weight="bold">{value}</AppText>
    <AppText variant="caption" muted style={{textAlign:"center"}}>{label}</AppText>
  </Card>;
}

function SectionHeading({icon,title,body}:{icon:keyof typeof Ionicons.glyphMap;title:string;body:string}){
  return <View style={styles.sectionHeading}>
    <View style={styles.sectionHeadingIcon}><Ionicons name={icon} size={20} color={colors.primary}/></View>
    <View style={{flex:1,gap:2}}>
      <AppText variant="bodyLarge" weight="bold">{title}</AppText>
      <AppText variant="caption" muted>{body}</AppText>
    </View>
  </View>;
}

function InsightCard({icon,title,body,tone}:{icon:keyof typeof Ionicons.glyphMap;title:string;body:string;tone:"good"|"warn"|"info"}){
  const toneStyle=tone==="good"?styles.insightGood:tone==="warn"?styles.insightWarn:styles.insightInfo;
  return <View style={[styles.insightCard,toneStyle]}>
    <Ionicons name={icon} size={22} color={tone==="good"?colors.success:tone==="warn"?colors.warning:colors.primary}/>
    <View style={{flex:1,gap:2}}>
      <AppText weight="bold">{title}</AppText>
      <AppText variant="caption" muted>{body}</AppText>
    </View>
  </View>;
}

function ProgressRow({label,value,text}:{label:string;value:number;text:string}){
  const safe=Math.max(0,Math.min(1,value));
  return <View style={styles.progressGroup}>
    <View style={styles.progressHeader}>
      <AppText variant="caption" weight="semibold">{label}</AppText>
      <AppText variant="caption" weight="bold">{text}</AppText>
    </View>
    <View style={styles.track}><View style={[styles.fill,{width:`${safe*100}%`}]} /></View>
  </View>;
}

function ComparisonCard({data,t}:{data:OwnerAnalyticsResponse;t:(key:any,params?:Record<string,string|number>)=>string}){
  return <Card style={styles.comparisonCard}>
    <AppText weight="bold">{t("phase7.analytics.comparePrevious")}</AppText>
    <AppText variant="caption" muted forceLtr>{data.comparison.previousFrom} → {data.comparison.previousTo}</AppText>
    <View style={styles.comparisonGrid}>
      <ComparisonItem label={t("phase7.analytics.revenue")} value={data.comparison.revenueChangeRate}/>
      <ComparisonItem label={t("phase7.analytics.bookings")} value={data.comparison.bookingChangeRate}/>
      <ComparisonItem label={t("phase7.analytics.occupancy")} value={data.comparison.occupancyChangeRate}/>
      <ComparisonItem label={t("phase7.analytics.cancellationRate")} value={data.comparison.cancellationRateDelta} delta/>
    </View>
  </Card>;
}

function ComparisonItem({label,value,delta=false}:{label:string;value:number|null;delta?:boolean}){
  const display=value===null?"—":`${value>0?"+":""}${(value*100).toFixed(1)}${delta?" pp":"%"}`;
  return <View style={styles.comparisonItem}>
    <AppText variant="caption" muted>{label}</AppText>
    <AppText weight="bold">{display}</AppText>
  </View>;
}

function DailyBars({points,value,format,language}:{
  points:OwnerAnalyticsDailyPoint[];value:(point:OwnerAnalyticsDailyPoint)=>number;format:(value:number)=>string;language:string;
}){
  const step=Math.max(1,Math.ceil(points.length/12));
  const visible=points.filter((_,index)=>index%step===0||index===points.length-1);
  const max=Math.max(1,...visible.map(value));
  return <View style={styles.barList}>{visible.map((point)=><View key={point.date} style={styles.barRow}>
    <AppText variant="caption" muted style={styles.barLabel}>{shortDate(point.date,language)}</AppText>
    <View style={styles.barTrack}><View style={[styles.barFill,{width:`${(value(point)/max)*100}%`}]} /></View>
    <AppText variant="caption" weight="semibold" style={styles.barValue}>{format(value(point))}</AppText>
  </View>)}</View>;
}

function WeekdayBars({points,language}:{points:OwnerAnalyticsWeekdayPoint[];language:string}){
  const max=Math.max(1,...points.map((item)=>item.occupancyRate));
  return <View style={styles.barList}>{points.map((point)=><View key={point.dayOfWeek} style={styles.barRow}>
    <AppText variant="caption" muted style={styles.barLabel}>{weekdayName(point.dayOfWeek,language)}</AppText>
    <View style={styles.barTrack}><View style={[styles.barFill,{width:`${(point.occupancyRate/max)*100}%`}]} /></View>
    <AppText variant="caption" weight="semibold" style={styles.barValue}>{percent(point.occupancyRate)}</AppText>
  </View>)}</View>;
}

function HourRow({point,max,number}:{point:OwnerAnalyticsHourPoint;max:number;number:Intl.NumberFormat}){
  return <View style={styles.barRow}>
    <AppText variant="caption" muted style={styles.barLabel} forceLtr>{String(point.hour).padStart(2,"0")}:00</AppText>
    <View style={styles.barTrack}><View style={[styles.barFill,{width:`${(point.bookingCount/max)*100}%`}]} /></View>
    <AppText variant="caption" weight="semibold" style={styles.barValue}>{number.format(point.bookingCount)}</AppText>
  </View>;
}

function SourcePill({icon,label,value}:{icon:keyof typeof Ionicons.glyphMap;label:string;value:string}){
  return <View style={styles.sourcePill}>
    <Ionicons name={icon} size={20} color={colors.primary}/>
    <AppText variant="caption" muted>{label}</AppText>
    <AppText weight="bold">{value}</AppText>
  </View>;
}

function shortDate(date:string,language:string){
  const [year,month,day]=date.split("-").map(Number);
  return new Intl.DateTimeFormat(language,{month:"short",day:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(year!,month!-1,day!)));
}

function weekdayName(dayOfWeek:number,language:string){
  return new Intl.DateTimeFormat(language,{weekday:"short",timeZone:"UTC"}).format(new Date(Date.UTC(2026,7,2+dayOfWeek)));
}

const styles=StyleSheet.create({
  hero:{alignItems:"center",gap:spacing.md,padding:spacing.md,borderRadius:radius.lg,backgroundColor:"#0F3D8C"},
  heroIcon:{width:52,height:52,borderRadius:16,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.14)"},
  heroTitle:{color:"#FFFFFF"},
  heroBody:{color:"#DCE8FF"},
  presetRow:{gap:spacing.xs,paddingVertical:2},
  presetChip:{minHeight:40,paddingHorizontal:spacing.md,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,alignItems:"center",justifyContent:"center"},
  presetChipActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  presetTextActive:{color:colors.primary},
  rangeCard:{gap:spacing.md},
  errorCard:{borderColor:colors.danger,gap:spacing.sm},
  periodLine:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:spacing.sm},
  metricGrid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  metricCard:{minWidth:"47%",flexGrow:1,gap:spacing.xs,padding:spacing.md},
  metricIcon:{width:36,height:36,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  trendRow:{flexDirection:"row",alignItems:"center",gap:4},
  sectionTabs:{gap:spacing.xs,paddingVertical:2},
  sectionTab:{minHeight:42,paddingHorizontal:spacing.md,borderRadius:radius.md,alignItems:"center",justifyContent:"center",backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  sectionTabActive:{backgroundColor:colors.primary,borderColor:colors.primary},
  sectionTabTextActive:{color:"#FFFFFF"},
  sectionStack:{gap:spacing.md},
  sectionHeading:{flexDirection:"row",alignItems:"center",gap:spacing.sm,marginTop:spacing.xs},
  sectionHeadingIcon:{width:40,height:40,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  insightGrid:{gap:spacing.sm},
  insightCard:{flexDirection:"row",alignItems:"flex-start",gap:spacing.sm,padding:spacing.md,borderRadius:radius.md,borderWidth:1},
  insightGood:{backgroundColor:"#F0FDF4",borderColor:"#BBF7D0"},
  insightWarn:{backgroundColor:"#FFFBEB",borderColor:"#FDE68A"},
  insightInfo:{backgroundColor:"#EFF6FF",borderColor:"#BFDBFE"},
  summaryCard:{gap:spacing.md},
  progressGroup:{gap:spacing.xs},
  progressHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:spacing.sm},
  track:{height:8,borderRadius:4,backgroundColor:colors.surfaceMuted,overflow:"hidden"},
  fill:{height:"100%",borderRadius:4,backgroundColor:colors.primary},
  smallMetric:{minWidth:"47%",flexGrow:1,alignItems:"center",gap:4,padding:spacing.md},
  chartCard:{gap:spacing.sm},
  barList:{gap:spacing.sm},
  barRow:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  barLabel:{width:58},
  barTrack:{flex:1,height:10,borderRadius:5,backgroundColor:colors.surfaceMuted,overflow:"hidden"},
  barFill:{height:"100%",borderRadius:5,backgroundColor:colors.primary},
  barValue:{minWidth:72,textAlign:"right"},
  callout:{flexDirection:"row",alignItems:"center",gap:spacing.sm,backgroundColor:"#F8FBFF",borderColor:"#BFDBFE"},
  sourceCard:{padding:spacing.sm},
  sourceRow:{gap:spacing.sm},
  sourcePill:{flex:1,alignItems:"center",gap:4,padding:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
  comparisonCard:{gap:spacing.sm},
  comparisonGrid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.xs},
  comparisonItem:{minWidth:"47%",flexGrow:1,padding:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surfaceMuted,gap:2},
  reasonCard:{gap:0,paddingVertical:0},
  reasonRow:{minHeight:46,alignItems:"center",gap:spacing.sm,borderBottomWidth:1,borderBottomColor:colors.border,paddingVertical:spacing.sm},
  privacyCard:{flexDirection:"row",alignItems:"flex-start",gap:spacing.sm,backgroundColor:"#F8FBFF",borderColor:"#BFDBFE"},
});
