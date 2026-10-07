import { colors, spacing } from "@leaguekick/design-tokens";
import type { VenueTimetableListResponse } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ownerApi } from "../../../../src/lib/api";
import { formatCalendarDate } from "../../../../src/lib/timetable-calendar";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../../src/components/ui/Screen";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

export default function TimetableExceptionsScreen(){
  const {session}=useAuth();
  const {t,language}=useLocale();
  const token=session?.accessToken;
  const [data,setData]=useState<VenueTimetableListResponse|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!token)return;
    setLoading(true);setError(null);
    try{setData(await ownerApi.timetables(token));}
    catch{setError(t("schedule.loadTimetableError"));}
    finally{setLoading(false);}
  },[t,token]);

  useEffect(()=>{void load();},[load]);

  async function remove(id:string){
    if(!token)return;
    setBusy(id);setError(null);
    try{await ownerApi.deleteTimetableException(token,id);await load();}
    catch{setError(t("schedule.exceptionError"));}
    finally{setBusy(null);}
  }

  if(loading)return <Screen embedded><DataLoadingState variant="list" minHeight={420}/></Screen>;

  return <Screen embedded>
    <View style={styles.header}>
      <View style={{flex:1,gap:2}}>
        <AppText variant="title" weight="bold">{t("schedule.subnav.special")}</AppText>
        <AppText muted>{t("schedule.specialHours")}</AppText>
      </View>
      <Button label={t("schedule.addException")} onPress={()=>router.push("/owner/timetable/exception")} style={styles.headerButton}/>
    </View>

    {error?<Card style={styles.errorCard}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} onPress={()=>void load()} variant="secondary"/>
    </Card>:null}

    <Card>
      {data?.exceptions.length?data.exceptions.map((item)=><View key={item.id} style={styles.row}>
        <View style={{flex:1,gap:3}}>
          <AppText weight="bold">
            {formatCalendarDate(item.date,language,{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
          </AppText>
          <AppText>
            {item.isClosed
              ?t("schedule.dayClosed")
              :item.periods.map((period)=>`${period.startsAt}–${period.endsAt}`).join(", ")}
          </AppText>
          {item.note?<AppText variant="caption" muted>{item.note}</AppText>:null}
        </View>
        <Button
          label={t("schedule.deleteException")}
          onPress={()=>void remove(item.id)}
          loading={busy===item.id}
          variant="danger"
          style={styles.deleteButton}
        />
      </View>):<AppText muted>{t("schedule.noEvents")}</AppText>}
    </Card>
  </Screen>;
}

const styles=StyleSheet.create({
  header:{flexDirection:"row",alignItems:"center",gap:spacing.sm,flexWrap:"wrap"},
  headerButton:{minWidth:150},
  errorCard:{borderColor:colors.danger},
  row:{flexDirection:"row",alignItems:"center",gap:spacing.sm,paddingVertical:spacing.sm,borderBottomWidth:1,borderBottomColor:colors.border},
  deleteButton:{minWidth:120},
});