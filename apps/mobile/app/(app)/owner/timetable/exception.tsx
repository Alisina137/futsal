import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { VenueTimetableExceptionPeriod } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { ownerApi } from "../../../../src/lib/api";
import {
  calendarInputDate,
  calendarInputToGregorian,
  todayKabul,
} from "../../../../src/lib/timetable-calendar";
import { normalizeLocalizedDigits, suggestNextPeriod } from "../../../../src/lib/timetable-editor";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../../src/components/ui/Screen";
import { TextField } from "../../../../src/components/ui/TextField";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

export default function TimetableExceptionScreen(){
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const token=session?.accessToken;
  const [areas,setAreas]=useState<Array<{id:string;name:string}>>([]);
  const [areaId,setAreaId]=useState<string|null>(null);
  const [date,setDate]=useState(()=>calendarInputDate(todayKabul(),language));
  const [isClosed,setClosed]=useState(true);
  const [periods,setPeriods]=useState<VenueTimetableExceptionPeriod[]>([{startsAt:"08:00",endsAt:"23:00"}]);
  const [note,setNote]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!token)return;
    setLoading(true);
    try{
      const status=await ownerApi.getStatus(token);
      setAreas((status.venue?.areas??[]).map((area)=>({id:area.id,name:area.name})));
    }catch{setError(t("schedule.loadTimetableError"));}
    finally{setLoading(false);}
  },[t,token]);

  useEffect(()=>{void load();},[load]);

  function updatePeriod(index:number,patch:Partial<VenueTimetableExceptionPeriod>){
    setPeriods((current)=>current.map((period,i)=>i===index?{...period,...patch}:period));
  }

  async function save(){
    if(!token)return;
    const gregorianDate=calendarInputToGregorian(date,language);
    const normalizedPeriods=periods.map((period)=>({
      startsAt:normalizeLocalizedDigits(period.startsAt),
      endsAt:normalizeLocalizedDigits(period.endsAt),
    }));
    if(!gregorianDate||(!isClosed&&!normalizedPeriods.length)){
      setError(t("schedule.exceptionError"));return;
    }
    setBusy(true);setError(null);
    try{
      await ownerApi.createTimetableException(token,{
        areaId,
        date:gregorianDate,
        isClosed,
        periods:isClosed?[]:normalizedPeriods,
        note,
      });
      router.replace("/owner/schedule");
    }catch{setError(t("schedule.exceptionError"));}
    finally{setBusy(false);}
  }

  if(loading)return <Screen embedded><DataLoadingState variant="form" minHeight={480}/></Screen>;

  return <Screen embedded>
    <View style={styles.header}>
      <Pressable onPress={()=>router.back()} style={styles.back}>
        <Ionicons name={isRTL?"chevron-forward":"chevron-back"} size={22} color={colors.primary}/>
      </Pressable>
      <View style={{flex:1}}>
        <AppText variant="title" weight="bold">{t("schedule.addException")}</AppText>
        <AppText muted>{t("schedule.specialHours")}</AppText>
      </View>
    </View>

    {error?<Card style={{borderColor:colors.danger}}><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}

    <Card>
      <TextField label={t("schedule.exceptionDate")} value={date} onChangeText={setDate} hint={language==="en"?"YYYY-MM-DD":t("schedule.solarHijriHint")} forceLtr/>
      <AppText weight="semibold">{t("schedule.exceptionArea")}</AppText>
      <View style={styles.chips}>
        <Choice label={t("schedule.allAreas")} active={areaId===null} onPress={()=>setAreaId(null)}/>
        {areas.map((area)=><Choice key={area.id} label={area.name} active={areaId===area.id} onPress={()=>setAreaId(area.id)}/>)}
      </View>

      <View style={[styles.toggleRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={{flex:1}}>
          <AppText weight="semibold">{t("schedule.exceptionClosed")}</AppText>
          <AppText variant="caption" muted>{isClosed?t("schedule.dayClosed"):t("schedule.dayOpen")}</AppText>
        </View>
        <Switch value={isClosed} onValueChange={setClosed}/>
      </View>

      {!isClosed?<View style={{gap:spacing.sm}}>
        {periods.map((period,index)=><View key={index} style={styles.period}>
          <AppText variant="caption" weight="semibold">{t("schedule.period")} {index+1}</AppText>
          <View style={[styles.times,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <TextField label={t("schedule.startTime")} value={period.startsAt} onChangeText={(value)=>updatePeriod(index,{startsAt:value})} forceLtr containerStyle={styles.field}/>
            <TextField label={t("schedule.endTime")} value={period.endsAt} onChangeText={(value)=>updatePeriod(index,{endsAt:value})} forceLtr containerStyle={styles.field}/>
          </View>
          {periods.length>1?<Button label={t("schedule.removePeriod")} onPress={()=>setPeriods((current)=>current.filter((_,i)=>i!==index))} variant="ghost"/>:null}
        </View>)}
        <Button label={t("schedule.addPeriod")} onPress={()=>{
          const next=suggestNextPeriod(periods);
          if(!next){setError(t("schedule.noRoomForPeriod"));return;}
          setError(null);
          setPeriods((current)=>[...current,next]);
        }} variant="secondary"/>
      </View>:null}

      <TextField label={t("schedule.exceptionNote")} value={note} onChangeText={setNote} multiline/>
    </Card>

    <Button label={t("common.save")} onPress={()=>void save()} loading={busy}/>
  </Screen>;
}

function Choice({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){
  return <Pressable onPress={onPress} style={[styles.choice,active&&styles.choiceActive]}>
    <AppText variant="caption" weight="semibold" numberOfLines={1} style={active?{color:colors.primary}:undefined}>{label}</AppText>
  </Pressable>;
}

const styles=StyleSheet.create({
  header:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  back:{width:44,height:44,borderRadius:radius.md,backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"},
  chips:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  choice:{minHeight:40,paddingHorizontal:spacing.md,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,alignItems:"center",justifyContent:"center"},
  choiceActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  toggleRow:{alignItems:"center",gap:spacing.md,paddingVertical:spacing.sm},
  period:{gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
  times:{gap:spacing.sm},
  field:{flex:1,minWidth:0},
});
