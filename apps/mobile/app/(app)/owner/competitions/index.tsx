import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { CompetitionListItemDto, CompetitionStatus } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { competitionApi } from "../../../../src/lib/api";
import { formatLocalDateTimeParts } from "../../../../src/lib/date-time";
import { OwnerTopNav } from "../../../../src/components/owner/OwnerTopNav";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../../src/components/ui/Screen";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

type Filter="ALL"|CompetitionStatus;
const filters:Filter[]=["ALL","IN_PROGRESS","REGISTRATION_OPEN","REGISTRATION_CLOSED","COMPLETED","DRAFT","SCHEDULED","ARCHIVED","CANCELLED"];

function compactLabel(value:string){
  return value.replace(/\s*\([^)]*\)\s*$/u,"");
}

export default function OwnerCompetitionListScreen(){
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const [items,setItems]=useState<CompetitionListItemDto[]>([]);
  const [filter,setFilter]=useState<Filter>("ALL");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!session)return;
    setLoading(true);setError(null);
    try{setItems((await competitionApi.ownerList(session.accessToken)).competitions);}
    catch{setError(t("competition.loadError"));}
    finally{setLoading(false);}
  },[session,t]);

  useEffect(()=>{void load();},[load]);

  const visible=useMemo(
    ()=>filter==="ALL"?items:items.filter((item)=>item.status===filter),
    [filter,items],
  );
  const activeCount=items.filter((item)=>["REGISTRATION_OPEN","REGISTRATION_CLOSED","SCHEDULED","IN_PROGRESS"].includes(item.status)).length;

  if(loading)return <Screen showHeader>
    <OwnerTopNav/>
    <DataLoadingState variant="dashboard" minHeight={500}/>
  </Screen>;

  return <Screen showHeader>
    <OwnerTopNav/>

    <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
      <Card style={styles.summaryCard}>
        <Ionicons name="trophy-outline" size={22} color={colors.primary}/>
        <AppText variant="bodyLarge" weight="bold">{items.length}</AppText>
        <AppText variant="caption" muted>{t("competition.control.total")}</AppText>
      </Card>
      <Card style={styles.summaryCard}>
        <Ionicons name="pulse-outline" size={22} color={colors.success}/>
        <AppText variant="bodyLarge" weight="bold">{activeCount}</AppText>
        <AppText variant="caption" muted>{t("competition.control.active")}</AppText>
      </Card>
    </View>

    <Button label={t("competition.create")} onPress={()=>router.push("/owner/competitions/create")}/>

    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroller}
      contentContainerStyle={[styles.filters,{flexDirection:isRTL?"row-reverse":"row"}]}
    >
      {filters.map((value)=><Pressable
        key={value}
        onPress={()=>setFilter(value)}
        style={[
          styles.filter,
          filter===value&&styles.filterActive,
        ]}
      >
        <AppText
          variant="caption"
          weight="semibold"
          style={filter===value?{color:colors.primary}:undefined}
        >
          {value==="ALL"?t("competition.control.all"):t(`competition.status.${value}` as never)}
        </AppText>
      </Pressable>)}
    </ScrollView>

    <Button label={t("common.retry")} onPress={()=>void load()} loading={loading} variant="ghost"/>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    {!loading&&visible.length===0?<Card><AppText>{t("competition.control.noFilteredCompetitions")}</AppText></Card>:null}

    {visible.map((item)=>{
      const starts=item.startsAt?formatLocalDateTimeParts(item.startsAt,language):null;
      const deadline=item.registrationClosesAt?formatLocalDateTimeParts(item.registrationClosesAt,language):null;
      const feeLabel=compactLabel(t("competition.registrationFee"));
      const deadlineLabel=compactLabel(t("competition.registrationDeadline"));
      const startsLabel=compactLabel(t("competition.startsAt"));
      return <Pressable
        key={item.id}
        onPress={()=>router.push({pathname:"/owner/competitions/[competitionId]/manage",params:{competitionId:item.id}})}
        style={({pressed})=>[styles.cardPressable,pressed&&styles.cardPressed]}
      >
        <Card style={styles.competitionCard}>
          <View style={[styles.cardHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <View style={styles.icon}>
              <Ionicons name="trophy-outline" size={23} color={colors.primary}/>
            </View>

            <View style={[styles.titleBlock,{alignItems:isRTL?"flex-end":"flex-start"}]}>
              <AppText variant="bodyLarge" weight="bold" numberOfLines={2} style={{textAlign:isRTL?"right":"left"}}>
                {item.name}
              </AppText>
              <View style={[styles.formatBadge,{alignSelf:isRTL?"flex-end":"flex-start"}]}>
                <AppText variant="caption" weight="semibold" style={{color:colors.textMuted}}>
                  {t(`competition.format.${item.format}` as never)}
                </AppText>
              </View>
            </View>

            <View style={styles.statusBadge}>
              <AppText variant="caption" weight="bold" numberOfLines={1} style={{color:colors.primary}}>
                {t(`competition.status.${item.status}` as never)}
              </AppText>
            </View>
          </View>

          <View style={styles.cardDivider}/>

          <View style={[styles.metricsRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <View style={[styles.metricItem,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <View style={styles.metricIcon}>
                <Ionicons name="people-outline" size={18} color={colors.primary}/>
              </View>
              <View style={[styles.metricText,{alignItems:isRTL?"flex-end":"flex-start"}]}>
                <AppText variant="caption" muted>{t("competition.control.teams")}</AppText>
                <AppText weight="bold" forceLtr>{item.acceptedTeams}/{item.maxTeams}</AppText>
              </View>
            </View>

            <View style={styles.metricSeparator}/>

            <View style={[styles.metricItem,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <View style={styles.metricIcon}>
                <Ionicons name="cash-outline" size={18} color={colors.primary}/>
              </View>
              <View style={[styles.metricText,{alignItems:isRTL?"flex-end":"flex-start"}]}>
                <AppText variant="caption" muted>{feeLabel}</AppText>
                <AppText weight="bold" forceLtr>{item.registrationFeeAfn} AFN</AppText>
              </View>
            </View>
          </View>

          {deadline||starts?<View style={styles.schedulePanel}>
            {deadline?<View style={[styles.scheduleRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Ionicons name="time-outline" size={18} color={colors.textMuted}/>
              <View style={[styles.scheduleText,{alignItems:isRTL?"flex-end":"flex-start"}]}>
                <AppText variant="caption" muted>{deadlineLabel}</AppText>
                <AppText variant="caption" weight="semibold">{deadline.date} · {deadline.time}</AppText>
              </View>
            </View>:null}

            {starts?<View style={[styles.scheduleRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Ionicons name="calendar-outline" size={18} color={colors.textMuted}/>
              <View style={[styles.scheduleText,{alignItems:isRTL?"flex-end":"flex-start"}]}>
                <AppText variant="caption" muted>{startsLabel}</AppText>
                <AppText variant="caption" weight="semibold">{starts.date} · {starts.time}</AppText>
              </View>
            </View>:null}
          </View>:null}

          <View style={[styles.cardFooter,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <View style={[styles.visibilityBadge,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Ionicons name={item.published?"globe-outline":"lock-closed-outline"} size={15} color={item.published?colors.success:colors.textMuted}/>
              <AppText variant="caption" weight="semibold" style={{color:item.published?colors.success:colors.textMuted}}>
                {item.published?t("competition.control.public"):t("competition.control.private")}
              </AppText>
            </View>
            <View style={styles.openIcon}>
              <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={19} color={colors.primary}/>
            </View>
          </View>
        </Card>
      </Pressable>;
    })}
  </Screen>;
}

const styles=StyleSheet.create({
  summaryCard:{flex:1,alignItems:"center",gap:spacing.xs,padding:spacing.md},
  filterScroller:{
    flexGrow:0,
    flexShrink:0,
  },
  filters:{
    gap:spacing.sm,
    paddingVertical:spacing.xs,
    alignItems:"center",
  },
  filter:{
    height:42,
    alignSelf:"flex-start",
    justifyContent:"center",
    paddingHorizontal:spacing.md,
    borderRadius:radius.pill,
    borderWidth:1,
    borderColor:colors.border,
    backgroundColor:colors.surface,
  },
  filterActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  cardPressable:{borderRadius:radius.lg},
  cardPressed:{opacity:.76},
  competitionCard:{
    gap:spacing.md,
    padding:spacing.md,
    borderWidth:1,
    borderColor:colors.border,
  },
  cardHeader:{alignItems:"flex-start",gap:spacing.sm},
  icon:{
    width:44,
    height:44,
    borderRadius:14,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:colors.primarySoft,
  },
  titleBlock:{flex:1,minWidth:0,gap:6},
  formatBadge:{
    paddingHorizontal:spacing.sm,
    paddingVertical:3,
    borderRadius:radius.pill,
    backgroundColor:colors.surfaceMuted,
  },
  statusBadge:{
    maxWidth:118,
    paddingHorizontal:spacing.sm,
    paddingVertical:6,
    borderRadius:radius.pill,
    backgroundColor:colors.primarySoft,
  },
  cardDivider:{height:1,backgroundColor:colors.border},
  metricsRow:{alignItems:"stretch",gap:spacing.sm},
  metricItem:{flex:1,alignItems:"center",gap:spacing.sm,minWidth:0},
  metricIcon:{
    width:34,
    height:34,
    borderRadius:11,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:colors.primarySoft,
  },
  metricText:{flex:1,minWidth:0,gap:2},
  metricSeparator:{width:1,backgroundColor:colors.border},
  schedulePanel:{
    gap:spacing.sm,
    padding:spacing.sm,
    borderRadius:radius.md,
    backgroundColor:colors.surfaceMuted,
  },
  scheduleRow:{alignItems:"center",gap:spacing.sm},
  scheduleText:{flex:1,minWidth:0,gap:2},
  cardFooter:{alignItems:"center",justifyContent:"space-between",gap:spacing.sm},
  visibilityBadge:{alignItems:"center",gap:spacing.xs},
  openIcon:{
    width:34,
    height:34,
    borderRadius:17,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:colors.primarySoft,
  },
});
