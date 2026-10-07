import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { VenueTimetableConflict, VenueTimetableDto, VenueTimetableListResponse } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { ownerApi } from "../../../../src/lib/api";
import { formatCalendarDate } from "../../../../src/lib/timetable-calendar";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../../src/components/ui/Screen";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

export default function WeeklyTimetableScreen(){
  const {session}=useAuth();
  const {t,language}=useLocale();
  const token=session?.accessToken;
  const [data,setData]=useState<VenueTimetableListResponse|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [conflicts,setConflicts]=useState<VenueTimetableConflict[]>([]);

  const load=useCallback(async()=>{
    if(!token)return;
    setLoading(true);setError(null);
    try{setData(await ownerApi.timetables(token));}
    catch{setError(t("schedule.loadTimetableError"));}
    finally{setLoading(false);}
  },[t,token]);

  useEffect(()=>{void load();},[load]);

  async function duplicate(item:VenueTimetableDto){
    if(!token)return;
    setBusy(`duplicate-${item.id}`);setError(null);
    try{
      const result=await ownerApi.duplicateTimetable(token,item.id);
      router.push({pathname:"/owner/timetable/edit",params:{timetableId:result.timetable.id}});
    }catch{setError(t("schedule.saveTimetableError"));}
    finally{setBusy(null);}
  }

  async function publish(item:VenueTimetableDto){
    if(!token)return;
    setBusy(`publish-${item.id}`);setError(null);setConflicts([]);
    try{
      const result=await ownerApi.publishTimetable(token,item.id);
      if(result.conflicts.length)setConflicts(result.conflicts);
      else await load();
    }catch{setError(t("schedule.publishTimetableError"));}
    finally{setBusy(null);}
  }

  function deleteDraft(item:VenueTimetableDto){
    if(!token)return;
    Alert.alert(t("schedule.deleteDraftTitle"),t("schedule.deleteDraftBody"),[
      {text:t("common.cancel"),style:"cancel"},
      {text:t("schedule.deleteDraft"),style:"destructive",onPress:()=>void(async()=>{
        setBusy(`delete-${item.id}`);
        try{await ownerApi.deleteTimetable(token,item.id);await load();}
        catch{setError(t("schedule.deleteTimetableError"));}
        finally{setBusy(null);}
      })()},
    ]);
  }

  async function archive(item:VenueTimetableDto){
    if(!token)return;
    setBusy(`archive-${item.id}`);
    try{await ownerApi.archiveTimetable(token,item.id);await load();}
    catch{setError(t("schedule.archiveTimetableError"));}
    finally{setBusy(null);}
  }

  if(loading)return <Screen embedded><DataLoadingState variant="list" minHeight={460}/></Screen>;

  return <Screen embedded>
    <View style={styles.pageHeader}>
      <View style={{flex:1,gap:2}}>
        <AppText variant="title" weight="bold">{t("schedule.subnav.weekly")}</AppText>
        <AppText muted>{t("schedule.noTimetable")}</AppText>
      </View>
      <Button label={t("schedule.createWeekly")} onPress={()=>router.push("/owner/timetable/edit")} style={styles.headerButton}/>
    </View>

    {error?<Card style={styles.errorCard}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} onPress={()=>void load()} variant="secondary"/>
    </Card>:null}

    {conflicts.length?<Card style={styles.conflictCard}>
      <View style={styles.titleRow}>
        <Ionicons name="warning-outline" size={22} color={colors.warning}/>
        <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>{t("schedule.publishConflictTitle")}</AppText>
      </View>
      <AppText>{t("schedule.publishConflictBody")}</AppText>
      <AppText weight="bold">{t("schedule.conflictCount",{count:conflicts.length})}</AppText>
      {conflicts.slice(0,10).map((item,index)=><View key={`${item.areaId}-${item.startsAt}-${index}`} style={styles.conflictRow}>
        <AppText weight="semibold">{item.areaName} · {item.title}</AppText>
        <AppText variant="caption" muted forceLtr>{item.startsAt} → {item.endsAt}</AppText>
      </View>)}
    </Card>:null}

    <Section title={t("schedule.currentTimetable")}>
      {data?.current?<VersionCard
        item={data.current}
        language={language}
        t={t}
        actions={[
          {label:t("schedule.newVersion"),onPress:()=>void duplicate(data.current!),loading:busy===`duplicate-${data.current.id}`},
        ]}
      />:<AppText muted>{t("schedule.noTimetable")}</AppText>}
    </Section>

    <Section title={t("schedule.draftTimetables")}>
      {data?.drafts.length?data.drafts.map((item)=><VersionCard
        key={item.id}
        item={item}
        language={language}
        t={t}
        actions={[
          {label:t("schedule.editWeekly"),onPress:()=>router.push({pathname:"/owner/timetable/edit",params:{timetableId:item.id}})},
          {label:t("schedule.publish"),onPress:()=>void publish(item),loading:busy===`publish-${item.id}`},
          {label:t("schedule.duplicate"),onPress:()=>void duplicate(item),loading:busy===`duplicate-${item.id}`},
          {label:t("schedule.deleteDraft"),onPress:()=>deleteDraft(item),danger:true,loading:busy===`delete-${item.id}`},
        ]}
      />):<AppText muted>{t("schedule.noEvents")}</AppText>}
    </Section>

    {data?.future.length?<Section title={t("schedule.futureTimetables")}>
      {data.future.map((item)=><VersionCard
        key={item.id}
        item={item}
        language={language}
        t={t}
        actions={[
          {label:t("schedule.newVersion"),onPress:()=>void duplicate(item),loading:busy===`duplicate-${item.id}`},
          {label:t("schedule.archiveTimetable"),onPress:()=>void archive(item),loading:busy===`archive-${item.id}`},
        ]}
      />)}
    </Section>:null}

    {data?.archived.length?<Section title={t("schedule.archivedTimetables")}>
      {data.archived.map((item)=><VersionCard
        key={item.id}
        item={item}
        language={language}
        t={t}
        actions={[
          {label:t("schedule.newVersion"),onPress:()=>void duplicate(item),loading:busy===`duplicate-${item.id}`},
        ]}
      />)}
    </Section>:null}
  </Screen>;
}

function Section({title,children}:{title:string;children:ReactNode}){
  return <Card>
    <AppText variant="bodyLarge" weight="bold">{title}</AppText>
    {children}
  </Card>;
}

function VersionCard({
  item,language,t,actions,
}:{
  item:VenueTimetableDto;
  language:"fa-AF"|"ps-AF"|"en";
  t:ReturnType<typeof useLocale>["t"];
  actions:Array<{label:string;onPress:()=>void;danger?:boolean;loading?:boolean}>;
}){
  return <View style={styles.versionCard}>
    <View style={styles.titleRow}>
      <View style={{flex:1,gap:2}}>
        <AppText weight="bold">{item.name}</AppText>
        <AppText variant="caption" muted>
          {formatCalendarDate(item.effectiveFrom,language,{year:"numeric",month:"long",day:"numeric"})}
          {" → "}
          {item.effectiveUntil
            ?formatCalendarDate(item.effectiveUntil,language,{year:"numeric",month:"long",day:"numeric"})
            :t("schedule.forever")}
        </AppText>
      </View>
      <View style={styles.statusBadge}>
        <AppText variant="caption" weight="bold" style={{color:colors.primary}}>
          {t(`schedule.status.${item.status}` as never)}
        </AppText>
      </View>
    </View>
    <AppText variant="caption" muted forceLtr>
      {item.defaultSlotDurationMinutes} min · +{item.bufferMinutes} min
    </AppText>
    <View style={styles.actions}>
      {actions.map((action)=><Button
        key={action.label}
        label={action.label}
        onPress={action.onPress}
        loading={action.loading??false}
        variant={action.danger?"danger":"secondary"}
        style={styles.actionButton}
      />)}
    </View>
  </View>;
}

const styles=StyleSheet.create({
  pageHeader:{flexDirection:"row",alignItems:"center",gap:spacing.sm,flexWrap:"wrap"},
  headerButton:{minWidth:170},
  errorCard:{borderColor:colors.danger},
  conflictCard:{borderColor:colors.warning},
  titleRow:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  conflictRow:{paddingVertical:spacing.sm,borderBottomWidth:1,borderBottomColor:colors.border},
  versionCard:{padding:spacing.sm,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,gap:spacing.sm},
  statusBadge:{paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,borderRadius:radius.pill,backgroundColor:colors.primarySoft},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  actionButton:{flexGrow:1,minWidth:135},
});