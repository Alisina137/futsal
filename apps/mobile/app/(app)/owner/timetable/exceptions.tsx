import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { VenueTimetableExceptionDto, VenueTimetableListResponse } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { ownerApi } from "../../../../src/lib/api";
import { formatCalendarDate, todayKabul } from "../../../../src/lib/timetable-calendar";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../../src/components/ui/Screen";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

export default function TimetableExceptionsScreen(){
  const {session}=useAuth();
  const {t,language,isRTL}=useLocale();
  const token=session?.accessToken;
  const [data,setData]=useState<VenueTimetableListResponse|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const today=useMemo(()=>todayKabul(),[]);

  const load=useCallback(async()=>{
    if(!token)return;
    setLoading(true);setError(null);
    try{setData(await ownerApi.timetables(token));}
    catch{setError(t("schedule.loadTimetableError"));}
    finally{setLoading(false);}
  },[t,token]);

  useEffect(()=>{void load();},[load]);

  const upcoming=useMemo(
    ()=>[...(data?.exceptions??[])].filter((item)=>item.date>=today).sort((a,b)=>a.date.localeCompare(b.date)),
    [data,today],
  );
  const past=useMemo(
    ()=>[...(data?.exceptions??[])].filter((item)=>item.date<today).sort((a,b)=>b.date.localeCompare(a.date)),
    [data,today],
  );

  async function remove(id:string){
    if(!token)return;
    setBusy(id);setError(null);
    try{await ownerApi.deleteTimetableException(token,id);await load();}
    catch{setError(t("schedule.exceptionDeleteError"));}
    finally{setBusy(null);}
  }

  function confirmRemove(item:VenueTimetableExceptionDto){
    Alert.alert(
      t("schedule.deleteExceptionTitle"),
      t("schedule.deleteExceptionBody"),
      [
        {text:t("common.cancel"),style:"cancel"},
        {text:t("schedule.deleteException"),style:"destructive",onPress:()=>void remove(item.id)},
      ],
    );
  }

  function openEdit(item:VenueTimetableExceptionDto){
    router.push({pathname:"/owner/timetable/exception",params:{exceptionId:item.id}});
  }

  function openDay(item:VenueTimetableExceptionDto){
    router.push({pathname:"/owner/schedule",params:{date:item.date}});
  }

  if(loading)return <Screen embedded><DataLoadingState variant="list" minHeight={420}/></Screen>;

  return <Screen embedded>
    <View style={[styles.header,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={{flex:1,gap:2,minWidth:180}}>
        <AppText variant="title" weight="bold">{t("schedule.subnav.special")}</AppText>
        <AppText muted>{t("schedule.specialScheduleBody")}</AppText>
      </View>
      <Button label={t("schedule.addException")} onPress={()=>router.push("/owner/timetable/exception")} style={styles.headerButton}/>
    </View>

    {error?<Card style={styles.errorCard}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} onPress={()=>void load()} variant="secondary"/>
    </Card>:null}

    <ExceptionSection
      title={t("schedule.specialUpcoming")}
      empty={t("schedule.specialUpcomingEmpty")}
      items={upcoming}
      today={today}
      language={language}
      isRTL={isRTL}
      t={t}
      busy={busy}
      editable
      onEdit={openEdit}
      onDelete={confirmRemove}
      onViewDay={openDay}
    />

    <ExceptionSection
      title={t("schedule.specialPast")}
      empty={t("schedule.specialPastEmpty")}
      items={past}
      today={today}
      language={language}
      isRTL={isRTL}
      t={t}
      busy={busy}
      editable={false}
      onEdit={openEdit}
      onDelete={confirmRemove}
      onViewDay={openDay}
    />
  </Screen>;
}

function ExceptionSection({
  title,empty,items,today,language,isRTL,t,busy,editable,onEdit,onDelete,onViewDay,
}:{
  title:string;
  empty:string;
  items:VenueTimetableExceptionDto[];
  today:string;
  language:"fa-AF"|"ps-AF"|"en";
  isRTL:boolean;
  t:ReturnType<typeof useLocale>["t"];
  busy:string|null;
  editable:boolean;
  onEdit:(item:VenueTimetableExceptionDto)=>void;
  onDelete:(item:VenueTimetableExceptionDto)=>void;
  onViewDay:(item:VenueTimetableExceptionDto)=>void;
}){
  return <View style={styles.section}>
    <AppText variant="bodyLarge" weight="bold">{title}</AppText>
    {!items.length?<Card><AppText muted>{empty}</AppText></Card>:items.map((item)=>
      <Card key={item.id} style={styles.scheduleCard}>
        <View style={[styles.cardTop,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={{flex:1,gap:3}}>
            <AppText weight="bold">
              {formatCalendarDate(item.date,language,{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
            </AppText>
            {item.date===today?<AppText variant="caption" weight="semibold" style={{color:colors.primary}}>{t("schedule.specialToday")}</AppText>:null}
          </View>
          <View style={[styles.badge,item.isClosed?styles.closedBadge:styles.openBadge]}>
            <AppText variant="caption" weight="bold" style={{color:item.isClosed?colors.danger:colors.success}}>
              {item.isClosed?t("schedule.dayClosed"):t("schedule.dayOpen")}
            </AppText>
          </View>
        </View>

        {item.isClosed
          ?<AppText>{t("schedule.specialClosedAllDay")}</AppText>
          :<View style={styles.periodList}>
            {item.periods.map((period,index)=><View key={index} style={[styles.periodLine,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <AppText forceLtr weight="semibold">{period.startsAt}–{period.endsAt}</AppText>
              <AppText style={{color:colors.primary}} weight="semibold" forceLtr>
                {period.priceAfn??0} AFN
              </AppText>
            </View>)}
          </View>}

        {item.note?<View style={styles.note}><AppText variant="caption" muted>{item.note}</AppText></View>:null}

        <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Button label={t("schedule.viewSpecialDay")} onPress={()=>onViewDay(item)} variant="secondary" style={styles.actionButton}/>
          {editable?<Button label={t("common.edit")} onPress={()=>onEdit(item)} variant="secondary" style={styles.actionButton}/>:null}
          <Button
            label={t("schedule.deleteException")}
            onPress={()=>onDelete(item)}
            loading={busy===item.id}
            variant="danger"
            style={styles.actionButton}
          />
        </View>
      </Card>
    )}
  </View>;
}

const styles=StyleSheet.create({
  header:{alignItems:"center",gap:spacing.sm,flexWrap:"wrap"},
  headerButton:{minWidth:160},
  errorCard:{borderColor:colors.danger},
  section:{gap:spacing.sm},
  scheduleCard:{gap:spacing.md},
  cardTop:{alignItems:"flex-start",gap:spacing.sm},
  badge:{paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,borderRadius:radius.pill,borderWidth:1},
  closedBadge:{backgroundColor:"#FEF2F2",borderColor:"#FECACA"},
  openBadge:{backgroundColor:"#F0FDF4",borderColor:"#BBF7D0"},
  periodList:{gap:spacing.xs},
  periodLine:{justifyContent:"space-between",gap:spacing.sm,paddingVertical:spacing.xs,borderBottomWidth:1,borderBottomColor:colors.border},
  note:{padding:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
  actions:{gap:spacing.sm,flexWrap:"wrap"},
  actionButton:{flexGrow:1,minWidth:105},
});
