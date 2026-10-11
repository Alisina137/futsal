import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {AdminAnalyticsDays} from "@leaguekick/contracts";
import {useMemo} from "react";
import {Pressable,ScrollView,View} from "react-native";
import {formatCalendarDate} from "../../lib/timetable-calendar";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Card} from "../ui/Card";
import {groupAnalyticsDaily,type AnalyticsInterval,type AnalyticsMeasure} from "./admin-analytics-display";
import type {AdminAnalyticsResponse} from "@leaguekick/contracts";

const periods:readonly AdminAnalyticsDays[]=[7,30,90,365];
export function AdminPeriodPicker({value,onChange}:{
  value:AdminAnalyticsDays;onChange:(next:AdminAnalyticsDays)=>void;
}){
  const {t,isRTL}=useLocale();
  return <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,flexWrap:"wrap",alignItems:"center"}}>
    <AppText variant="caption" muted>{t("admin2.period" as never)}</AppText>
    {periods.map(days=><Pressable key={days} accessibilityRole="button"
      accessibilityState={{selected:value===days}} onPress={()=>onChange(days)}
      style={{borderWidth:1,borderColor:value===days?colors.primary:colors.border,
        backgroundColor:value===days?colors.primary:colors.surface,
        paddingVertical:8,paddingHorizontal:12,borderRadius:radius.pill,minHeight:36,
        justifyContent:"center"}}>
      <AppText variant="caption" weight="bold" style={{color:value===days?"#FFFFFF":colors.text}}>
        {t(("admin2.days."+days) as never)}
      </AppText>
    </Pressable>)}
  </View>;
}

export function AdminMetricChart({data,field,interval,title,color="#1D4ED8",currency=false}:{
  data:AdminAnalyticsResponse;field:AnalyticsMeasure;interval:AnalyticsInterval;
  title:string;color?:string;currency?:boolean;
}){
  const {t,language}=useLocale();
  const points=useMemo(()=>groupAnalyticsDaily(data.daily,field,interval),
    [data.daily,field,interval]);
  const highest=Math.max(1,...points.map(p=>p.value));
  const formatter=useMemo(()=>new Intl.NumberFormat(language==="en"?"en-US":language,{
    maximumFractionDigits:0,
  }),[language]);
  const formatted=(v:number)=>formatter.format(v)+(currency?" AFN":"");
  return <Card style={{padding:spacing.lg,gap:spacing.md,flexGrow:1,flexBasis:280,flexShrink:1,minWidth:0}}>
    <AppText variant="bodyLarge" weight="bold">{title}</AppText>
    <AppText variant="caption" muted>{t("admin2.graphNote" as never)}</AppText>
    <ScrollView horizontal showsHorizontalScrollIndicator={true}
      accessibilityLabel={title} contentContainerStyle={{gap:8,alignItems:"flex-end",paddingVertical:spacing.md}}>
      {points.map(point=>{
        const height=point.value===0?2:Math.max(6,Math.round(point.value/highest*114));
        const dayLabel=formatCalendarDate(point.date,language,interval==="month"
          ?{month:"short",year:"numeric"}:{month:"short",day:"numeric"});
        return <View key={point.date} accessibilityRole="text"
          accessibilityLabel={dayLabel+": "+formatted(point.value)}
          style={{minWidth:48,alignItems:"center",gap:spacing.xs}}>
          <AppText variant="caption" weight="medium" numberOfLines={1}
            style={{fontSize:10}}>{formatter.format(point.value)}</AppText>
          <View style={{height:120,justifyContent:"flex-end",alignItems:"center",width:46,
            borderBottomWidth:1,borderBottomColor:colors.border}}>
            <View style={{height,width:28,borderTopLeftRadius:6,borderTopRightRadius:6,
              backgroundColor:color}}/>
          </View>
          <AppText variant="caption" muted numberOfLines={1}
            style={{fontSize:10,maxWidth:54,textAlign:"center"}}>{dayLabel}</AppText>
        </View>;
      })}
    </ScrollView>
    {points.length===0?<AppText muted>{t("admin2.empty" as never)}</AppText>:null}
  </Card>;
}
