import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type {
  OwnerOnboardingStatus,
  VenueCalendarDay,
  VenueCalendarEvent,
  VenueCalendarEventType,
  VenueTimetableConflict,
  VenueTimetableDto,
  VenueTimetableListResponse,
} from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ownerApi } from "../../../src/lib/api";
import {
  formatCalendarDate,
  formatCalendarTime,
  moveView,
  rangeForView,
  todayKabul,
  type TimetableCalendarView,
} from "../../../src/lib/timetable-calendar";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

const views:TimetableCalendarView[]=["MONTH","WEEK","DAY"];
const statusFilters:Array<"ALL"|VenueCalendarEventType>=[
  "ALL",
  "AVAILABLE",
  "ONLINE_BOOKING",
  "MANUAL_BOOKING",
  "COMPETITION",
  "BLOCKED",
  "PROMOTION",
  "CLOSED",
];

function localDateFromIso(value:string){
  return new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Kabul",year:"numeric",month:"2-digit",day:"2-digit",
  }).format(new Date(value));
}

function rawTime(value:string){
  return new Intl.DateTimeFormat("en-GB",{
    timeZone:"Asia/Kabul",hour:"2-digit",minute:"2-digit",hourCycle:"h23",
  }).format(new Date(value));
}

function eventIcon(type:VenueCalendarEventType):keyof typeof Ionicons.glyphMap{
  if(type==="AVAILABLE")return "checkmark-circle-outline";
  if(type==="ONLINE_BOOKING")return "phone-portrait-outline";
  if(type==="MANUAL_BOOKING")return "person-add-outline";
  if(type==="COMPETITION")return "trophy-outline";
  if(type==="BLOCKED")return "ban-outline";
  if(type==="PROMOTION")return "pricetag-outline";
  return "lock-closed-outline";
}

function statusColor(type:VenueCalendarEventType){
  if(type==="AVAILABLE")return colors.success;
  if(type==="BLOCKED"||type==="CLOSED")return colors.danger;
  if(type==="COMPETITION")return colors.warning;
  if(type==="PROMOTION")return colors.accent;
  return colors.primary;
}

export default function OwnerScheduleScreen(){
  const params=useLocalSearchParams<{date?:string}>();
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const token=session?.accessToken;
  const initialDate=typeof params.date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(params.date)?params.date:todayKabul();
  const [view,setView]=useState<TimetableCalendarView>(typeof params.date==="string"?"DAY":"WEEK");
  const [anchorDate,setAnchorDate]=useState(initialDate);
  const [areaId,setAreaId]=useState<string|null>(null);
  const [statusFilter,setStatusFilter]=useState<"ALL"|VenueCalendarEventType>("ALL");
  const [owner,setOwner]=useState<OwnerOnboardingStatus|null>(null);
  const [versions,setVersions]=useState<VenueTimetableListResponse|null>(null);
  const [calendar,setCalendar]=useState<Awaited<ReturnType<typeof ownerApi.timetableCalendar>>|null>(null);
  const [loading,setLoading]=useState(true);
  const [calendarLoading,setCalendarLoading]=useState(false);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [conflicts,setConflicts]=useState<VenueTimetableConflict[]>([]);
  const range=useMemo(()=>rangeForView(view,anchorDate),[view,anchorDate]);

  const loadMeta=useCallback(async()=>{
    if(!token)return;
    const [nextOwner,nextVersions]=await Promise.all([
      ownerApi.getStatus(token),
      ownerApi.timetables(token),
    ]);
    setOwner(nextOwner);
    setVersions(nextVersions);
  },[token]);

  const loadCalendar=useCallback(async()=>{
    if(!token)return;
    setCalendarLoading(true);
    try{
      setCalendar(await ownerApi.timetableCalendar(token,range.from,range.to,areaId));
    }finally{
      setCalendarLoading(false);
    }
  },[areaId,range.from,range.to,token]);

  const load=useCallback(async()=>{
    if(!token)return;
    setLoading(true);
    setError(null);
    try{
      await Promise.all([loadMeta(),loadCalendar()]);
    }catch{
      setError(t("schedule.loadTimetableError"));
    }finally{
      setLoading(false);
    }
  },[loadCalendar,loadMeta,t,token]);

  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    if(!loading)void loadCalendar().catch(()=>setError(t("schedule.calendarError")));
  },[areaId,anchorDate,view]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refresh(){
    setError(null);
    try{await Promise.all([loadMeta(),loadCalendar()]);}
    catch{setError(t("schedule.loadTimetableError"));}
  }

  async function duplicateAndEdit(item:VenueTimetableDto){
    if(!token)return;
    setBusy(`duplicate-${item.id}`);
    setError(null);
    try{
      const {timetable}=await ownerApi.duplicateTimetable(token,item.id);
      await loadMeta();
      router.push({pathname:"/owner/timetable/edit",params:{timetableId:timetable.id}});
    }catch{setError(t("schedule.saveTimetableError"));}
    finally{setBusy(null);}
  }

  async function publish(item:VenueTimetableDto){
    if(!token)return;
    setBusy(`publish-${item.id}`);
    setError(null);
    setConflicts([]);
    try{
      const result=await ownerApi.publishTimetable(token,item.id);
      if(result.conflicts.length){
        setConflicts(result.conflicts);
      }else{
        await Promise.all([loadMeta(),loadCalendar()]);
      }
    }catch{setError(t("schedule.publishTimetableError"));}
    finally{setBusy(null);}
  }

  function deleteDraft(item:VenueTimetableDto){
    if(!token)return;
    Alert.alert(t("schedule.deleteDraftTitle"),t("schedule.deleteDraftBody"),[
      {text:t("common.cancel"),style:"cancel"},
      {text:t("schedule.deleteDraft"),style:"destructive",onPress:()=>void(async()=>{
        setBusy(`delete-${item.id}`);
        try{await ownerApi.deleteTimetable(token,item.id);await loadMeta();}
        catch{setError(t("schedule.deleteTimetableError"));}
        finally{setBusy(null);}
      })()},
    ]);
  }

  async function archive(item:VenueTimetableDto){
    if(!token)return;
    setBusy(`archive-${item.id}`);
    try{await ownerApi.archiveTimetable(token,item.id);await loadMeta();}
    catch{setError(t("schedule.archiveTimetableError"));}
    finally{setBusy(null);}
  }

  async function removeException(id:string){
    if(!token)return;
    setBusy(`exception-${id}`);
    try{await ownerApi.deleteTimetableException(token,id);await Promise.all([loadMeta(),loadCalendar()]);}
    catch{setError(t("schedule.exceptionError"));}
    finally{setBusy(null);}
  }

  async function cancelBooking(id:string){
    if(!token)return;
    setBusy(`event-${id}`);
    try{await ownerApi.cancelBooking(token,id);await loadCalendar();}
    catch{setError(t("schedule.cancelError"));}
    finally{setBusy(null);}
  }

  async function unblock(id:string){
    if(!token)return;
    setBusy(`event-${id}`);
    try{await ownerApi.deleteBlock(token,id);await loadCalendar();}
    catch{setError(t("schedule.unblockError"));}
    finally{setBusy(null);}
  }

  if(loading)return <Screen embedded><DataLoadingState variant="dashboard" minHeight={560}/></Screen>;

  const selectedDay=calendar?.days.find((day)=>day.date===anchorDate)??calendar?.days[0]??null;
  const monthKey=anchorDate.slice(0,7);
  const areas=owner?.venue?.areas??[];

  return <Screen embedded>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("schedule.venueTimetable")}</AppText>
      <AppText muted>{t("schedule.subtitle")}</AppText>
    </View>

    {error?<Card style={styles.errorCard}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} onPress={()=>void refresh()} variant="secondary"/>
    </Card>:null}

    <Card>
      <View style={[styles.toolbar,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Button label={t("schedule.today")} onPress={()=>setAnchorDate(todayKabul())} variant="secondary" style={styles.compactButton}/>
        <View style={[styles.navButtons,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Pressable style={styles.iconButton} onPress={()=>setAnchorDate(moveView(view,anchorDate,-1))}>
            <Ionicons name={isRTL?"chevron-forward":"chevron-back"} size={20} color={colors.primary}/>
          </Pressable>
          <AppText weight="bold" style={styles.rangeLabel}>
            {view==="MONTH"
              ?formatCalendarDate(anchorDate,language,{month:"long",year:"numeric"})
              :view==="DAY"
                ?formatCalendarDate(anchorDate,language,{weekday:"short",month:"short",day:"numeric",year:"numeric"})
                :`${formatCalendarDate(range.from,language)} — ${formatCalendarDate(range.to,language)}`}
          </AppText>
          <Pressable style={styles.iconButton} onPress={()=>setAnchorDate(moveView(view,anchorDate,1))}>
            <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={20} color={colors.primary}/>
          </Pressable>
        </View>
      </View>

      <View style={[styles.segmented,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {views.map((item)=><Pressable
          key={item}
          onPress={()=>setView(item)}
          style={[styles.segment,view===item&&styles.segmentActive]}
        >
          <AppText weight="semibold" style={view===item?styles.segmentTextActive:undefined}>
            {t(`schedule.calendar.${item.toLowerCase()}` as never)}
          </AppText>
        </Pressable>)}
      </View>

      <AppText weight="semibold">{t("schedule.area")}</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <FilterChip label={t("schedule.allAreas")} active={areaId===null} onPress={()=>setAreaId(null)}/>
        {areas.map((area)=><FilterChip key={area.id} label={area.name} active={areaId===area.id} onPress={()=>setAreaId(area.id)}/>)}
      </ScrollView>
    </Card>

    {selectedDay?<Summary day={selectedDay} t={t}/>:null}

    {calendarLoading?<DataLoadingState variant="list" minHeight={320}/>:calendar?
      view==="MONTH"
        ?<MonthView
          days={calendar.days}
          monthKey={monthKey}
          language={language}
          selected={anchorDate}
          onSelect={(date)=>{setAnchorDate(date);setView("DAY");}}
        />
        :view==="WEEK"
          ?<WeekView days={calendar.days} language={language} onSelect={(date)=>{setAnchorDate(date);setView("DAY");}}/>
          :<DayView
            day={selectedDay}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            language={language}
            t={t}
            busy={busy}
            onCancelBooking={(id)=>void cancelBooking(id)}
            onUnblock={(id)=>void unblock(id)}
          />
      :null}

    <Card>
      <AppText variant="bodyLarge" weight="bold">{t("schedule.quickActions")}</AppText>
      <View style={styles.actionGrid}>
        <Button label={t("schedule.createWeekly")} onPress={()=>router.push("/owner/timetable/edit")} style={styles.actionButton}/>
        <Button label={t("schedule.addManual")} onPress={()=>router.push("/owner/manual-booking")} variant="secondary" style={styles.actionButton}/>
        <Button label={t("schedule.blockTime")} onPress={()=>router.push("/owner/block-time")} variant="secondary" style={styles.actionButton}/>
        <Button label={t("schedule.addException")} onPress={()=>router.push("/owner/timetable/exception")} variant="secondary" style={styles.actionButton}/>
      </View>
    </Card>

    <Legend t={t}/>

    {conflicts.length?<Card style={styles.conflictCard}>
      <View style={styles.titleRow}>
        <Ionicons name="warning-outline" size={22} color={colors.warning}/>
        <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>{t("schedule.publishConflictTitle")}</AppText>
      </View>
      <AppText>{t("schedule.publishConflictBody")}</AppText>
      <AppText weight="bold">{t("schedule.conflictCount",{count:conflicts.length})}</AppText>
      {conflicts.slice(0,12).map((conflict,index)=><Pressable
        key={`${conflict.type}-${conflict.areaId}-${conflict.startsAt}-${index}`}
        onPress={()=>{
          setAnchorDate(localDateFromIso(conflict.startsAt));
          setView("DAY");
        }}
        style={styles.conflictItem}
      >
        <AppText weight="semibold">{conflict.areaName} · {conflict.title}</AppText>
        <AppText variant="caption" muted forceLtr>{formatCalendarTime(conflict.startsAt,language)} – {formatCalendarTime(conflict.endsAt,language)}</AppText>
      </Pressable>)}
      <Button label={t("schedule.reviewConflicts")} onPress={()=>{
        const first=conflicts[0];
        if(first){setAnchorDate(localDateFromIso(first.startsAt));setView("DAY");}
      }} variant="secondary"/>
    </Card>:null}

    <TimetableVersions
      data={versions}
      t={t}
      busy={busy}
      onCreate={()=>router.push("/owner/timetable/edit")}
      onEdit={(item)=>router.push({pathname:"/owner/timetable/edit",params:{timetableId:item.id}})}
      onDuplicate={(item)=>void duplicateAndEdit(item)}
      onPublish={(item)=>void publish(item)}
      onDelete={deleteDraft}
      onArchive={(item)=>void archive(item)}
    />

    <Card>
      <View style={styles.titleRow}>
        <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>{t("schedule.specialHours")}</AppText>
        <Button label={t("schedule.addException")} onPress={()=>router.push("/owner/timetable/exception")} variant="secondary" style={styles.smallAction}/>
      </View>
      {versions?.exceptions.length?versions.exceptions.map((item)=><View key={item.id} style={styles.versionRow}>
        <View style={{flex:1,gap:2}}>
          <AppText weight="semibold">{formatCalendarDate(item.date,language,{weekday:"short",month:"short",day:"numeric",year:"numeric"})}</AppText>
          <AppText variant="caption" muted>{item.isClosed?t("schedule.dayClosed"):item.periods.map((period)=>`${period.startsAt}–${period.endsAt}`).join(", ")}</AppText>
          {item.note?<AppText variant="caption">{item.note}</AppText>:null}
        </View>
        <Button
          label={t("schedule.deleteException")}
          onPress={()=>void removeException(item.id)}
          loading={busy===`exception-${item.id}`}
          variant="ghost"
          style={styles.smallAction}
        />
      </View>):<AppText muted>{t("schedule.noEvents")}</AppText>}
    </Card>
  </Screen>;
}

function Summary({day,t}:{day:VenueCalendarDay;t:ReturnType<typeof useLocale>["t"]}){
  const metrics=[
    [t("schedule.summaryAvailable"),day.availableCount],
    [t("schedule.summaryBooked"),day.bookedCount],
    [t("schedule.summaryManual"),day.manualCount],
    [t("schedule.summaryCompetition"),day.competitionCount],
    [t("schedule.summaryBlocked"),day.blockedCount],
  ] as const;
  return <Card>
    <View style={styles.summaryGrid}>
      {metrics.map(([label,value])=><View key={label} style={styles.metric}>
        <AppText variant="bodyLarge" weight="bold" style={{color:colors.primary}}>{value}</AppText>
        <AppText variant="caption" muted>{label}</AppText>
      </View>)}
      <View style={styles.metric}>
        <AppText variant="bodyLarge" weight="bold" style={{color:colors.success}} forceLtr>{day.revenueAfn} AFN</AppText>
        <AppText variant="caption" muted>{t("schedule.summaryRevenue")}</AppText>
      </View>
    </View>
  </Card>;
}

function MonthView({
  days,monthKey,language,selected,onSelect,
}:{
  days:VenueCalendarDay[];
  monthKey:string;
  language:"fa-AF"|"ps-AF"|"en";
  selected:string;
  onSelect:(date:string)=>void;
}){
  return <Card style={styles.calendarCard}>
    <View style={styles.monthGrid}>
      {days.map((day)=><View key={day.date} style={styles.monthCellFrame}>
        <Pressable
          onPress={()=>onSelect(day.date)}
          style={[
            styles.monthCell,
            !day.date.startsWith(monthKey)&&styles.monthCellMuted,
            selected===day.date&&styles.monthCellSelected,
          ]}
        >
          <AppText weight="bold">{formatCalendarDate(day.date,language,{day:"numeric"})}</AppText>
          {day.closed
            ?<AppText variant="caption" style={{color:colors.danger}}>×</AppText>
            :<>
              <AppText variant="caption" style={{color:colors.primary}}>{day.bookedCount} B</AppText>
              <AppText variant="caption" style={{color:colors.success}}>{day.availableCount} A</AppText>
              {day.competitionCount?<Ionicons name="trophy-outline" size={13} color={colors.warning}/>:null}
            </>}
        </Pressable>
      </View>)}
    </View>
  </Card>;
}

function WeekView({days,language,onSelect}:{
  days:VenueCalendarDay[];
  language:"fa-AF"|"ps-AF"|"en";
  onSelect:(date:string)=>void;
}){
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekScroll}>
    {days.map((day)=><Pressable key={day.date} onPress={()=>onSelect(day.date)}>
      <Card style={styles.weekCard}>
        <AppText weight="bold">{formatCalendarDate(day.date,language,{weekday:"short",month:"short",day:"numeric"})}</AppText>
        <View style={styles.weekStats}>
          <AppText variant="caption">{day.availableCount} ✓</AppText>
          <AppText variant="caption">{day.bookedCount} ●</AppText>
          {day.competitionCount?<AppText variant="caption">{day.competitionCount} 🏆</AppText>:null}
          {day.blockedCount?<AppText variant="caption">{day.blockedCount} ⊘</AppText>:null}
        </View>
        {day.events.filter((event)=>event.type!=="AVAILABLE").slice(0,4).map((event)=><View key={event.id} style={styles.weekEvent}>
          <View style={[styles.dot,{backgroundColor:statusColor(event.type)}]}/>
          <AppText variant="caption" numberOfLines={1} style={{flex:1}}>
            {event.startsAt?formatCalendarTime(event.startsAt,language):""} {event.title}
          </AppText>
        </View>)}
      </Card>
    </Pressable>)}
  </ScrollView>;
}

function DayView({
  day,statusFilter,setStatusFilter,language,t,busy,onCancelBooking,onUnblock,
}:{
  day:VenueCalendarDay|null;
  statusFilter:"ALL"|VenueCalendarEventType;
  setStatusFilter:(value:"ALL"|VenueCalendarEventType)=>void;
  language:"fa-AF"|"ps-AF"|"en";
  t:ReturnType<typeof useLocale>["t"];
  busy:string|null;
  onCancelBooking:(id:string)=>void;
  onUnblock:(id:string)=>void;
}){
  const events=(day?.events??[]).filter((event)=>statusFilter==="ALL"||event.type===statusFilter);
  return <View style={{gap:spacing.md}}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {statusFilters.map((status)=><FilterChip
        key={status}
        label={status==="ALL"?t("schedule.allStatuses"):t(`schedule.event.${status}` as never)}
        active={statusFilter===status}
        onPress={()=>setStatusFilter(status)}
      />)}
    </ScrollView>
    {!events.length?<Card><AppText muted>{t("schedule.noEvents")}</AppText></Card>:events.map((event)=><EventCard
      key={event.id}
      event={event}
      language={language}
      t={t}
      busy={busy===`event-${event.id}`}
      onCancelBooking={()=>onCancelBooking(event.id)}
      onUnblock={()=>onUnblock(event.id)}
    />)}
  </View>;
}

function EventCard({
  event,language,t,busy,onCancelBooking,onUnblock,
}:{
  event:VenueCalendarEvent;
  language:"fa-AF"|"ps-AF"|"en";
  t:ReturnType<typeof useLocale>["t"];
  busy:boolean;
  onCancelBooking:()=>void;
  onUnblock:()=>void;
}){
  const date=event.startsAt?localDateFromIso(event.startsAt):todayKabul();
  const start=event.startsAt?rawTime(event.startsAt):"";
  const end=event.endsAt?rawTime(event.endsAt):"";
  return <Card style={{borderLeftWidth:4,borderLeftColor:statusColor(event.type)}}>
    <View style={styles.titleRow}>
      <View style={[styles.eventIcon,{backgroundColor:`${statusColor(event.type)}18`}]}>
        <Ionicons name={eventIcon(event.type)} size={20} color={statusColor(event.type)}/>
      </View>
      <View style={{flex:1,gap:2}}>
        <AppText weight="bold">{t(`schedule.event.${event.type}` as never)} · {event.areaName}</AppText>
        <AppText variant="caption" muted>{event.title}</AppText>
      </View>
      {event.priceAfn!==null?<AppText weight="bold" forceLtr>{event.priceAfn} AFN</AppText>:null}
    </View>
    {event.startsAt&&event.endsAt?<AppText forceLtr>{formatCalendarTime(event.startsAt,language)} – {formatCalendarTime(event.endsAt,language)}</AppText>:null}
    {event.type==="AVAILABLE"?<View style={styles.actionGrid}>
      <Button
        label={t("schedule.addManual")}
        onPress={()=>router.push({pathname:"/owner/manual-booking",params:{areaId:event.areaId??"",date,start,end}})}
        style={styles.actionButton}
      />
      <Button
        label={t("schedule.blockTime")}
        onPress={()=>router.push({pathname:"/owner/block-time",params:{areaId:event.areaId??"",date,start,end}})}
        variant="secondary"
        style={styles.actionButton}
      />
      <Button
        label={t("ownerMarketing.createPromotion")}
        onPress={()=>router.push({pathname:"/owner/promotions/create",params:{areaId:event.areaId??"",date,start}})}
        variant="secondary"
        style={styles.actionButton}
      />
    </View>:null}
    {(event.type==="ONLINE_BOOKING"||event.type==="MANUAL_BOOKING")?<Button
      label={t("schedule.cancelBooking")}
      onPress={onCancelBooking}
      loading={busy}
      variant="danger"
    />:null}
    {event.type==="BLOCKED"?<Button label={t("schedule.unblock")} onPress={onUnblock} loading={busy} variant="secondary"/>:null}
  </Card>;
}

function TimetableVersions({
  data,t,busy,onCreate,onEdit,onDuplicate,onPublish,onDelete,onArchive,
}:{
  data:VenueTimetableListResponse|null;
  t:ReturnType<typeof useLocale>["t"];
  busy:string|null;
  onCreate:()=>void;
  onEdit:(item:VenueTimetableDto)=>void;
  onDuplicate:(item:VenueTimetableDto)=>void;
  onPublish:(item:VenueTimetableDto)=>void;
  onDelete:(item:VenueTimetableDto)=>void;
  onArchive:(item:VenueTimetableDto)=>void;
}){
  return <Card>
    <View style={styles.titleRow}>
      <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>{t("schedule.manageVersions")}</AppText>
      <Button label={t("schedule.createWeekly")} onPress={onCreate} variant="secondary" style={styles.smallAction}/>
    </View>

    <AppText weight="bold">{t("schedule.currentTimetable")}</AppText>
    {data?.current?<VersionCard
      item={data.current}
      t={t}
      actions={[
        {label:t("schedule.newVersion"),onPress:()=>onDuplicate(data.current!),loading:busy===`duplicate-${data.current.id}`},
      ]}
    />:<AppText muted>{t("schedule.noTimetable")}</AppText>}

    {data?.drafts.length?<View style={styles.versionSection}>
      <AppText weight="bold">{t("schedule.draftTimetables")}</AppText>
      {data.drafts.map((item)=><VersionCard key={item.id} item={item} t={t} actions={[
        {label:t("schedule.editWeekly"),onPress:()=>onEdit(item)},
        {label:t("schedule.publish"),onPress:()=>onPublish(item),loading:busy===`publish-${item.id}`},
        {label:t("schedule.duplicate"),onPress:()=>onDuplicate(item),loading:busy===`duplicate-${item.id}`},
        {label:t("schedule.deleteDraft"),onPress:()=>onDelete(item),danger:true,loading:busy===`delete-${item.id}`},
      ]}/>)}
    </View>:null}

    {data?.future.length?<View style={styles.versionSection}>
      <AppText weight="bold">{t("schedule.futureTimetables")}</AppText>
      {data.future.map((item)=><VersionCard key={item.id} item={item} t={t} actions={[
        {label:t("schedule.newVersion"),onPress:()=>onDuplicate(item),loading:busy===`duplicate-${item.id}`},
        {label:t("schedule.archiveTimetable"),onPress:()=>onArchive(item),loading:busy===`archive-${item.id}`},
      ]}/>)}
    </View>:null}

    {data?.archived.length?<View style={styles.versionSection}>
      <AppText weight="bold">{t("schedule.archivedTimetables")}</AppText>
      {data.archived.slice(0,8).map((item)=><VersionCard key={item.id} item={item} t={t} actions={[
        {label:t("schedule.newVersion"),onPress:()=>onDuplicate(item),loading:busy===`duplicate-${item.id}`},
      ]}/>)}
    </View>:null}
  </Card>;
}

function VersionCard({
  item,t,actions,
}:{
  item:VenueTimetableDto;
  t:ReturnType<typeof useLocale>["t"];
  actions:Array<{label:string;onPress:()=>void;danger?:boolean;loading?:boolean}>;
}){
  return <View style={styles.versionCard}>
    <View style={styles.titleRow}>
      <View style={{flex:1}}>
        <AppText weight="bold">{item.name}</AppText>
        <AppText variant="caption" muted forceLtr>
          {item.effectiveFrom} → {item.effectiveUntil??t("schedule.forever")}
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
    <View style={styles.actionGrid}>
      {actions.map((action)=><Button
        key={action.label}
        label={action.label}
        onPress={action.onPress}
        loading={action.loading}
        variant={action.danger?"danger":"secondary"}
        style={styles.actionButton}
      />)}
    </View>
  </View>;
}

function Legend({t}:{t:ReturnType<typeof useLocale>["t"]}){
  return <Card>
    <AppText weight="bold">{t("schedule.legend")}</AppText>
    <View style={styles.legend}>
      {statusFilters.filter((item)=>item!=="ALL").map((type)=><View key={type} style={styles.legendItem}>
        <View style={[styles.dot,{backgroundColor:statusColor(type)}]}/>
        <AppText variant="caption">{t(`schedule.event.${type}` as never)}</AppText>
      </View>)}
    </View>
  </Card>;
}

function FilterChip({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){
  return <Pressable onPress={onPress} style={[styles.chip,active&&styles.chipActive]}>
    <AppText variant="caption" weight="semibold" numberOfLines={1} style={active?styles.chipTextActive:undefined}>{label}</AppText>
  </Pressable>;
}

const styles=StyleSheet.create({
  errorCard:{borderColor:colors.danger},
  toolbar:{alignItems:"center",justifyContent:"space-between",gap:spacing.sm,flexWrap:"wrap"},
  compactButton:{minHeight:42,paddingHorizontal:spacing.md},
  navButtons:{alignItems:"center",gap:spacing.xs,flex:1,justifyContent:"flex-end"},
  iconButton:{width:42,height:42,borderRadius:radius.md,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  rangeLabel:{textAlign:"center",minWidth:120},
  segmented:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,overflow:"hidden"},
  segment:{flex:1,minHeight:42,alignItems:"center",justifyContent:"center",backgroundColor:colors.surface},
  segmentActive:{backgroundColor:colors.primarySoft},
  segmentTextActive:{color:colors.primary},
  chips:{gap:spacing.sm,paddingVertical:spacing.xs},
  chip:{minHeight:38,paddingHorizontal:spacing.md,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,alignItems:"center",justifyContent:"center",backgroundColor:colors.surface},
  chipActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  chipTextActive:{color:colors.primary},
  summaryGrid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  metric:{minWidth:96,flexGrow:1,padding:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surfaceMuted,gap:2},
  calendarCard:{padding:spacing.xs},
  monthGrid:{flexDirection:"row",flexWrap:"wrap"},
  monthCellFrame:{width:"14.285714%",padding:2},
  monthCell:{minHeight:78,borderRadius:radius.sm,borderWidth:1,borderColor:colors.border,padding:spacing.xs,gap:2,backgroundColor:colors.surface},
  monthCellMuted:{opacity:.46},
  monthCellSelected:{borderColor:colors.primary,backgroundColor:colors.primarySoft,borderWidth:2},
  weekScroll:{gap:spacing.sm,paddingVertical:spacing.xs},
  weekCard:{width:220,minHeight:190},
  weekStats:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  weekEvent:{flexDirection:"row",alignItems:"center",gap:spacing.xs},
  dot:{width:8,height:8,borderRadius:4},
  titleRow:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  eventIcon:{width:38,height:38,borderRadius:12,alignItems:"center",justifyContent:"center"},
  actionGrid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  actionButton:{flexGrow:1,minWidth:145},
  smallAction:{minHeight:40,paddingHorizontal:spacing.sm},
  legend:{flexDirection:"row",flexWrap:"wrap",gap:spacing.md},
  legendItem:{flexDirection:"row",alignItems:"center",gap:spacing.xs},
  conflictCard:{borderColor:colors.warning},
  conflictItem:{paddingVertical:spacing.sm,borderBottomWidth:1,borderBottomColor:colors.border},
  versionSection:{gap:spacing.sm,paddingTop:spacing.sm},
  versionCard:{padding:spacing.sm,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,gap:spacing.sm},
  versionRow:{flexDirection:"row",alignItems:"center",gap:spacing.sm,paddingVertical:spacing.sm,borderBottomWidth:1,borderBottomColor:colors.border},
  statusBadge:{paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,borderRadius:radius.pill,backgroundColor:colors.primarySoft},
});
