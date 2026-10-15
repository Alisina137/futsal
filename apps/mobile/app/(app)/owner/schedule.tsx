import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type {
  VenueCalendarDay,
  VenueCalendarEvent,
  VenueCalendarEventType,
} from "@leaguekick/contracts";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ownerApi } from "../../../src/lib/api";
import { OwnerPendingBookings } from "../../../src/components/owner/OwnerPendingBookings";
import {
  formatCalendarDate,
  formatCalendarTime,
  isSameDisplayMonth,
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
import { SlotTileContent } from "../../../src/components/ui/SlotTileContent";
import { softenSlotColor } from "../../../src/lib/slot-color";
import { formatSlotStartTime,formatSlotTilePrice } from "../../../src/lib/slot-display";
import {formatClock12From24Hour} from "../../../src/lib/clock-display";
import {ownerCalendarClock,missingWeekCellKind} from "../../../src/lib/owner-week-grid";
import {filteredOwnerCalendarDays,validOwnerScheduleDate} from "../../../src/lib/owner-schedule-management";
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

function rawTime(value:string){return ownerCalendarClock(value);}

/** Narrow pinned rail, full AM/PM under HH:mm in Week and Day. */
function CompactTimeColumn({value}:{value:string}){
  const formatted=formatClock12From24Hour(value);
  const [clock,meridiem]=formatted.split(" ");
  return <View style={styles.compactTimeLabel} accessible accessibilityLabel={formatted}>
    <AppText variant="body" weight="bold" forceLtr numberOfLines={1}
      style={styles.compactClock}>{clock}</AppText>
    {meridiem?<AppText variant="caption" weight="semibold" forceLtr
      style={styles.compactMeridiem}>{meridiem}</AppText>:null}
  </View>;
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

const slotPalette:Record<VenueCalendarEventType,{background:string;border:string;text:string}>={
  AVAILABLE:{background:"#DCFCE7",border:"#86EFAC",text:"#166534"},
  ONLINE_BOOKING:{background:"#FEE2E2",border:"#FCA5A5",text:"#991B1B"},
  MANUAL_BOOKING:{background:"#DBEAFE",border:"#93C5FD",text:"#1D4ED8"},
  COMPETITION:{background:"#FEF3C7",border:"#FCD34D",text:"#92400E"},
  BLOCKED:{background:"#E2E8F0",border:"#94A3B8",text:"#475569"},
  PROMOTION:{background:"#F3E8FF",border:"#C084FC",text:"#7E22CE"},
  CLOSED:{background:"#F1F5F9",border:"#CBD5E1",text:"#475569"},
};

const pendingSlotPalette={background:"#FEF3C7",border:"#FBBF24",text:"#92400E"};
function slotPaletteFor(event:VenueCalendarEvent){
  return event.type==="ONLINE_BOOKING"&&event.bookingStatus==="PENDING"
    ?pendingSlotPalette:slotPalette[event.type];
}
function statusColor(type:VenueCalendarEventType){
  return slotPalette[type].text;
}

function SlotCornerMarker({
  type,color,pending=false,
}:{
  type:VenueCalendarEventType;
  color:string;
  pending?:boolean;
}){
  const checked=type==="ONLINE_BOOKING"||type==="MANUAL_BOOKING"||type==="COMPETITION";
  const discounted=type==="PROMOTION";
  if(!checked&&!discounted)return null;

  return <View pointerEvents="none" style={styles.slotCornerMarker}>
    {checked
      ?<Ionicons name={pending?"hourglass-outline":"checkmark"} size={13} color={color}/>
      :<AppText variant="caption" weight="bold" style={{color,lineHeight:14}}>%</AppText>}
  </View>;
}

export default function OwnerScheduleScreen(){
  const params=useLocalSearchParams<{date?:string}>();
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const token=session?.accessToken;
  const initialDate=typeof params.date==="string"&&validOwnerScheduleDate(params.date)?params.date:todayKabul();
  const [view,setView]=useState<TimetableCalendarView>(typeof params.date==="string"?"DAY":"WEEK");
  const [anchorDate,setAnchorDate]=useState(initialDate);
  const [calendar,setCalendar]=useState<Awaited<ReturnType<typeof ownerApi.timetableCalendar>>|null>(null);
  const [loadedToken,setLoadedToken]=useState<string|null>(null);
  const [areas,setAreas]=useState<Array<{id:string;name:string}>>([]);
  const [areasToken,setAreasToken]=useState<string|null>(null);
  const [selectedAreaId,setSelectedAreaId]=useState<string|null>(null);
  const [selectedType,setSelectedType]=useState<"ALL"|VenueCalendarEventType>("ALL");
  const [renderedView,setRenderedView]=useState<TimetableCalendarView>(view);
  const [renderedAnchorDate,setRenderedAnchorDate]=useState(anchorDate);
  const [loading,setLoading]=useState(true);
  const [calendarLoading,setCalendarLoading]=useState(false);
  const calendarRequestId=useRef(0);
  const screenScrollRef=useRef<ScrollView|null>(null);
  const weekListY=useRef<number|null>(null);
  const todayWeekRowY=useRef<number|null>(null);
  const focusedWeekKey=useRef<string|null>(null);
  const todayDate=useMemo(()=>todayKabul(),[]);
  const [busy,setBusy]=useState<string|null>(null);
  const [selectedSlot,setSelectedSlot]=useState<{event:VenueCalendarEvent;date:string}|null>(null);
  const onSelectSlot=useCallback((event:VenueCalendarEvent,date:string)=>setSelectedSlot({event,date}),[]);
  const [error,setError]=useState<string|null>(null);
  const range=useMemo(()=>rangeForView(view,anchorDate,language),[view,anchorDate,language]);
  const displayedCalendar=loadedToken===token?calendar:null;
  const availableAreas=areasToken===token?areas:[];

  const changeAnchorDate=useCallback((nextDate:string)=>{
    if(nextDate===anchorDate)return;
    setCalendarLoading(true);
    setSelectedSlot(null);
    setAnchorDate(nextDate);
  },[anchorDate]);

  const changeCalendarView=useCallback((nextView:TimetableCalendarView)=>{
    if(nextView===view)return;
    setCalendarLoading(true);
    setSelectedSlot(null);
    setView(nextView);
  },[view]);

  const openCalendarDay=useCallback((date:string)=>{
    setCalendarLoading(true);
    setSelectedSlot(null);
    setAnchorDate(date);
    setView("DAY");
  },[]);

  const focusTodayWeekRow=useCallback((weekKey:string)=>{
    if(
      focusedWeekKey.current===weekKey
      ||weekListY.current===null
      ||todayWeekRowY.current===null
    )return;
    focusedWeekKey.current=weekKey;
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        if(weekListY.current===null||todayWeekRowY.current===null)return;
        screenScrollRef.current?.scrollTo({
          y:Math.max(0,weekListY.current+todayWeekRowY.current-spacing.md),
          animated:false,
        });
      });
    });
  },[]);

  const loadCalendar=useCallback(async()=>{
    if(!token)return;
    const requestId=++calendarRequestId.current;
    const requestedView=view;
    const requestedAnchorDate=anchorDate;
    setCalendarLoading(true);
    try{
      const next=await ownerApi.timetableCalendar(token,range.from,range.to,selectedAreaId);
      if(requestId!==calendarRequestId.current)return;
      weekListY.current=null;
      todayWeekRowY.current=null;
      focusedWeekKey.current=null;
      setSelectedSlot(null);
      setCalendar(next);
      setLoadedToken(token);
      setRenderedView(requestedView);
      setRenderedAnchorDate(requestedAnchorDate);
    }finally{
      if(requestId===calendarRequestId.current)setCalendarLoading(false);
    }
  },[anchorDate,range.from,range.to,token,view,selectedAreaId]);

  useEffect(()=>{
    setLoading(false);
    if(!token){setCalendar(null);setLoadedToken(null);setAreas([]);setAreasToken(null);return;}
    let live=true;
    void ownerApi.getStatus(token).then(result=>{
      if(!live)return;
      setAreas(result.venue?.areas.map(area=>({id:area.id,name:area.name}))??[]);
      setAreasToken(token);
    }).catch(()=>{if(live){setAreas([]);setAreasToken(null);}});
    return()=>{live=false;};
  },[token]); // Calendar navigation remains in place; account data is scoped.

  // Refetch on every return from another tab. Online reservations arrive
  // while this screen is blurred, so mounting once is insufficient.
  useFocusEffect(useCallback(()=>{
    void loadCalendar().catch(()=>setError(t("schedule.calendarError")));
    return ()=>{calendarRequestId.current+=1;};
  },[loadCalendar,t]));

  const onTodayRowLayout=useCallback((y:number)=>{
    todayWeekRowY.current=y;
    if(calendar?.from)focusTodayWeekRow(calendar.from);
  },[calendar?.from,focusTodayWeekRow]);

  async function refresh(){
    setError(null);
    try{await loadCalendar();}
    catch{setError(t("schedule.loadTimetableError"));}
  }

  async function confirmBooking(id:string){
    if(!token)return;
    setBusy(`event-${id}`);
    try{await ownerApi.confirmBooking(token,id);await loadCalendar();}
    catch{setError(t("schedule.approveError"));}
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

  const selectedDay=displayedCalendar?.days.find((day)=>day.date===renderedAnchorDate)??displayedCalendar?.days[0]??null;
  const visibleDays=filteredOwnerCalendarDays(displayedCalendar?.days??[],selectedType);
  const filteredSelectedDay=visibleDays.find(day=>day.date===selectedDay?.date)??null;

  return <Screen embedded scrollRef={screenScrollRef}>
    {error?<Card style={styles.errorCard}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} onPress={()=>void refresh()} variant="secondary"/>
    </Card>:null}

    <OwnerPendingBookings token={token} onChanged={()=>void refresh()}/>
    <Card>
      <View style={styles.toolbar}>
        <View style={[styles.todayRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Button label={t("schedule.today")} onPress={()=>changeAnchorDate(todayKabul())} variant="secondary" style={styles.compactButton}/>
        </View>
        <View style={[styles.navButtons,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Pressable style={styles.textNavButton} onPress={()=>changeAnchorDate(moveView(view,anchorDate,-1,language))}>
            <AppText variant="caption" weight="semibold" style={styles.textNavButtonLabel}>
              {t("schedule.previous")}
            </AppText>
          </Pressable>
          <AppText weight="bold" style={styles.rangeLabel}>
            {view==="MONTH"
              ?formatCalendarDate(anchorDate,language,{month:"long",year:"numeric"})
              :view==="DAY"
                ?formatCalendarDate(anchorDate,language,{weekday:"short",month:"short",day:"numeric",year:"numeric"})
                :`${formatCalendarDate(range.from,language)} — ${formatCalendarDate(range.to,language)}`}
          </AppText>
          <Pressable style={styles.textNavButton} onPress={()=>changeAnchorDate(moveView(view,anchorDate,1,language))}>
            <AppText variant="caption" weight="semibold" style={styles.textNavButtonLabel}>
              {t("schedule.next")}
            </AppText>
          </Pressable>
        </View>
      </View>

      {availableAreas.length>0?<View style={styles.areaSection} testID="owner-phase4-court-filter">
        <AppText variant="caption" weight="semibold">{t("owner.phase4.courtFilter")}</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chips,{flexDirection:isRTL?"row-reverse":"row"}]}>
          {[{id:null,name:t("owner.phase4.allCourts")},...availableAreas].map(area=>{
            const selected=selectedAreaId===area.id;
            return <Pressable key={area.id??"all"}
              accessibilityRole="button" accessibilityState={{selected}}
              onPress={()=>{
                if(selected)return;
                setSelectedSlot(null);setCalendarLoading(true);
                setSelectedAreaId(area.id);
              }}
              style={[styles.chip,selected&&styles.chipActive]}>
              <AppText variant="caption" weight="semibold"
                style={selected?styles.chipTextActive:undefined}>{area.name}</AppText>
            </Pressable>;
          })}
        </ScrollView>
      </View>:null}
      <View style={[styles.segmented,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {views.map((item)=><Pressable
          key={item}
          onPress={()=>changeCalendarView(item)}
          style={[styles.segment,view===item&&styles.segmentActive]}
        >
          <AppText weight="semibold" style={view===item?styles.segmentTextActive:undefined}>
            {t(`schedule.calendar.${item.toLowerCase()}` as never)}
          </AppText>
        </Pressable>)}
      </View>
      {view!=="MONTH"?<View style={styles.areaSection} testID="owner-phase4-status-filters">
        <AppText variant="caption" weight="semibold">{t("owner.phase4.statusFilter")}</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chips,{flexDirection:isRTL?"row-reverse":"row"}]}>
          {statusFilters.map(type=><Pressable key={type}
            accessibilityRole="button" accessibilityState={{selected:selectedType===type}}
            onPress={()=>{setSelectedType(type);setSelectedSlot(null);}}
            style={[styles.chip,selectedType===type&&styles.chipActive]}>
            <AppText variant="caption" weight="semibold"
              style={selectedType===type?styles.chipTextActive:undefined}>
              {type==="ALL"?t("owner.phase4.allStatuses"):t(`schedule.event.${type}` as never)}
            </AppText>
          </Pressable>)}
        </ScrollView>
      </View>:null}

    </Card>

    {!calendarLoading&&renderedView==="DAY"&&selectedDay?<Summary day={selectedDay} t={t}/>:null}

    <View
      style={styles.calendarDataArea}
      onLayout={(event)=>{
        weekListY.current=event.nativeEvent.layout.y;
        if(renderedView==="WEEK"&&displayedCalendar?.days.some((day)=>day.date===todayDate)){
          focusTodayWeekRow(displayedCalendar.from);
        }
      }}
    >
      {calendarLoading
        ?<DataLoadingState
          variant="calendar"
          minHeight={view==="MONTH"?430:view==="WEEK"?390:330}
        />
        :displayedCalendar
          ?renderedView==="MONTH"
            ?<MonthView
              days={displayedCalendar.days}
              anchorDate={renderedAnchorDate}
              language={language}
              selected={renderedAnchorDate}
              onSelect={openCalendarDay}
            />
            :renderedView==="WEEK"
              ?<MemoWeekView
                days={visibleDays}
                language={language}
                t={t}
                todayDate={todayDate}
                onTodayRowLayout={onTodayRowLayout}
                onSelectSlot={onSelectSlot}
                onOpenDay={openCalendarDay}
              />
              :<MemoDaySlotView
                day={filteredSelectedDay}
                language={language}
                t={t}
                onSelectSlot={onSelectSlot}
              />
          :<DataLoadingState variant="calendar" minHeight={330}/>} 
    </View>

    {!calendarLoading&&renderedView==="MONTH"?<Legend t={t}/>:null}

    {selectedSlot?<SlotManager
      event={selectedSlot.event}
      date={selectedSlot.date}
      language={language}
      t={t}
      busy={busy===`event-${selectedSlot.event.id}`}
      onClose={()=>setSelectedSlot(null)}
      onOpenDay={openCalendarDay}
      onConfirmBooking={(id)=>{
        setSelectedSlot(null);
        void confirmBooking(id);
      }}
      onCancelBooking={(id)=>{
        setSelectedSlot(null);
        void cancelBooking(id);
      }}
      onUnblock={(id)=>{
        setSelectedSlot(null);
        void unblock(id);
      }}
    />:null}
  </Screen>;
}

function Summary({day,t}:{day:VenueCalendarDay;t:ReturnType<typeof useLocale>["t"]}){
  const onlineCount=day.events.filter((event)=>event.type==="ONLINE_BOOKING").length;
  const metrics=[
    [t("schedule.summaryAvailable"),day.availableCount],
    [t("schedule.summaryOnline"),onlineCount],
    [t("schedule.summaryManual"),day.manualCount],
    [t("schedule.summaryCompetition"),day.competitionCount],
    [t("schedule.summaryBlocked"),day.blockedCount],
    [t("schedule.event.PROMOTION"),day.promotionCount],
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
  days,anchorDate,language,selected,onSelect,
}:{
  days:VenueCalendarDay[];
  anchorDate:string;
  language:"fa-AF"|"ps-AF"|"en";
  selected:string;
  onSelect:(date:string)=>void;
}){
  return <Card style={styles.calendarCard}>
    <View style={[styles.weekdayHeader,{flexDirection:language==="en"?"row":"row-reverse"}]}>
      {days.slice(0,7).map((day)=><View key={`weekday-${day.date}`} style={styles.weekdayHeaderCell}>
        <AppText variant="caption" weight="bold" muted numberOfLines={1}>
          {formatCalendarDate(day.date,language,{weekday:"short"})}
        </AppText>
      </View>)}
    </View>
    <View style={[styles.monthGrid,{flexDirection:language==="en"?"row":"row-reverse"}]}>
      {days.map((day)=><View key={day.date} style={styles.monthCellFrame}>
        <Pressable
          onPress={()=>onSelect(day.date)}
          style={[
            styles.monthCell,
            !isSameDisplayMonth(day.date,anchorDate,language)&&styles.monthCellMuted,
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

function WeekView({
  days,language,t,todayDate,onTodayRowLayout,onSelectSlot,onOpenDay,
}:{
  days:VenueCalendarDay[];
  language:"fa-AF"|"ps-AF"|"en";
  t:ReturnType<typeof useLocale>["t"];
  todayDate:string;
  onTodayRowLayout:(y:number)=>void;
  onSelectSlot:(event:VenueCalendarEvent,date:string)=>void;
  onOpenDay:(date:string)=>void;
}){
  const [weekHeaderHeight,setWeekHeaderHeight]=useState(68);
  const [weekRowHeights,setWeekRowHeights]=useState<Record<string,number>>({});
  const measureWeekRow=useCallback((time:string,height:number)=>{
    const rounded=Math.ceil(height);
    if(rounded<1)return;
    setWeekRowHeights(previous=>previous[time]===rounded
      ?previous:{...previous,[time]:rounded});
  },[]);
  const timeRows=Array.from(new Set(
    days.flatMap((day)=>day.events
      .filter((event)=>Boolean(event.startsAt))
      .map((event)=>rawTime(event.startsAt!))
    ),
  )).sort();

  if(!timeRows.length){
    return <Card><AppText muted>{t("schedule.noEvents")}</AppText></Card>;
  }

  return <View style={styles.weekSlotSection}>
    <SlotColorGuide t={t}/>
    <View testID="owner-week-grid" style={[styles.weekSlotFrame,
      {flexDirection:language==="en"?"row":"row-reverse"}]}>
      {/* Fixed AM/PM time rail, independent of horizontal date scrolling. */}
      <View testID="owner-week-sticky-times" style={styles.weekTimeRail}>
        <View style={[styles.weekTimeHeader,{height:weekHeaderHeight}]}>
          <Ionicons name="time-outline" size={16} color={colors.textMuted}/>
        </View>
        {timeRows.map(time=><View key={time}
          style={[styles.weekTimeCell,{height:weekRowHeights[time]??62}]}>
          <CompactTimeColumn value={time}/>
        </View>)}
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator
        testID="owner-week-scrollable-days"
        style={styles.weekSlotHorizontal}
        contentContainerStyle={styles.weekSlotScroll}
      >
        <View style={styles.weekSlotGrid}>
          <View
            onLayout={event=>{
              const height=Math.ceil(event.nativeEvent.layout.height);
              if(height>0)setWeekHeaderHeight(previous=>previous===height?previous:height);
            }}
            style={[styles.weekSlotHeader,{flexDirection:language==="en"?"row":"row-reverse"}]}>
            {days.map((day)=>{
              const isToday=day.date===todayDate;
              return <View
                key={day.date}
                onLayout={isToday?(event)=>onTodayRowLayout(event.nativeEvent.layout.y):undefined}
                style={[styles.weekDayHeader,isToday&&styles.weekDayHeaderToday]}
              >
                <AppText variant="caption" weight="bold">
                  {formatCalendarDate(day.date,language,{weekday:"short"})}
                </AppText>
                <AppText variant="caption" muted>
                  {formatCalendarDate(day.date,language,{month:"short",day:"numeric"})}
                </AppText>
                {isToday?<View style={styles.weekTodayBadge}>
                  <AppText variant="caption" weight="bold" style={styles.weekTodayBadgeText}>
                    {t("schedule.today")}
                  </AppText>
                </View>:null}
              </View>;
            })}
          </View>
          {timeRows.map(time=><View
            key={time}
            onLayout={event=>measureWeekRow(time,event.nativeEvent.layout.height)}
            style={[styles.weekSlotTimeRow,{flexDirection:language==="en"?"row":"row-reverse"}]}
          >
            {days.map((day)=>{
              const cellEvents=day.events.filter((event)=>
                Boolean(event.startsAt)&&rawTime(event.startsAt!)===time
              );
              return <View key={`${day.date}-${time}`} style={styles.weekSlotCell}>
                {cellEvents.length?cellEvents.map((event)=>{
                  const palette=slotPaletteFor(event);
                  return <Pressable
                    key={event.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${t(`schedule.event.${event.type}` as never)}${event.bookingStatus==="PENDING"?`, ${t("schedule.pendingApproval")}`:""}, ${formatSlotStartTime(event.startsAt!,"Asia/Kabul")}, ${formatSlotTilePrice(event.priceAfn)}`}
                    onPress={()=>onSelectSlot(event,day.date)}
                    style={({pressed})=>[
                      styles.weekSlot,
                      {backgroundColor:softenSlotColor(palette.background),borderColor:palette.border},
                      pressed&&styles.weekSlotPressed,
                    ]}
                  >
                    <SlotTileContent startsAt={event.startsAt!} timeZone="Asia/Kabul"
                      priceAfn={event.priceAfn} ink={palette.text}
                      marker={<SlotCornerMarker type={event.type} color={palette.text}
                    pending={event.bookingStatus==="PENDING"}/>}/>
                  </Pressable>;
                }):(()=>{
                  const kind=missingWeekCellKind(day,time);
                  const label=kind==="CLOSED"
                    ?t("schedule.event.CLOSED")
                    :kind==="CONTINUES"
                      ?t("schedule.weekSlotContinues")
                      :t("schedule.weekSlotNotScheduled");
                  return <Pressable accessibilityRole="button"
                    accessibilityLabel={`${formatCalendarDate(day.date,language,{weekday:"long"})}, ${formatClock12From24Hour(time)}, ${label}. ${t("schedule.openDay")}`}
                    testID={"owner-week-no-slot-"+day.date+"-"+time}
                    onPress={()=>onOpenDay(day.date)}
                    style={({pressed})=>[styles.weekMissingSlot,
                      kind==="CLOSED"&&styles.weekMissingClosed,
                      kind==="CONTINUES"&&styles.weekMissingContinues,
                      pressed&&styles.weekSlotPressed]}>
                    <Ionicons name={kind==="CLOSED"?"lock-closed-outline":
                      kind==="CONTINUES"?"time-outline":"remove-circle-outline"}
                      size={16} color={colors.textMuted}/>
                    <AppText variant="caption" weight="semibold"
                      style={styles.weekMissingLabel} numberOfLines={2}>{label}</AppText>
                  </Pressable>;
                })()}
              </View>;
            })}
          </View>)}
        </View>
      </ScrollView>
    </View>
  </View>;
}

function SlotColorGuide({t}:{t:ReturnType<typeof useLocale>["t"]}){
  return <Card style={styles.slotGuideCard}>
    <View style={styles.slotGuideHeader}>
      <Ionicons name="color-palette-outline" size={19} color={colors.primary}/>
      <View style={{flex:1}}>
        <AppText weight="bold">{t("schedule.slotColorGuide")}</AppText>
        <AppText variant="caption" muted>{t("schedule.slotColorGuideBody")}</AppText>
      </View>
    </View>
    <View style={styles.slotGuideItems}>
      {statusFilters.filter((item)=>item!=="ALL").map((type)=>{
        const palette=slotPalette[type];
        return <View key={type} style={styles.slotGuideItem}>
          <View style={[styles.slotGuideSwatch,{backgroundColor:palette.background,borderColor:palette.border}]}/>
          <AppText variant="caption">{t(`schedule.event.${type}` as never)}</AppText>
        </View>;
      })}
    </View>
  </Card>;
}

// Keep heavy rows mounted when opening/closing the slot management modal.
const MemoWeekView=memo(WeekView);

function SlotManager({
  event,date,language,t,busy,onClose,onOpenDay,onConfirmBooking,onCancelBooking,onUnblock,
}:{
  event:VenueCalendarEvent;
  date:string;
  language:"fa-AF"|"ps-AF"|"en";
  t:ReturnType<typeof useLocale>["t"];
  busy:boolean;
  onClose:()=>void;
  onOpenDay:(date:string)=>void;
  onConfirmBooking:(id:string)=>void;
  onCancelBooking:(id:string)=>void;
  onUnblock:(id:string)=>void;
}){
  const palette=slotPaletteFor(event);
  const navigateFromSlot=(navigate:()=>void)=>{
    onClose();
    setTimeout(navigate,0);
  };
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.slotModalOverlay} onPress={onClose}>
      <Pressable style={styles.slotModalCard} onPress={()=>{}}>
        <View style={styles.slotModalHeader}>
          <View style={[styles.slotModalIcon,{backgroundColor:palette.background,borderColor:palette.border}]}>
            <Ionicons name={eventIcon(event.type)} size={21} color={palette.text}/>
          </View>
          <View style={{flex:1}}>
            <AppText variant="bodyLarge" weight="bold">{t("schedule.manageSlot")}</AppText>
            <AppText variant="caption" muted>
              {formatCalendarDate(date,language,{weekday:"long",month:"short",day:"numeric"})}
            </AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.slotModalClose}>
            <Ionicons name="close" size={20} color={colors.text}/>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.slotModalBody}>
          <EventCard
            event={event}
            language={language}
            t={t}
            busy={busy}
            onNavigate={navigateFromSlot}
            onConfirmBooking={()=>onConfirmBooking(event.id)}
            onCancelBooking={()=>onCancelBooking(event.id)}
            onUnblock={()=>onUnblock(event.id)}
          />
          <Button
            label={t("schedule.openDay")}
            onPress={()=>onOpenDay(date)}
            variant="secondary"
          />
        </ScrollView>
      </Pressable>
    </Pressable>
  </Modal>;
}

function DaySlotView({
  day,language,t,onSelectSlot,
}:{
  day:VenueCalendarDay|null;
  language:"fa-AF"|"ps-AF"|"en";
  t:ReturnType<typeof useLocale>["t"];
  onSelectSlot:(event:VenueCalendarEvent,date:string)=>void;
}){
  const timed=(day?.events??[])
    .filter((event)=>Boolean(event.startsAt))
    .sort((a,b)=>(a.startsAt??"").localeCompare(b.startsAt??""));
  const closed=(day?.events??[]).filter((event)=>event.type==="CLOSED"&&!event.startsAt);

  return <View style={styles.daySlotSection}>
    <SlotColorGuide t={t}/>

    {day?<View style={styles.daySlotTable}>
      <View style={[styles.daySlotHeader,{flexDirection:language==="en"?"row":"row-reverse"}]}>
        <View style={styles.dayTimeHeader}>
          <Ionicons name="time-outline" size={16} color={colors.textMuted}/>
        </View>
        <View style={styles.dayHeaderCell}>
          <AppText weight="bold">
            {formatCalendarDate(day.date,language,{weekday:"long"})}
          </AppText>
          <AppText variant="caption" muted>
            {formatCalendarDate(day.date,language,{month:"long",day:"numeric"})}
          </AppText>
        </View>
      </View>

      {timed.map((event)=>{
        const palette=slotPaletteFor(event);
        return <View
          key={event.id}
          style={[styles.daySlotRow,{flexDirection:language==="en"?"row":"row-reverse"}]}
        >
          <View style={styles.dayTimeCell}>
            <CompactTimeColumn value={rawTime(event.startsAt!)}/>
          </View>
          <View style={styles.dayStatusCell}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t(`schedule.event.${event.type}` as never)}${event.bookingStatus==="PENDING"?`, ${t("schedule.pendingApproval")}`:""}, ${formatSlotStartTime(event.startsAt!,"Asia/Kabul")}, ${formatSlotTilePrice(event.priceAfn)}`}
              onPress={()=>onSelectSlot(event,day.date)}
              style={({pressed})=>[
                styles.daySlotButton,
                {backgroundColor:softenSlotColor(palette.background),borderColor:palette.border},
                pressed&&styles.weekSlotPressed,
              ]}
            >
              <SlotTileContent startsAt={event.startsAt!} timeZone="Asia/Kabul"
                priceAfn={event.priceAfn} ink={palette.text}
                marker={<SlotCornerMarker type={event.type} color={palette.text}
                    pending={event.bookingStatus==="PENDING"}/>}/>
            </Pressable>
          </View>
        </View>;
      })}

      {closed.map((event)=>{
        const palette=slotPalette.CLOSED;
        return <Pressable
          key={event.id}
          accessibilityRole="button"
          onPress={()=>onSelectSlot(event,day.date)}
          style={({pressed})=>[
            styles.dayClosedSlot,
            {backgroundColor:palette.background,borderColor:palette.border},
            pressed&&styles.weekSlotPressed,
          ]}
        >
          <Ionicons name="lock-closed-outline" size={20} color={palette.text}/>
          <View style={{flex:1}}>
            <AppText weight="bold" style={{color:palette.text}}>{t("schedule.event.CLOSED")}</AppText>
            <AppText variant="caption" style={{color:palette.text}}>{t("schedule.manageSlot")}</AppText>
          </View>
          <Ionicons name={language==="en"?"chevron-forward":"chevron-back"} size={18} color={palette.text}/>
        </Pressable>;
      })}

      {!timed.length&&!closed.length?<View style={styles.dayEmptyState}>
        <AppText muted>{t("schedule.noEvents")}</AppText>
      </View>:null}
    </View>:null}
  </View>;
}

const MemoDaySlotView=memo(DaySlotView);

function EventCard({
  event,language,t,busy,onNavigate,onConfirmBooking,onCancelBooking,onUnblock,
}:{
  event:VenueCalendarEvent;
  language:"fa-AF"|"ps-AF"|"en";
  t:ReturnType<typeof useLocale>["t"];
  busy:boolean;
  onNavigate:(navigate:()=>void)=>void;
  onConfirmBooking:()=>void;
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
        <AppText weight="bold">{t(`schedule.event.${event.type}` as never)}</AppText>
        <AppText variant="caption" muted>{event.title}</AppText>
        {event.type==="ONLINE_BOOKING"&&event.bookingStatus==="PENDING"?<View style={styles.pendingBadge}>
          <AppText variant="caption" weight="bold" style={styles.pendingBadgeText}>{t("schedule.pendingApproval")}</AppText>
        </View>:null}
      </View>
      {event.priceAfn!==null?<AppText weight="bold" forceLtr>{event.priceAfn} AFN</AppText>:null}
    </View>
    {event.startsAt&&event.endsAt?<AppText forceLtr>{formatCalendarTime(event.startsAt,language)} – {formatCalendarTime(event.endsAt,language)}</AppText>:null}
    {(event.type==="AVAILABLE"||event.type==="PROMOTION")?<View style={styles.actionGrid}>
      <Button
        label={t("schedule.addManual")}
        onPress={()=>onNavigate(()=>router.push({
          pathname:"/owner/manual-booking",
          params:{areaId:event.areaId??"",date,start,end,price:event.priceAfn!==null?String(event.priceAfn):""},
        }))}
        style={styles.actionButton}
      />
      <Button
        label={t("schedule.blockTime")}
        onPress={()=>onNavigate(()=>router.push({pathname:"/owner/block-time",params:{areaId:event.areaId??"",date,start,end}}))}
        variant="secondary"
        style={styles.actionButton}
      />
      {event.type==="AVAILABLE"?<Button
        label={t("ownerMarketing.createPromotion")}
        onPress={()=>onNavigate(()=>router.push({pathname:"/owner/promotions/create",params:{areaId:event.areaId??"",date,start}}))}
        variant="secondary"
        style={styles.actionButton}
      />:null}
    </View>:null}
    {event.type==="ONLINE_BOOKING"&&event.bookingStatus==="PENDING"?<View style={styles.actionGrid}>
      <Button
        label={t("schedule.approveBooking")}
        onPress={onConfirmBooking}
        loading={busy}
        style={styles.actionButton}
      />
      <Button
        label={t("schedule.cancelBooking")}
        onPress={onCancelBooking}
        loading={busy}
        variant="danger"
        style={styles.actionButton}
      />
    </View>:null}
    {((event.type==="ONLINE_BOOKING"&&event.bookingStatus!=="PENDING")||event.type==="MANUAL_BOOKING")?<Button
      label={t("schedule.cancelBooking")}
      onPress={onCancelBooking}
      loading={busy}
      variant="danger"
    />:null}
    {event.type==="BLOCKED"?<View style={styles.actionGrid}>
      <Button
        label={t("schedule.editBlock")}
        onPress={()=>onNavigate(()=>router.push({
          pathname:"/owner/block-time",
          params:{
            blockId:event.id,
            areaId:event.areaId??"",
            date,
            start,
            end,
            reason:event.title,
          },
        }))}
        variant="secondary"
        style={styles.actionButton}
      />
      <Button
        label={t("schedule.unblock")}
        onPress={onUnblock}
        loading={busy}
        variant="danger"
        style={styles.actionButton}
      />
    </View>:null}
    {event.type==="PROMOTION"?<Button
      label={t("schedule.managePromotions")}
      onPress={()=>onNavigate(()=>router.push("/owner/promotions"))}
      variant="secondary"
    />:null}
    {event.type==="COMPETITION"?<Button
      label={t("schedule.manageCompetitions")}
      onPress={()=>onNavigate(()=>router.push("/owner/competitions"))}
      variant="secondary"
    />:null}
    {event.type==="CLOSED"?<View style={styles.actionGrid}>
      <Button
        label={t("schedule.editWeekly")}
        onPress={()=>onNavigate(()=>router.push("/owner/timetable/weekly"))}
        variant="secondary"
        style={styles.actionButton}
      />
      <Button
        label={t("schedule.specialHours")}
        onPress={()=>onNavigate(()=>router.push("/owner/timetable/exceptions"))}
        variant="secondary"
        style={styles.actionButton}
      />
    </View>:null}
  </Card>;
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


const styles=StyleSheet.create({
  pendingBadge:{alignSelf:"flex-start",paddingHorizontal:spacing.xs,paddingVertical:2,borderRadius:radius.pill,backgroundColor:"#FEF3C7"},
  pendingBadgeText:{color:"#92400E"},
  errorCard:{borderColor:colors.danger},
  calendarDataArea:{position:"relative",minHeight:1},
  toolbar:{gap:spacing.sm},
  todayRow:{width:"100%",justifyContent:"flex-start"},
  compactButton:{minHeight:42,paddingHorizontal:spacing.md},
  navButtons:{width:"100%",alignItems:"center",gap:spacing.xs,justifyContent:"space-between"},
  textNavButton:{
    minHeight:42,
    minWidth:76,
    paddingHorizontal:spacing.sm,
    borderRadius:radius.md,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:colors.primarySoft,
  },
  textNavButtonLabel:{color:colors.primary,textAlign:"center"},
  rangeLabel:{textAlign:"center",minWidth:120,flex:1},
  segmented:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,overflow:"hidden"},
  segment:{flex:1,minHeight:42,alignItems:"center",justifyContent:"center",backgroundColor:colors.surface},
  segmentActive:{backgroundColor:colors.primarySoft},
  segmentTextActive:{color:colors.primary},
  areaSection:{gap:spacing.xs,marginTop:spacing.sm},
  chips:{gap:spacing.sm,paddingVertical:spacing.xs},
  chip:{minHeight:38,paddingHorizontal:spacing.md,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,alignItems:"center",justifyContent:"center",backgroundColor:colors.surface},
  chipActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  chipTextActive:{color:colors.primary},
  summaryGrid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  metric:{minWidth:96,flexGrow:1,padding:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surfaceMuted,gap:2},
  calendarCard:{padding:spacing.xs},
  weekdayHeader:{},
  weekdayHeaderCell:{width:"14.285714%",alignItems:"center",paddingVertical:spacing.xs,paddingHorizontal:2},
  monthGrid:{flexWrap:"wrap"},
  monthCellFrame:{width:"14.285714%",padding:2},
  monthCell:{minHeight:78,borderRadius:radius.sm,borderWidth:1,borderColor:colors.border,padding:spacing.xs,gap:2,backgroundColor:colors.surface},
  monthCellMuted:{opacity:.46},
  monthCellSelected:{borderColor:colors.primary,backgroundColor:colors.primarySoft,borderWidth:2},
  weekSlotSection:{gap:spacing.md},
  slotGuideCard:{gap:spacing.sm},
  slotGuideHeader:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  slotGuideItems:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  slotGuideItem:{flexDirection:"row",alignItems:"center",gap:spacing.xs},
  slotGuideSwatch:{width:18,height:18,borderRadius:5,borderWidth:1},
  weekSlotFrame:{width:"100%",borderWidth:1,borderColor:colors.border,
    borderRadius:radius.lg,overflow:"hidden",backgroundColor:colors.surface},
  weekTimeRail:{width:72,flexShrink:0,backgroundColor:colors.surfaceMuted},
  weekSlotHorizontal:{flex:1,minWidth:0},
  weekSlotScroll:{flexGrow:0},
  weekSlotGrid:{minWidth:938,backgroundColor:colors.surface},
  weekSlotHeader:{
    alignItems:"stretch",
    backgroundColor:colors.primarySoft,
    borderBottomWidth:1,
    borderBottomColor:colors.border,
  },
  weekTimeHeader:{
    width:72,
    minHeight:68,
    alignItems:"center",
    justifyContent:"center",
    borderBottomWidth:1,
    borderBottomColor:colors.border,
    borderRightWidth:1,
    borderLeftWidth:1,
    borderColor:colors.border,
  },
  weekDayHeader:{
    width:134,
    minHeight:68,
    alignItems:"center",
    justifyContent:"center",
    gap:2,
    padding:spacing.xs,
    borderRightWidth:1,
    borderRightColor:colors.border,
  },
  weekDayHeaderToday:{backgroundColor:"#DBEAFE"},
  weekTodayBadge:{
    paddingHorizontal:spacing.xs,
    paddingVertical:1,
    borderRadius:radius.pill,
    backgroundColor:colors.primary,
  },
  weekTodayBadgeText:{color:colors.surface},
  weekSlotTimeRow:{
    alignItems:"stretch",
    borderBottomWidth:1,
    borderBottomColor:colors.border,
  },
  weekTimeCell:{
    width:72,
    minHeight:62,
    alignItems:"center",
    justifyContent:"center",
    padding:spacing.xs,
    backgroundColor:colors.surfaceMuted,
    borderBottomWidth:1,
    borderRightWidth:1,
    borderLeftWidth:1,
    borderColor:colors.border,
  },
  weekSlotCell:{
    width:134,
    minHeight:62,
    padding:3,
    justifyContent:"center",
    gap:4,
    borderRightWidth:1,
    borderRightColor:colors.border,
    backgroundColor:colors.surface,
  },
  weekSlot:{
    position:"relative",
    minHeight:54,
    paddingHorizontal:2,
    borderRadius:radius.sm,
    borderWidth:1,
    overflow:"hidden",
    alignItems:"stretch",
    justifyContent:"center",
  },
  slotCornerMarker:{
    width:16,
    height:16,
    borderRadius:8,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:"rgba(255,255,255,0.78)",
  },
  weekSlotPressed:{opacity:.72,transform:[{scale:.98}]},
  compactTimeLabel:{alignItems:"center",justifyContent:"center",gap:1,paddingHorizontal:2},
  compactClock:{fontSize:14,lineHeight:19,textAlign:"center",writingDirection:"ltr"},
  compactMeridiem:{fontSize:10,lineHeight:14,color:colors.textMuted,
    textAlign:"center",writingDirection:"ltr"},
  // A missing schedule interval must not use the colored bookable tile.
  weekMissingSlot:{minHeight:54,borderRadius:radius.sm,borderWidth:1,
    borderColor:"#CBD5E1",backgroundColor:"#F8FAFC",
    alignItems:"center",justifyContent:"center",paddingHorizontal:3,paddingVertical:4,gap:2},
  weekMissingClosed:{backgroundColor:"#F1F5F9"},
  weekMissingContinues:{backgroundColor:"#EAF0F8"},
  weekMissingLabel:{color:colors.textMuted,textAlign:"center",fontSize:11,lineHeight:15},
  daySlotSection:{gap:spacing.md},
  daySlotTable:{
    borderWidth:1,
    borderColor:colors.border,
    borderRadius:radius.lg,
    overflow:"hidden",
    backgroundColor:colors.surface,
  },
  daySlotHeader:{
    minHeight:58,
    alignItems:"stretch",
    backgroundColor:colors.primarySoft,
    borderBottomWidth:1,
    borderBottomColor:colors.border,
  },
  dayTimeHeader:{
    width:72,
    alignItems:"center",
    justifyContent:"center",
    borderRightWidth:1,
    borderRightColor:colors.border,
  },
  dayHeaderCell:{
    flex:1,
    minWidth:0,
    justifyContent:"center",
    paddingHorizontal:spacing.md,
    paddingVertical:spacing.sm,
    gap:2,
  },
  daySlotRow:{
    alignItems:"stretch",
    borderBottomWidth:1,
    borderBottomColor:colors.border,
  },
  dayTimeCell:{
    width:72,
    minHeight:62,
    alignItems:"center",
    justifyContent:"center",
    padding:spacing.xs,
    backgroundColor:colors.surfaceMuted,
    borderRightWidth:1,
    borderRightColor:colors.border,
  },
  dayStatusCell:{
    flex:1,
    minWidth:0,
    padding:spacing.xs,
    justifyContent:"center",
  },
  daySlotButton:{
    position:"relative",
    minHeight:54,
    borderRadius:radius.md,
    borderWidth:1,
    overflow:"hidden",
    paddingHorizontal:2,
    alignItems:"stretch",
    justifyContent:"center",
  },
  dayClosedSlot:{
    minHeight:68,
    padding:spacing.md,
    borderWidth:1,
    flexDirection:"row",
    alignItems:"center",
    gap:spacing.sm,
  },
  dayEmptyState:{padding:spacing.lg,alignItems:"center"},
  slotModalOverlay:{
    flex:1,
    justifyContent:"center",
    padding:spacing.md,
    backgroundColor:colors.overlay,
  },
  slotModalCard:{
    width:"100%",
    maxWidth:560,
    maxHeight:"82%",
    alignSelf:"center",
    borderRadius:radius.lg,
    backgroundColor:colors.background,
    borderWidth:1,
    borderColor:colors.border,
    overflow:"hidden",
  },
  slotModalHeader:{
    flexDirection:"row",
    alignItems:"center",
    gap:spacing.sm,
    padding:spacing.md,
    backgroundColor:colors.surface,
    borderBottomWidth:1,
    borderBottomColor:colors.border,
  },
  slotModalIcon:{
    width:42,
    height:42,
    borderRadius:radius.md,
    borderWidth:1,
    alignItems:"center",
    justifyContent:"center",
  },
  slotModalClose:{
    width:38,
    height:38,
    borderRadius:radius.pill,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:colors.surfaceMuted,
  },
  slotModalBody:{padding:spacing.md,gap:spacing.md},
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
