import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type {
  VenueCalendarDay,
  VenueCalendarEvent,
  VenueCalendarEventType,
} from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ownerApi } from "../../../src/lib/api";
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

const slotPalette:Record<VenueCalendarEventType,{background:string;border:string;text:string}>={
  AVAILABLE:{background:"#DCFCE7",border:"#86EFAC",text:"#166534"},
  ONLINE_BOOKING:{background:"#FEE2E2",border:"#FCA5A5",text:"#991B1B"},
  MANUAL_BOOKING:{background:"#DBEAFE",border:"#93C5FD",text:"#1D4ED8"},
  COMPETITION:{background:"#FEF3C7",border:"#FCD34D",text:"#92400E"},
  BLOCKED:{background:"#E2E8F0",border:"#94A3B8",text:"#475569"},
  PROMOTION:{background:"#F3E8FF",border:"#C084FC",text:"#7E22CE"},
  CLOSED:{background:"#F1F5F9",border:"#CBD5E1",text:"#64748B"},
};

function statusColor(type:VenueCalendarEventType){
  return slotPalette[type].text;
}

export default function OwnerScheduleScreen(){
  const params=useLocalSearchParams<{date?:string}>();
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const token=session?.accessToken;
  const initialDate=typeof params.date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(params.date)?params.date:todayKabul();
  const [view,setView]=useState<TimetableCalendarView>(typeof params.date==="string"?"DAY":"WEEK");
  const [anchorDate,setAnchorDate]=useState(initialDate);
  const [calendar,setCalendar]=useState<Awaited<ReturnType<typeof ownerApi.timetableCalendar>>|null>(null);
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
  const [selectedSlot,setSelectedSlot]=useState<VenueCalendarEvent|null>(null);
  const [error,setError]=useState<string|null>(null);
  const range=useMemo(()=>rangeForView(view,anchorDate,language),[view,anchorDate,language]);

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
      const next=await ownerApi.timetableCalendar(token,range.from,range.to,null);
      if(requestId!==calendarRequestId.current)return;
      weekListY.current=null;
      todayWeekRowY.current=null;
      focusedWeekKey.current=null;
      setSelectedSlot(null);
      setCalendar(next);
      setRenderedView(requestedView);
      setRenderedAnchorDate(requestedAnchorDate);
    }finally{
      if(requestId===calendarRequestId.current)setCalendarLoading(false);
    }
  },[anchorDate,range.from,range.to,token,view]);

  useEffect(()=>{
    setLoading(false);
  },[token]); // Initial page shell only; calendar changes stay in-place.

  useEffect(()=>{
    void loadCalendar().catch(()=>setError(t("schedule.calendarError")));
  },[loadCalendar,t]);

  async function refresh(){
    setError(null);
    try{await loadCalendar();}
    catch{setError(t("schedule.loadTimetableError"));}
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

  const selectedDay=calendar?.days.find((day)=>day.date===renderedAnchorDate)??calendar?.days[0]??null;

  return <Screen embedded scrollRef={screenScrollRef}>
    {error?<Card style={styles.errorCard}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} onPress={()=>void refresh()} variant="secondary"/>
    </Card>:null}

    <Card>
      <View style={[styles.toolbar,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Button label={t("schedule.today")} onPress={()=>setAnchorDate(todayKabul())} variant="secondary" style={styles.compactButton}/>
        <View style={[styles.navButtons,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Pressable style={styles.iconButton} onPress={()=>setAnchorDate(moveView(view,anchorDate,-1,language))}>
            <Ionicons name={isRTL?"chevron-forward":"chevron-back"} size={20} color={colors.primary}/>
          </Pressable>
          <AppText weight="bold" style={styles.rangeLabel}>
            {view==="MONTH"
              ?formatCalendarDate(anchorDate,language,{month:"long",year:"numeric"})
              :view==="DAY"
                ?formatCalendarDate(anchorDate,language,{weekday:"short",month:"short",day:"numeric",year:"numeric"})
                :`${formatCalendarDate(range.from,language)} — ${formatCalendarDate(range.to,language)}`}
          </AppText>
          <Pressable style={styles.iconButton} onPress={()=>setAnchorDate(moveView(view,anchorDate,1,language))}>
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

    </Card>

    {renderedView==="DAY"&&selectedDay?<Summary day={selectedDay} t={t}/>:null}

    <View
      style={styles.calendarDataArea}
      onLayout={(event)=>{
        weekListY.current=event.nativeEvent.layout.y;
        if(renderedView==="WEEK"&&calendar?.days.some((day)=>day.date===todayDate)){
          focusTodayWeekRow(calendar.from);
        }
      }}
    >
      {calendar?
        renderedView==="MONTH"
          ?<MonthView
            days={calendar.days}
            anchorDate={renderedAnchorDate}
            language={language}
            selected={renderedAnchorDate}
            onSelect={(date)=>{setAnchorDate(date);setView("DAY");}}
          />
          :renderedView==="WEEK"
            ?<WeekView
              days={calendar.days}
              language={language}
              t={t}
              todayDate={todayDate}
              onTodayRowLayout={(y)=>{
                todayWeekRowY.current=y;
                focusTodayWeekRow(calendar.from);
              }}
              onSelectSlot={setSelectedSlot}
            />
            :<DaySlotView
              day={selectedDay}
              language={language}
              t={t}
              onSelectSlot={setSelectedSlot}
            />
        :<DataLoadingState variant="list" minHeight={320}/>}
      {calendarLoading&&calendar?<View pointerEvents="none" style={styles.calendarRefreshIndicator}>
        <ActivityIndicator size="small" color={colors.primary}/>
      </View>:null}
    </View>

    {renderedView==="MONTH"?<Legend t={t}/>:null}

    {selectedSlot?<SlotManager
      event={selectedSlot}
      language={language}
      t={t}
      busy={busy===`event-${selectedSlot.id}`}
      onClose={()=>setSelectedSlot(null)}
      onOpenDay={(date)=>{
        setSelectedSlot(null);
        setAnchorDate(date);
        setView("DAY");
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
  days,language,t,todayDate,onTodayRowLayout,onSelectSlot,
}:{
  days:VenueCalendarDay[];
  language:"fa-AF"|"ps-AF"|"en";
  t:ReturnType<typeof useLocale>["t"];
  todayDate:string;
  onTodayRowLayout:(y:number)=>void;
  onSelectSlot:(event:VenueCalendarEvent)=>void;
}){
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
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator
      contentContainerStyle={styles.weekSlotScroll}
    >
      <View style={styles.weekSlotGrid}>
        <View style={[styles.weekSlotHeader,{flexDirection:language==="en"?"row":"row-reverse"}]}>
          <View style={styles.weekTimeHeader}>
            <Ionicons name="time-outline" size={16} color={colors.textMuted}/>
          </View>
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

        {timeRows.map((time)=><View
          key={time}
          style={[styles.weekSlotTimeRow,{flexDirection:language==="en"?"row":"row-reverse"}]}
        >
          <View style={styles.weekTimeCell}>
            <AppText variant="caption" weight="semibold" forceLtr>{time}</AppText>
          </View>

          {days.map((day)=>{
            const cellEvents=day.events.filter((event)=>
              Boolean(event.startsAt)&&rawTime(event.startsAt!)===time
            );
            return <View key={`${day.date}-${time}`} style={styles.weekSlotCell}>
              {cellEvents.length?cellEvents.map((event)=>{
                const palette=slotPalette[event.type];
                return <Pressable
                  key={event.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${t(`schedule.event.${event.type}` as never)}, ${time}, ${event.priceAfn??0} AFN`}
                  onPress={()=>onSelectSlot(event)}
                  style={({pressed})=>[
                    styles.weekSlot,
                    {backgroundColor:palette.background,borderColor:palette.border},
                    pressed&&styles.weekSlotPressed,
                  ]}
                >
                  <AppText weight="bold" forceLtr style={{color:palette.text}}>
                    {formatCalendarTime(event.startsAt!,language)}
                  </AppText>
                  <AppText variant="caption" weight="semibold" forceLtr style={{color:palette.text}}>
                    {event.priceAfn!==null?`${event.priceAfn} AFN`:"—"}
                  </AppText>
                </Pressable>;
              }):<View style={styles.weekEmptySlot}/>}
            </View>;
          })}
        </View>)}
      </View>
    </ScrollView>
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

function SlotManager({
  event,language,t,busy,onClose,onOpenDay,onCancelBooking,onUnblock,
}:{
  event:VenueCalendarEvent;
  language:"fa-AF"|"ps-AF"|"en";
  t:ReturnType<typeof useLocale>["t"];
  busy:boolean;
  onClose:()=>void;
  onOpenDay:(date:string)=>void;
  onCancelBooking:(id:string)=>void;
  onUnblock:(id:string)=>void;
}){
  const date=event.startsAt?localDateFromIso(event.startsAt):todayKabul();
  const palette=slotPalette[event.type];
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
  onSelectSlot:(event:VenueCalendarEvent)=>void;
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
        const palette=slotPalette[event.type];
        return <View
          key={event.id}
          style={[styles.daySlotRow,{flexDirection:language==="en"?"row":"row-reverse"}]}
        >
          <View style={styles.dayTimeCell}>
            <AppText variant="caption" weight="semibold" forceLtr>
              {formatCalendarTime(event.startsAt!,language)}
            </AppText>
          </View>
          <View style={styles.dayStatusCell}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t(`schedule.event.${event.type}` as never)}, ${formatCalendarTime(event.startsAt!,language)}, ${event.priceAfn??0} AFN`}
              onPress={()=>onSelectSlot(event)}
              style={({pressed})=>[
                styles.daySlotButton,
                {backgroundColor:palette.background,borderColor:palette.border},
                pressed&&styles.weekSlotPressed,
              ]}
            >
              <View style={styles.daySlotButtonTop}>
                <View style={{flex:1,minWidth:0}}>
                  <AppText weight="bold" style={{color:palette.text}}>
                    {t(`schedule.event.${event.type}` as never)}
                  </AppText>
                  <AppText variant="caption" muted={false} numberOfLines={1} style={{color:palette.text}}>
                    {event.title}
                  </AppText>
                </View>
                <Ionicons name={eventIcon(event.type)} size={19} color={palette.text}/>
              </View>
              <View style={styles.daySlotButtonBottom}>
                <AppText variant="caption" forceLtr style={{color:palette.text}}>
                  {event.startsAt&&event.endsAt
                    ?`${formatCalendarTime(event.startsAt,language)} – ${formatCalendarTime(event.endsAt,language)}`
                    :""}
                </AppText>
                <AppText weight="bold" forceLtr style={{color:palette.text}}>
                  {event.priceAfn!==null?`${event.priceAfn} AFN`:"—"}
                </AppText>
              </View>
            </Pressable>
          </View>
        </View>;
      })}

      {closed.map((event)=>{
        const palette=slotPalette.CLOSED;
        return <Pressable
          key={event.id}
          accessibilityRole="button"
          onPress={()=>onSelectSlot(event)}
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
        <AppText weight="bold">{t(`schedule.event.${event.type}` as never)}</AppText>
        <AppText variant="caption" muted>{event.title}</AppText>
      </View>
      {event.priceAfn!==null?<AppText weight="bold" forceLtr>{event.priceAfn} AFN</AppText>:null}
    </View>
    {event.startsAt&&event.endsAt?<AppText forceLtr>{formatCalendarTime(event.startsAt,language)} – {formatCalendarTime(event.endsAt,language)}</AppText>:null}
    {(event.type==="AVAILABLE"||event.type==="PROMOTION")?<View style={styles.actionGrid}>
      <Button
        label={t("schedule.addManual")}
        onPress={()=>router.push({pathname:"/owner/manual-booking",params:{areaId:event.areaId??"",date,start,end,price:event.priceAfn!==null?String(event.priceAfn):""}})}
        style={styles.actionButton}
      />
      <Button
        label={t("schedule.blockTime")}
        onPress={()=>router.push({pathname:"/owner/block-time",params:{areaId:event.areaId??"",date,start,end}})}
        variant="secondary"
        style={styles.actionButton}
      />
      {event.type==="AVAILABLE"?<Button
        label={t("ownerMarketing.createPromotion")}
        onPress={()=>router.push({pathname:"/owner/promotions/create",params:{areaId:event.areaId??"",date,start}})}
        variant="secondary"
        style={styles.actionButton}
      />:null}
    </View>:null}
    {(event.type==="ONLINE_BOOKING"||event.type==="MANUAL_BOOKING")?<Button
      label={t("schedule.cancelBooking")}
      onPress={onCancelBooking}
      loading={busy}
      variant="danger"
    />:null}
    {event.type==="BLOCKED"?<View style={styles.actionGrid}>
      <Button
        label={t("schedule.editBlock")}
        onPress={()=>router.push({
          pathname:"/owner/block-time",
          params:{
            blockId:event.id,
            areaId:event.areaId??"",
            date,
            start,
            end,
            reason:event.title,
          },
        })}
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
      onPress={()=>router.push("/owner/promotions")}
      variant="secondary"
    />:null}
    {event.type==="COMPETITION"?<Button
      label={t("schedule.manageCompetitions")}
      onPress={()=>router.push("/owner/competitions")}
      variant="secondary"
    />:null}
    {event.type==="CLOSED"?<View style={styles.actionGrid}>
      <Button
        label={t("schedule.editWeekly")}
        onPress={()=>router.push("/owner/timetable/weekly")}
        variant="secondary"
        style={styles.actionButton}
      />
      <Button
        label={t("schedule.specialHours")}
        onPress={()=>router.push("/owner/timetable/exceptions")}
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
  errorCard:{borderColor:colors.danger},
  calendarDataArea:{position:"relative",minHeight:1},
  calendarRefreshIndicator:{
    position:"absolute",
    top:spacing.sm,
    right:spacing.sm,
    width:34,
    height:34,
    borderRadius:17,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:colors.surface,
    borderWidth:1,
    borderColor:colors.border,
  },
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
  weekSlotScroll:{paddingBottom:spacing.xs},
  weekSlotGrid:{
    minWidth:1010,
    borderWidth:1,
    borderColor:colors.border,
    borderRadius:radius.lg,
    overflow:"hidden",
    backgroundColor:colors.surface,
  },
  weekSlotHeader:{
    alignItems:"stretch",
    backgroundColor:colors.primarySoft,
    borderBottomWidth:1,
    borderBottomColor:colors.border,
  },
  weekTimeHeader:{
    width:70,
    minHeight:68,
    alignItems:"center",
    justifyContent:"center",
    borderRightWidth:1,
    borderRightColor:colors.border,
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
    width:70,
    minHeight:52,
    alignItems:"center",
    justifyContent:"center",
    padding:spacing.xs,
    backgroundColor:colors.surfaceMuted,
    borderRightWidth:1,
    borderRightColor:colors.border,
  },
  weekSlotCell:{
    width:134,
    minHeight:52,
    padding:4,
    justifyContent:"center",
    gap:4,
    borderRightWidth:1,
    borderRightColor:colors.border,
    backgroundColor:colors.surface,
  },
  weekSlot:{
    minHeight:40,
    paddingHorizontal:spacing.xs,
    paddingVertical:5,
    borderRadius:radius.sm,
    borderWidth:1,
    alignItems:"center",
    justifyContent:"center",
  },
  weekSlotPressed:{opacity:.72,transform:[{scale:.98}]},
  weekEmptySlot:{minHeight:40},
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
    width:78,
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
    width:78,
    minHeight:70,
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
    minHeight:60,
    borderRadius:radius.md,
    borderWidth:1,
    paddingHorizontal:spacing.sm,
    paddingVertical:spacing.xs,
    gap:spacing.xs,
  },
  daySlotButtonTop:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  daySlotButtonBottom:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:spacing.sm},
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
