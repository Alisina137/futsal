import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { CompetitionListItemDto, CompetitionStatus } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { competitionApi } from "../../../../src/lib/api";
import { formatLocalDateTimeParts } from "../../../../src/lib/date-time";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { Screen } from "../../../../src/components/ui/Screen";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

type Filter="ALL"|CompetitionStatus;
const filters:Filter[]=["ALL","DRAFT","REGISTRATION_OPEN","REGISTRATION_CLOSED","SCHEDULED","IN_PROGRESS","COMPLETED","ARCHIVED","CANCELLED"];

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

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("competition.ownerTitle")}</AppText>
      <AppText muted>{t("competition.control.listSubtitle")}</AppText>
    </View>

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
      return <Pressable
        key={item.id}
        onPress={()=>router.push({pathname:"/owner/competitions/[competitionId]/manage",params:{competitionId:item.id}})}
        style={({pressed})=>pressed?{opacity:.76}:undefined}
      >
        <Card style={styles.competitionCard}>
          <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"flex-start",gap:spacing.sm}}>
            <View style={styles.icon}>
              <Ionicons name="trophy-outline" size={22} color={colors.primary}/>
            </View>
            <View style={{flex:1,gap:4,alignItems:isRTL?"flex-end":"flex-start"}}>
              <AppText variant="bodyLarge" weight="bold">{item.name}</AppText>
              <AppText variant="caption" muted>{t(`competition.format.${item.format}` as never)}</AppText>
            </View>
            <View style={styles.statusBadge}>
              <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
                {t(`competition.status.${item.status}` as never)}
              </AppText>
            </View>
          </View>

          <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
            <View style={{flex:1}}>
              <AppText variant="caption" muted>{t("competition.control.teams")}</AppText>
              <AppText weight="semibold">{item.acceptedTeams}/{item.maxTeams}</AppText>
            </View>
            <View style={{flex:1}}>
              <AppText variant="caption" muted>{t("competition.registrationFee")}</AppText>
              <AppText weight="semibold">{item.registrationFeeAfn} AFN</AppText>
            </View>
          </View>

          {deadline?<AppText variant="caption" muted>{t("competition.registrationDeadline")}: {deadline.date} · {deadline.time}</AppText>:null}
          {starts?<AppText variant="caption" muted>{t("competition.startsAt")}: {starts.date} · {starts.time}</AppText>:null}

          <View style={{flexDirection:isRTL?"row-reverse":"row",justifyContent:"space-between",alignItems:"center"}}>
            <AppText variant="caption" muted>{item.published?t("competition.control.public"):t("competition.control.private")}</AppText>
            <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={20} color={colors.textMuted}/>
          </View>
        </Card>
      </Pressable>;
    })}
  </Screen>;
}

const styles=StyleSheet.create({
  summaryCard:{flex:1,alignItems:"center",gap:spacing.xs,padding:spacing.md},
  filters:{gap:spacing.sm,paddingVertical:spacing.xs},
  filter:{
    paddingHorizontal:spacing.md,
    paddingVertical:spacing.sm,
    borderRadius:radius.pill,
    borderWidth:1,
    borderColor:colors.border,
    backgroundColor:colors.surface,
  },
  filterActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  competitionCard:{gap:spacing.md},
  icon:{width:42,height:42,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  statusBadge:{paddingHorizontal:spacing.sm,paddingVertical:4,borderRadius:radius.pill,backgroundColor:colors.primarySoft},
});
