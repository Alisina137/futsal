import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type {
  VenueOpeningHourInput,
  VenueTimetableConflict,
  VenueTimetableDraftRequest,
  VenueTimetableDto,
} from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { ApiRequestError, ownerApi } from "../../../../src/lib/api";
import {
  buildTimetableDraft,
  suggestNextPeriod,
  type TimetableDraftValidationError,
} from "../../../../src/lib/timetable-editor";
import {
  calendarInputDate,
  orderedWeekdays,
  todayKabul,
} from "../../../../src/lib/timetable-calendar";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../../src/components/ui/Screen";
import { TextField } from "../../../../src/components/ui/TextField";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

type PeriodDraft={startsAt:string;endsAt:string};
type DayDraft={dayOfWeek:number;periods:PeriodDraft[]};

function defaultDays(hours:VenueOpeningHourInput[]|undefined):DayDraft[]{
  return Array.from({length:7},(_,dayOfWeek)=>{
    const hour=hours?.find((item)=>item.dayOfWeek===dayOfWeek);
    return {
      dayOfWeek,
      periods:hour&&!hour.isClosed&&hour.opensAt&&hour.closesAt
        ?[{startsAt:hour.opensAt,endsAt:hour.closesAt}]
        :[],
    };
  });
}

function dayFromTimetable(item:VenueTimetableDto,preferredAreaId:string|null):DayDraft[]{
  return Array.from({length:7},(_,dayOfWeek)=>{
    const specific=preferredAreaId
      ?item.periods.filter((period)=>period.dayOfWeek===dayOfWeek&&period.areaId===preferredAreaId)
      :[];
    const shared=item.periods.filter((period)=>period.dayOfWeek===dayOfWeek&&period.areaId===null);
    const chosen=specific.length?specific:shared;
    return {dayOfWeek,periods:chosen.map((period)=>({startsAt:period.startsAt,endsAt:period.endsAt}))};
  });
}


export default function TimetableEditorScreen(){
  const params=useLocalSearchParams<{timetableId?:string}>();
  const initialId=typeof params.timetableId==="string"?params.timetableId:null;
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const token=session?.accessToken;
  const [timetableId,setTimetableId]=useState<string|null>(initialId);
  const [name,setName]=useState("Weekly timetable");
  const [effectiveFrom,setEffectiveFrom]=useState(()=>calendarInputDate(todayKabul(),language));
  const [effectiveUntil,setEffectiveUntil]=useState("");
  const [duration,setDuration]=useState("90");
  const [buffer,setBuffer]=useState("0");
  const [allAreas,setAllAreas]=useState(true);
  const [selectedAreaIds,setSelectedAreaIds]=useState<string[]>([]);
  const [days,setDays]=useState<DayDraft[]>(defaultDays(undefined));
  const [areas,setAreas]=useState<Array<{id:string;name:string}>>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<"save"|"publish"|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [conflicts,setConflicts]=useState<VenueTimetableConflict[]>([]);

  const load=useCallback(async()=>{
    if(!token)return;
    setLoading(true);
    setError(null);
    try{
      const [status,versions]=await Promise.all([ownerApi.getStatus(token),ownerApi.timetables(token)]);
      const venueAreas=status.venue?.areas??[];
      setAreas(venueAreas.map((area)=>({id:area.id,name:area.name})));
      const item=initialId
        ?[versions.current,...versions.drafts,...versions.future,...versions.archived].find((candidate)=>candidate?.id===initialId)??null
        :null;
      if(item){
        if(item.status!=="DRAFT"){
          setError(t("schedule.saveTimetableError"));
          return;
        }
        setTimetableId(item.id);
        setName(item.name);
        setEffectiveFrom(calendarInputDate(item.effectiveFrom,language));
        setEffectiveUntil(item.effectiveUntil?calendarInputDate(item.effectiveUntil,language):"");
        setDuration(String(item.defaultSlotDurationMinutes));
        setBuffer(String(item.bufferMinutes));
        const specificIds=Array.from(new Set(item.periods.map((period)=>period.areaId).filter((value):value is string=>Boolean(value))));
        const shared=item.periods.some((period)=>period.areaId===null);
        setAllAreas(shared||specificIds.length===0);
        setSelectedAreaIds(shared?[]:specificIds);
        setDays(dayFromTimetable(item,shared?null:specificIds[0]??null));
      }else{
        setDays(defaultDays(status.venue?.openingHours));
        setSelectedAreaIds(venueAreas.map((area)=>area.id));
      }
    }catch{
      setError(t("schedule.loadTimetableError"));
    }finally{
      setLoading(false);
    }
  },[initialId,language,t,token]);

  useEffect(()=>{void load();},[load]);

  function setDayPeriods(dayOfWeek:number,periods:PeriodDraft[]){
    setDays((current)=>current.map((day)=>day.dayOfWeek===dayOfWeek?{...day,periods}:day));
  }

  function toggleDay(day:DayDraft){
    setDayPeriods(day.dayOfWeek,day.periods.length?[]:[{startsAt:"08:00",endsAt:"23:00"}]);
  }

  function updatePeriod(dayOfWeek:number,index:number,patch:Partial<PeriodDraft>){
    setDays((current)=>current.map((day)=>day.dayOfWeek!==dayOfWeek?day:{
      ...day,
      periods:day.periods.map((period,periodIndex)=>periodIndex===index?{...period,...patch}:period),
    }));
  }

  function copyDay(source:DayDraft,targetDay:number){
    setDayPeriods(targetDay,source.periods.map((period)=>({...period})));
  }

  function copyMany(source:DayDraft,targets:number[]){
    setDays((current)=>current.map((day)=>targets.includes(day.dayOfWeek)
      ?{...day,periods:source.periods.map((period)=>({...period}))}
      :day));
  }

  function validationMessage(code:TimetableDraftValidationError){
    if(code==="NAME")return t("schedule.validationName");
    if(code==="DATE")return t("schedule.validationDate");
    if(code==="DATE_RANGE")return t("schedule.validationDateRange");
    if(code==="DURATION")return t("schedule.validationDuration");
    if(code==="BUFFER")return t("schedule.validationBuffer");
    if(code==="AREA")return t("schedule.validationArea");
    if(code==="EMPTY")return t("schedule.validationEmpty");
    if(code==="TIME")return t("schedule.validationTime");
    return t("schedule.validationOverlap");
  }

  function saveErrorMessage(cause:unknown){
    if(!(cause instanceof ApiRequestError))return t("schedule.saveTimetableError");
    if(cause.code==="NETWORK_ERROR"||cause.code==="TIMEOUT")return t("schedule.timetableNetworkError");
    if(cause.code==="VALIDATION_ERROR"){
      const issues=Array.isArray(cause.details)?cause.details:[];
      const first=issues.find((item)=>item&&typeof item==="object"&&"message" in item) as {message?:unknown}|undefined;
      return typeof first?.message==="string"
        ?`${t("schedule.timetableValidationError")} ${first.message}`
        :t("schedule.timetableValidationError");
    }
    if(cause.code==="TIMETABLE_STORAGE_NOT_READY")return t("schedule.timetableStorageError");
    const requestSuffix=cause.requestId?` [${cause.requestId}]`:"";
    return `${t("schedule.saveTimetableError")} (${cause.code})${requestSuffix}`;
  }

  const displayDays=useMemo(
    ()=>orderedWeekdays(language).map((dayOfWeek)=>days.find((day)=>day.dayOfWeek===dayOfWeek)).filter((day):day is DayDraft=>Boolean(day)),
    [days,language],
  );

  function draftResult(){
    return buildTimetableDraft({
      name,
      effectiveFrom,
      effectiveUntil,
      duration,
      buffer,
      allAreas,
      selectedAreaIds,
      days,
      language,
    });
  }

  async function save(){
    if(!token)return null;
    const built=draftResult();
    if(!built.draft){
      setError(validationMessage(built.error!));
      return null;
    }
    const draft=built.draft;
    setBusy("save");setError(null);setConflicts([]);
    try{
      const result=timetableId
        ?await ownerApi.updateTimetable(token,timetableId,draft)
        :await ownerApi.createTimetable(token,draft);
      setTimetableId(result.timetable.id);
      if(!timetableId){
        router.replace({pathname:"/owner/timetable/edit",params:{timetableId:result.timetable.id}});
      }
      return result.timetable;
    }catch(cause){
      setError(saveErrorMessage(cause));
      return null;
    }finally{setBusy(null);}
  }

  async function publish(){
    if(!token)return;
    let id=timetableId;
    if(!id){
      const saved=await save();
      id=saved?.id??null;
    }else{
      const built=draftResult();
      if(!built.draft){setError(validationMessage(built.error!));return;}
      setBusy("publish");setError(null);
      try{await ownerApi.updateTimetable(token,id,built.draft);}
      catch(cause){setError(saveErrorMessage(cause));setBusy(null);return;}
    }
    if(!id)return;
    setBusy("publish");setConflicts([]);
    try{
      const result=await ownerApi.publishTimetable(token,id);
      if(result.conflicts.length){
        setConflicts(result.conflicts);
      }else{
        router.replace("/owner/schedule");
      }
    }catch(cause){
      setError(cause instanceof ApiRequestError
        ?`${t("schedule.publishTimetableError")} (${cause.code})${cause.requestId?` [${cause.requestId}]`:""}`
        :t("schedule.publishTimetableError"));
    }
    finally{setBusy(null);}
  }

  if(loading)return <Screen embedded><DataLoadingState variant="form" minHeight={560}/></Screen>;

  return <Screen embedded>
    <View style={styles.headerRow}>
      <Pressable onPress={()=>router.back()} style={styles.back}>
        <Ionicons name={isRTL?"chevron-forward":"chevron-back"} size={22} color={colors.primary}/>
      </Pressable>
      <View style={{flex:1}}>
        <AppText variant="title" weight="bold">{t("schedule.editWeekly")}</AppText>
        <AppText muted>{t("schedule.venueTimetable")}</AppText>
      </View>
    </View>

    {error?<Card style={{borderColor:colors.danger}}><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}

    <Card>
      <TextField label={t("schedule.timetableName")} value={name} onChangeText={setName}/>
      <View style={[styles.twoColumns,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <TextField label={t("schedule.effectiveFrom")} value={effectiveFrom} onChangeText={setEffectiveFrom} forceLtr hint={language==="en"?"YYYY-MM-DD":t("schedule.solarHijriHint")} containerStyle={styles.field}/>
        <TextField label={t("schedule.effectiveUntil")} value={effectiveUntil} onChangeText={setEffectiveUntil} forceLtr hint={language==="en"?"YYYY-MM-DD":t("schedule.solarHijriHint")} containerStyle={styles.field}/>
      </View>
      <View style={[styles.twoColumns,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <TextField label={t("schedule.slotDuration")} value={duration} onChangeText={setDuration} keyboardType="number-pad" forceLtr containerStyle={styles.field}/>
        <TextField label={t("schedule.buffer")} value={buffer} onChangeText={setBuffer} keyboardType="number-pad" forceLtr containerStyle={styles.field}/>
      </View>
    </Card>

    <Card>
      <AppText variant="bodyLarge" weight="bold">{t("schedule.areaScope")}</AppText>
      <View style={styles.scopeRow}>
        <Choice label={t("schedule.allAreasScope")} active={allAreas} onPress={()=>setAllAreas(true)}/>
        <Choice label={t("schedule.selectedAreas")} active={!allAreas} onPress={()=>setAllAreas(false)}/>
      </View>
      {!allAreas?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.areaChips}>
        {areas.map((area)=>{
          const active=selectedAreaIds.includes(area.id);
          return <Choice key={area.id} label={area.name} active={active} onPress={()=>setSelectedAreaIds((current)=>
            active?current.filter((id)=>id!==area.id):[...current,area.id]
          )}/>;
        })}
      </ScrollView>:null}
    </Card>

    <View style={{gap:spacing.md}}>
      {displayDays.map((day)=><Card key={day.dayOfWeek}>
        <View style={[styles.dayHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={{flex:1}}>
            <AppText variant="bodyLarge" weight="bold">{t(`owner.day.${day.dayOfWeek}` as never)}</AppText>
            <AppText variant="caption" muted>{day.periods.length?t("schedule.dayOpen"):t("schedule.dayClosed")}</AppText>
          </View>
          <Switch value={day.periods.length>0} onValueChange={()=>toggleDay(day)}/>
        </View>

        {day.periods.map((period,index)=><View key={index} style={styles.periodBlock}>
          <AppText variant="caption" weight="semibold">{t("schedule.period")} {index+1}</AppText>
          <View style={[styles.twoColumns,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <TextField label={t("schedule.startTime")} value={period.startsAt} onChangeText={(value)=>updatePeriod(day.dayOfWeek,index,{startsAt:value})} forceLtr containerStyle={styles.field}/>
            <TextField label={t("schedule.endTime")} value={period.endsAt} onChangeText={(value)=>updatePeriod(day.dayOfWeek,index,{endsAt:value})} forceLtr containerStyle={styles.field}/>
          </View>
          {day.periods.length>1?<Button
            label={t("schedule.removePeriod")}
            onPress={()=>setDayPeriods(day.dayOfWeek,day.periods.filter((_,periodIndex)=>periodIndex!==index))}
            variant="ghost"
          />:null}
        </View>)}

        {day.periods.length?<Button
          label={t("schedule.addPeriod")}
          onPress={()=>{
            const next=suggestNextPeriod(day.periods);
            if(!next){
              setError(t("schedule.noRoomForPeriod"));
              return;
            }
            setError(null);
            setDayPeriods(day.dayOfWeek,[...day.periods,next]);
          }}
          variant="secondary"
        />:null}

        {day.periods.length?<View style={{gap:spacing.sm}}>
          <AppText variant="caption" muted>{t("schedule.copyTo")}</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.areaChips}>
            {displayDays.filter((target)=>target.dayOfWeek!==day.dayOfWeek).map((target)=><Choice
              key={target.dayOfWeek}
              label={t(`owner.day.${target.dayOfWeek}` as never)}
              active={false}
              onPress={()=>copyDay(day,target.dayOfWeek)}
            />)}
          </ScrollView>
          <View style={styles.scopeRow}>
            <Button label={t("schedule.copyWeekdays")} onPress={()=>copyMany(day,[1,2,3,4,5])} variant="ghost" style={styles.copyButton}/>
            <Button label={t("schedule.copyAll")} onPress={()=>copyMany(day,[0,1,2,3,4,5,6])} variant="ghost" style={styles.copyButton}/>
          </View>
        </View>:null}
      </Card>)}
    </View>

    {conflicts.length?<Card style={{borderColor:colors.warning}}>
      <View style={styles.headerRow}>
        <Ionicons name="warning-outline" size={24} color={colors.warning}/>
        <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>{t("schedule.publishConflictTitle")}</AppText>
      </View>
      <AppText>{t("schedule.publishConflictBody")}</AppText>
      {conflicts.slice(0,20).map((item,index)=><View key={`${item.areaId}-${item.startsAt}-${index}`} style={styles.conflict}>
        <AppText weight="semibold">{item.areaName} · {item.title}</AppText>
        <AppText variant="caption" muted forceLtr>{item.startsAt} → {item.endsAt}</AppText>
      </View>)}
      <Button label={t("schedule.reviewConflicts")} onPress={()=>{
        const first=conflicts[0];
        const date=first?new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kabul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(first.startsAt)):todayKabul();
        router.replace({pathname:"/owner/schedule",params:{date}});
      }} variant="secondary"/>
    </Card>:null}

    <View style={styles.footerActions}>
      <Button label={t("schedule.saveDraft")} onPress={()=>void save()} loading={busy==="save"} variant="secondary" style={styles.footerButton}/>
      <Button label={t("schedule.publish")} onPress={()=>void publish()} loading={busy==="publish"} style={styles.footerButton}/>
    </View>
  </Screen>;
}

function Choice({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){
  return <Pressable onPress={onPress} style={[styles.choice,active&&styles.choiceActive]}>
    <AppText variant="caption" weight="semibold" numberOfLines={1} style={active?{color:colors.primary}:undefined}>{label}</AppText>
  </Pressable>;
}

const styles=StyleSheet.create({
  headerRow:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  back:{width:44,height:44,borderRadius:radius.md,backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"},
  twoColumns:{gap:spacing.sm,alignItems:"flex-start"},
  field:{flex:1,minWidth:0},
  scopeRow:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  areaChips:{gap:spacing.sm,paddingVertical:spacing.xs},
  choice:{minHeight:40,paddingHorizontal:spacing.md,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,alignItems:"center",justifyContent:"center",backgroundColor:colors.surface},
  choiceActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  dayHeader:{alignItems:"center",gap:spacing.sm},
  periodBlock:{padding:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surfaceMuted,gap:spacing.sm},
  copyButton:{flexGrow:1,minWidth:140},
  conflict:{paddingVertical:spacing.sm,borderBottomWidth:1,borderBottomColor:colors.border},
  footerActions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  footerButton:{flexGrow:1,minWidth:160},
});
