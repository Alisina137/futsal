import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { CompetitionListItemDto, CompetitionStatus } from "@leaguekick/contracts";
import { router,useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { AppState,Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { competitionApi,resolveMediaImageUrl } from "../../../../src/lib/api";
import {OwnerCompetitionOperations} from "../../../../src/components/owner/OwnerCompetitionOperations";
import {selectOwnerCompetitions,ownerCompetitionOverviewCounts} from "../../../../src/lib/owner-competition-management";
import { TextField } from "../../../../src/components/ui/TextField";
import { formatLocalDateTimeParts } from "../../../../src/lib/date-time";
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
  const token=session?.accessToken;
  const [items,setItems]=useState<CompetitionListItemDto[]>([]);
  const [loadedToken,setLoadedToken]=useState<string|null>(null);
  const [filter,setFilter]=useState<Filter>("ALL");
  const [format,setFormat]=useState<"ALL"|"LEAGUE"|"KNOCKOUT"|"GROUP_KNOCKOUT">("ALL");
  const [query,setQuery]=useState("");
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const serial=useRef(0);

  const load=useCallback(async()=>{
    const request=++serial.current;
    if(!token){setItems([]);setLoadedToken(null);setLoading(false);return;}
    setLoading(true);setError(null);
    try{
      const response=await competitionApi.ownerList(token);
      if(request!==serial.current)return;
      setItems(response.competitions);
      setLoadedToken(token);
    }catch{
      if(request===serial.current)setError(t("competition.loadError"));
    }finally{
      if(request===serial.current)setLoading(false);
    }
  },[token,t]);

  useFocusEffect(useCallback(()=>{
    setSelectedId(null);
    void load();
    const timer=setInterval(()=>{
      if(AppState.currentState==="active")void load();
    },60_000);
    return()=>{serial.current++;clearInterval(timer);};
  },[load]));

  const safeItems=loadedToken===token?items:[];
  const visible=useMemo(()=>selectOwnerCompetitions(safeItems,{
    group:"ALL",status:filter,format,query,order:"NEXT",
  },Date.now()),[safeItems,filter,format,query]);
  const counts=ownerCompetitionOverviewCounts(safeItems);
  const activeCount=counts.active;
  const renderReady=loadedToken===token;

  if(loading&&!renderReady)return <Screen embedded>
    <DataLoadingState variant="dashboard" minHeight={500}/>
  </Screen>;

  return <Screen embedded refreshing={loading&&renderReady} onRefresh={()=>void load()}>

    <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
      <Card style={styles.summaryCard}>
        <Ionicons name="trophy-outline" size={22} color={colors.primary}/>
        <AppText variant="bodyLarge" weight="bold">{counts.total}</AppText>
        <AppText variant="caption" muted>{t("competition.control.total")}</AppText>
      </Card>
      <Card style={styles.summaryCard}>
        <Ionicons name="pulse-outline" size={22} color={colors.success}/>
        <AppText variant="bodyLarge" weight="bold">{activeCount}</AppText>
        <AppText variant="caption" muted>{t("competition.control.active")}</AppText>
      </Card>
    </View>

    <View testID="owner-phase5-competition-controls" style={styles.controlPanel}>
      <AppText weight="bold" variant="bodyLarge">{t("owner.phase5.title")}</AppText>
      <TextField label={t("owner.phase5.search")} placeholder={t("owner.phase5.searchHint")}
        value={query} onChangeText={setQuery} maxLength={140}/>
      <AppText variant="caption" muted>{t("owner.phase5.format")}</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.filters,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {(["ALL","LEAGUE","GROUP_KNOCKOUT","KNOCKOUT"] as const).map(value=>
          <Pressable key={value} accessibilityRole="button"
            accessibilityState={{selected:format===value}}
            onPress={()=>setFormat(value)}
            style={[styles.filter,format===value&&styles.filterActive]}>
            <AppText variant="caption" weight="semibold"
              style={format===value?{color:colors.primary}:undefined}>
              {value==="ALL"?t("owner.phase5.allFormats"):t(`competition.format.${value}` as never)}
            </AppText>
          </Pressable>)}
      </ScrollView>
    </View>
    <View style={[styles.quickLinks,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Button style={{flex:1}} label={t("owner.phase5.newCompetition")}
        onPress={()=>router.push("/owner/competitions/create")}/>
      <Button style={{flex:1}} variant="secondary"
        label={t("owner.dashboardSubnav.offlineTeams")}
        onPress={()=>router.push("/owner/manual-teams")}/>
    </View>

    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroller}
      contentContainerStyle={[styles.filters,{flexDirection:isRTL?"row-reverse":"row"}]}
    >
      {filters.map((value)=><Pressable
        key={value}
        accessibilityRole="button"
        accessibilityState={{selected:filter===value}}
        onPress={()=>{setFilter(value);setSelectedId(null);}}
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
    {!loading&&!error&&renderReady&&visible.length===0?<Card><AppText>{t("competition.control.noFilteredCompetitions")}</AppText></Card>:null}

    {visible.map((item)=>{
      const starts=item.startsAt?formatLocalDateTimeParts(item.startsAt,language):null;
      const deadline=item.registrationClosesAt?formatLocalDateTimeParts(item.registrationClosesAt,language):null;
      const feeLabel=compactLabel(t("competition.registrationFee"));
      const deadlineLabel=compactLabel(t("competition.registrationDeadline"));
      const startsLabel=compactLabel(t("competition.startsAt"));
      return <View key={item.id} style={{gap:spacing.sm}}><Pressable
        onPress={()=>router.push({pathname:"/owner/competitions/[competitionId]/manage",params:{competitionId:item.id}})}
        style={({pressed})=>[styles.cardPressable,pressed&&styles.cardPressed]}
      >
        <Card style={styles.competitionCard}>
          <View style={[styles.cardHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <View style={styles.icon}>
              {resolveMediaImageUrl(item.logoUrl??item.coverImageUrl??null)
                ?<Image source={{uri:resolveMediaImageUrl(item.logoUrl??item.coverImageUrl??null)!}}
                    style={styles.brandLogo} resizeMode="cover"/>:
                <Ionicons name="trophy-outline" size={23} color={colors.primary}/>}
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
      </Pressable>
      <Button variant="secondary"
        label={selectedId===item.id?t("owner.phase5.hideOperations"):t("owner.phase5.showOperations")}
        onPress={()=>setSelectedId(current=>current===item.id?null:item.id)}/>
      {selectedId===item.id?<OwnerCompetitionOperations
        token={token} competitionId={item.id}/>:null}
      </View>;
    })}
  </Screen>;
}

const styles=StyleSheet.create({
  controlPanel:{gap:spacing.sm},
  quickLinks:{gap:spacing.sm},
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
    minHeight:44,
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
    overflow:"hidden",
  },
  brandLogo:{width:"100%",height:"100%"},
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
