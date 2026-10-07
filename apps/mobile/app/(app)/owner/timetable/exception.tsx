import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { VenueTimetableListResponse } from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { ApiRequestError, ownerApi } from "../../../../src/lib/api";
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

type FormPeriod={startsAt:string;endsAt:string;priceAfn:string};

function validTime(value:string){
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export default function TimetableExceptionScreen(){
  const params=useLocalSearchParams<{exceptionId?:string}>();
  const exceptionId=typeof params.exceptionId==="string"?params.exceptionId:null;
  const editing=Boolean(exceptionId);
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const token=session?.accessToken;
  const areaId:string|null=null;
  const [date,setDate]=useState(()=>calendarInputDate(todayKabul(),language));
  const [isClosed,setClosed]=useState(false);
  const [periods,setPeriods]=useState<FormPeriod[]>([{startsAt:"08:00",endsAt:"23:00",priceAfn:"0"}]);
  const [note,setNote]=useState("");
  const [timetableData,setTimetableData]=useState<VenueTimetableListResponse|null>(null);
  const [basePrice,setBasePrice]=useState(0);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    if(!token)return;
    let active=true;
    void (async()=>{
      try{
        const [status,data]=await Promise.all([ownerApi.getStatus(token),ownerApi.timetables(token)]);
        if(!active)return;
        const price=status.venue?.areas[0]?.basePriceAfn??data.current?.periods[0]?.priceAfn??0;
        setBasePrice(price);
        setTimetableData(data);
        if(exceptionId){
          const existing=data.exceptions.find((item)=>item.id===exceptionId);
          if(!existing){setError(t("schedule.specialNotFound"));return;}
          setDate(calendarInputDate(existing.date,language));
          setClosed(existing.isClosed);
          setPeriods(existing.periods.length
            ?existing.periods.map((period)=>({
              startsAt:period.startsAt,
              endsAt:period.endsAt,
              priceAfn:String(period.priceAfn??price),
            }))
            :[{startsAt:"08:00",endsAt:"23:00",priceAfn:String(price)}]);
          setNote(existing.note??"");
        }else{
          setPeriods([{startsAt:"08:00",endsAt:"23:00",priceAfn:String(price)}]);
        }
      }catch{
        if(active)setError(t("schedule.loadTimetableError"));
      }finally{
        if(active)setLoading(false);
      }
    })();
    return()=>{active=false;};
  },[exceptionId,language,t,token]);

  const gregorianDate=useMemo(()=>calendarInputToGregorian(date,language),[date,language]);

  function updatePeriod(index:number,patch:Partial<FormPeriod>){
    setPeriods((current)=>current.map((period,i)=>i===index?{...period,...patch}:period));
  }

  function useRegularSchedule(){
    if(!gregorianDate||!timetableData){setError(t("schedule.validationDate"));return;}
    const candidates=timetableData.current
      ?[timetableData.current,...timetableData.future]
      :[...timetableData.future];
    const timetable=candidates.find((item)=>
      item.effectiveFrom<=gregorianDate&&(!item.effectiveUntil||item.effectiveUntil>=gregorianDate)
    );
    if(!timetable){setError(t("schedule.specialRequiresWeekly"));return;}
    const weekday=new Date(`${gregorianDate}T00:00:00Z`).getUTCDay();
    const regular=timetable.periods
      .filter((period)=>period.dayOfWeek===weekday)
      .sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
    if(!regular.length){setError(t("schedule.specialNoRegularHours"));return;}
    setClosed(false);
    setPeriods(regular.map((period)=>({
      startsAt:period.startsAt,
      endsAt:period.endsAt,
      priceAfn:String(period.priceAfn??basePrice),
    })));
    setError(null);
  }

  function validationMessage(){
    if(!gregorianDate)return t("schedule.validationDate");
    if(gregorianDate<todayKabul())return t("schedule.specialPastError");
    if(isClosed)return null;
    if(!periods.length)return t("schedule.validationEmpty");
    const normalized=periods.map((period)=>({
      startsAt:normalizeLocalizedDigits(period.startsAt),
      endsAt:normalizeLocalizedDigits(period.endsAt),
      priceAfn:normalizeLocalizedDigits(period.priceAfn),
    }));
    for(const period of normalized){
      if(!validTime(period.startsAt)||!validTime(period.endsAt)||period.startsAt>=period.endsAt){
        return t("schedule.validationTime");
      }
      const price=Number(period.priceAfn);
      if(!Number.isInteger(price)||price<0||price>1_000_000)return t("schedule.validationPrice");
    }
    const sorted=[...normalized].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
    for(let index=1;index<sorted.length;index+=1){
      if(sorted[index]!.startsAt<sorted[index-1]!.endsAt)return t("schedule.validationOverlap");
    }
    return null;
  }

  async function save(){
    if(!token||!gregorianDate)return;
    const validation=validationMessage();
    if(validation){setError(validation);return;}
    const normalizedPeriods=periods.map((period)=>({
      startsAt:normalizeLocalizedDigits(period.startsAt),
      endsAt:normalizeLocalizedDigits(period.endsAt),
      priceAfn:Number(normalizeLocalizedDigits(period.priceAfn)),
    }));
    setBusy(true);setError(null);
    try{
      const input={
        areaId,
        date:gregorianDate,
        isClosed,
        periods:isClosed?[]:normalizedPeriods,
        note:note.trim(),
      };
      if(exceptionId)await ownerApi.updateTimetableException(token,exceptionId,input);
      else await ownerApi.createTimetableException(token,input);
      router.replace("/owner/timetable/exceptions");
    }catch(caught){
      if(caught instanceof ApiRequestError){
        if(caught.code==="TIMETABLE_EXCEPTION_CONFLICT")setError(t("schedule.specialConflict"));
        else if(caught.code==="TIMETABLE_EXCEPTION_EXISTS")setError(t("schedule.specialDuplicate"));
        else if(caught.code==="TIMETABLE_EXCEPTION_PAST")setError(t("schedule.specialPastError"));
        else if(caught.code==="TIMETABLE_EXCEPTION_REQUIRES_TIMETABLE")setError(t("schedule.specialRequiresWeekly"));
        else setError(caught.message||t("schedule.exceptionError"));
      }else setError(t("schedule.exceptionError"));
    }finally{setBusy(false);}
  }

  if(loading)return <Screen embedded><DataLoadingState variant="form" minHeight={500}/></Screen>;

  return <Screen embedded>
    <View style={[styles.header,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Pressable onPress={()=>router.back()} style={styles.back}>
        <Ionicons name={isRTL?"chevron-forward":"chevron-back"} size={22} color={colors.primary}/>
      </Pressable>
      <View style={{flex:1}}>
        <AppText variant="title" weight="bold">{editing?t("schedule.editException"):t("schedule.addException")}</AppText>
        <AppText muted>{t("schedule.specialScheduleBody")}</AppText>
      </View>
    </View>

    {error?<Card style={{borderColor:colors.danger}}><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}

    <Card style={styles.infoCard}>
      <AppText weight="bold">{t("schedule.specialOverrideTitle")}</AppText>
      <AppText muted>{t("schedule.specialOverrideBody")}</AppText>
    </Card>

    <Card style={styles.formCard}>
      <TextField
        label={t("schedule.exceptionDate")}
        value={date}
        onChangeText={setDate}
        hint={language==="en"?"YYYY-MM-DD":t("schedule.solarHijriHint")}
        forceLtr
      />

      <Button label={t("schedule.useRegularSchedule")} onPress={useRegularSchedule} variant="secondary"/>

      <View style={[styles.toggleRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={{flex:1}}>
          <AppText weight="semibold">{t("schedule.exceptionClosed")}</AppText>
          <AppText variant="caption" muted>{isClosed?t("schedule.specialClosedAllDay"):t("schedule.specialCustomHours")}</AppText>
        </View>
        <Switch value={isClosed} onValueChange={setClosed}/>
      </View>

      {!isClosed?<View style={{gap:spacing.sm}}>
        {periods.map((period,index)=><View key={index} style={styles.period}>
          <View style={[styles.periodHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <AppText variant="caption" weight="semibold">{t("schedule.period")} {index+1}</AppText>
            {periods.length>1?<Pressable onPress={()=>setPeriods((current)=>current.filter((_,i)=>i!==index))}>
              <AppText variant="caption" weight="semibold" style={{color:colors.danger}}>{t("schedule.removePeriod")}</AppText>
            </Pressable>:null}
          </View>
          <View style={[styles.times,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <TextField label={t("schedule.startTime")} value={period.startsAt} onChangeText={(value)=>updatePeriod(index,{startsAt:value})} forceLtr containerStyle={styles.field}/>
            <TextField label={t("schedule.endTime")} value={period.endsAt} onChangeText={(value)=>updatePeriod(index,{endsAt:value})} forceLtr containerStyle={styles.field}/>
          </View>
          <TextField
            label={t("schedule.slotPrice")}
            value={period.priceAfn}
            onChangeText={(value)=>updatePeriod(index,{priceAfn:value})}
            keyboardType="numeric"
            hint={t("schedule.specialPriceHint")}
            forceLtr
          />
        </View>)}
        <Button label={t("schedule.addPeriod")} onPress={()=>{
          const base=periods.map((period)=>({startsAt:period.startsAt,endsAt:period.endsAt}));
          const next=suggestNextPeriod(base);
          if(!next){setError(t("schedule.noRoomForPeriod"));return;}
          setError(null);
          setPeriods((current)=>[...current,{...next,priceAfn:String(basePrice)}]);
        }} variant="secondary"/>
      </View>:null}

      <TextField label={t("schedule.exceptionNote")} value={note} onChangeText={setNote} maxLength={240} multiline/>
    </Card>

    <Button label={editing?t("schedule.updateException"):t("schedule.saveException")} onPress={()=>void save()} loading={busy}/>
  </Screen>;
}

const styles=StyleSheet.create({
  header:{alignItems:"center",gap:spacing.sm},
  back:{width:44,height:44,borderRadius:radius.md,backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"},
  infoCard:{gap:spacing.xs,backgroundColor:colors.primarySoft},
  formCard:{gap:spacing.md},
  toggleRow:{alignItems:"center",gap:spacing.md,paddingVertical:spacing.sm},
  period:{gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
  periodHeader:{justifyContent:"space-between",alignItems:"center",gap:spacing.sm},
  times:{gap:spacing.sm},
  field:{flex:1,minWidth:0},
});
