import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {BookingDto,PublicVenueDto,VenueAvailabilityResponse,VenueTimelineSlotDto} from "@leaguekick/contracts";
import {router} from "expo-router";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {Linking,Modal,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {bookingApi,venueApi} from "../../lib/api";
import {callVenueUrl,venueWhatsAppUrl} from "../../lib/venue-contact";
import {useAuth} from "../../providers/AuthProvider";
import {readAvailabilityCache,writeAvailabilityCache} from "../../lib/availability-cache";
import {addDays,formatCalendarDate,isSameDisplayMonth,moveView,rangeForView,
  todayKabul,type TimetableCalendarView} from "../../lib/timetable-calendar";
import {useLocale} from "../../providers/LocaleProvider";
import {useNetwork} from "../../providers/NetworkProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";

type DayResult={date:string;slots:VenueTimelineSlotDto[];fresh:boolean;failed:boolean};
type SelectedSlot={date:string;slot:VenueTimelineSlotDto;fresh:boolean};
const statusColors:Record<VenueTimelineSlotDto["status"],{bg:string;border:string;ink:string}>={
  AVAILABLE:{bg:"#DCFCE7",border:"#86EFAC",ink:"#166534"},
  PROMOTION:{bg:"#F3E8FF",border:"#D8B4FE",ink:"#7E22CE"},
  UNAVAILABLE:{bg:"#FEE2E2",border:"#FCA5A5",ink:"#991B1B"},
  PAST:{bg:"#E2E8F0",border:"#CBD5E1",ink:"#475569"},
  NOTICE_REQUIRED:{bg:"#FEF3C7",border:"#FDE68A",ink:"#92400E"},
};
const validIso=/^\d{4}-\d{2}-\d{2}$/;
function dayForTime(iso:string,timeZone:string){
  const p=new Intl.DateTimeFormat("en-GB",{timeZone,day:"2-digit",month:"2-digit",year:"numeric"})
    .formatToParts(new Date(iso));
  const x=Object.fromEntries(p.map(part=>[part.type,part.value]));
  return x.year+"-"+x.month+"-"+x.day;
}
function clock(iso:string,timeZone:string){
  return new Intl.DateTimeFormat("en-GB",{timeZone,hour:"2-digit",minute:"2-digit",
    hourCycle:"h23"}).format(new Date(iso));
}
function displayClock(iso:string,timeZone:string,language:"en"|"fa-AF"|"ps-AF"){
  return new Intl.DateTimeFormat(language==="en"?"en-GB":language,{
    timeZone,hour:"2-digit",minute:"2-digit",hourCycle:"h23",
  }).format(new Date(iso));
}
function asTimeline(data:VenueAvailabilityResponse):VenueTimelineSlotDto[]{
  // Backward compatibility with previously cached responses/API instances.
  return data.timeline??data.slots.map(slot=>({...slot,status:"AVAILABLE" as const}));
}
export function VenueSlotTimetable({venue,startsAt,promotionId}:{
  venue:PublicVenueDto;startsAt?:string|undefined;promotionId?:string|undefined;
}){
  const {language,isRTL,t}=useLocale(),tr=(key:string)=>t(("vd.grid."+key) as never);
  const {session}=useAuth();
  const {isOnline,apiReachable,reconnectVersion}=useNetwork();
  const connected=isOnline&&apiReachable!==false;
  const today=todayKabul(),limit=addDays(today,venue.maximumAdvanceBookingDays);
  const target=startsAt?dayForTime(startsAt,venue.timezone):today;
  const [view,setView]=useState<TimetableCalendarView>(startsAt?"DAY":"WEEK");
  const [anchor,setAnchor]=useState(validIso.test(target)?target:today);
  const [days,setDays]=useState<Record<string,DayResult>>({});
  const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  const [reload,setReload]=useState(0);
  const [selected,setSelected]=useState<SelectedSlot|null>(null);
  const [ownBookings,setOwnBookings]=useState<BookingDto[]>([]);
  const [mineError,setMineError]=useState(false);
  const [cancelConfirm,setCancelConfirm]=useState(false),[cancelBusy,setCancelBusy]=useState(false);
  const [contactError,setContactError]=useState(false);
  const callLink=callVenueUrl(venue.publicPhone);
  const whatsappLink=venueWhatsAppUrl(venue,language);
  const sequence=useRef(0);
  useEffect(()=>{
    let live=true;
    setOwnBookings([]);setMineError(false);
    if(!session||!connected)return()=>{live=false;};
    void bookingApi.mine(session.accessToken).then(result=>{
      if(live)setOwnBookings(result.bookings.filter(item=>
        item.venueId===venue.id&&item.playerUserId===session.user.id&&item.source==="ONLINE"
        &&item.status!=="CANCELLED"));
    }).catch(()=>{if(live)setMineError(true);});
    return()=>{live=false;};
  },[session?.accessToken,session?.user.id,venue.id,connected,reload,reconnectVersion]);
  function ownBooking(slot:VenueTimelineSlotDto):BookingDto|undefined{
    return ownBookings.find(item=>item.areaId===slot.areaId
      &&Date.parse(item.startsAt)===Date.parse(slot.startsAt)
      &&item.status!=="CANCELLED");
  }
  async function openContact(url:string){
    setContactError(false);
    try{await Linking.openURL(url);}catch{setContactError(true);}
  }
  async function cancelMine(){
    if(!selected||!session||!connected||cancelBusy)return;
    const own=ownBooking(selected.slot);
    if(!own||Date.parse(own.startsAt)<=Date.now())return;
    setCancelBusy(true);setError(null);
    try{
      await bookingApi.cancel(session.accessToken,own.id);
      setOwnBookings(previous=>previous.filter(item=>item.id!==own.id));
      setSelected(null);setCancelConfirm(false);setReload(value=>value+1);
    }catch{setError(tr("cancelFailed"));}
    finally{setCancelBusy(false);}
  }
  const range=useMemo(()=>rangeForView(view,anchor,language),[view,anchor,language]);
  const visibleDays=useMemo(()=>{
    if(view==="MONTH")return [] as string[];
    const count=view==="DAY"?1:7;
    return Array.from({length:count},(_,index)=>addDays(range.from,index));
  },[range.from,view]);
  const formattedRange=view==="MONTH"
    ?formatCalendarDate(anchor,language,{month:"long",year:"numeric"})
    :view==="DAY"
      ?formatCalendarDate(anchor,language,{weekday:"short",day:"numeric",month:"long",year:"numeric"})
      :formatCalendarDate(range.from,language)+" – "+formatCalendarDate(range.to,language);
  useEffect(()=>{
    if(!startsAt)return;
    const next=dayForTime(startsAt,venue.timezone);
    if(validIso.test(next)){setAnchor(next);setView("DAY");}
  },[venue.id,startsAt,venue.timezone]);
  useEffect(()=>{
    const requestId=++sequence.current;
    if(!venue.onlineBookingEnabled||view==="MONTH"){setBusy(false);setDays({});return;}
    setBusy(true);setError(null);setSelected(null);setDays({});
    void (async()=>{
      const results=await Promise.all(visibleDays.map(async(date):Promise<DayResult>=>{
        try{
          if(!connected)throw Error("offline");
          const data=await venueApi.availability(venue.id,date);
          if(data.date!==date||data.venue.id!==venue.id)throw Error("scope");
          try{await writeAvailabilityCache(data);}catch{/* Cache failures must not block live results. */}
          return {date,slots:asTimeline(data),fresh:true,failed:false};
        }catch{
          try{
            const cached=await readAvailabilityCache(venue.id,date);
            if(cached?.value.date===date&&cached.value.venue.id===venue.id)
              return {date,slots:asTimeline(cached.value),fresh:false,failed:false};
          }catch{/* Cache failures are represented as unavailable data. */}
          return {date,slots:[],fresh:false,failed:true};
        }
      }));
      if(requestId!==sequence.current)return;
      setDays(Object.fromEntries(results.map(item=>[item.date,item])));
      if(results.some(result=>result.failed))setError(tr("partialLoad"));
      setBusy(false);
    })();
    return()=>{sequence.current++;};
  },[venue.id,venue.onlineBookingEnabled,view,visibleDays.join("|"),reload,reconnectVersion,connected,t]);
  // Avoid showing the wrong slot or price after moving between days/weeks.
  const all=visibleDays.flatMap(date=>days[date]?.slots??[]);
  const timeRows=[...new Set(all.map(slot=>clock(slot.startsAt,venue.timezone)))].sort();
  const monthDays=useMemo(()=>{
    if(view!=="MONTH")return [];
    const dates:string[]=[];
    for(let d=range.from;d<=range.to&&dates.length<42;d=addDays(d,1))dates.push(d);
    return dates;
  },[view,range.from,range.to]);
  function navigate(delta:-1|1){
    const next=moveView(view,anchor,delta,language);
    if(next>limit&&delta===1)return;
    if(next<today&&delta===-1)return;
    setAnchor(next);setSelected(null);
  }
  function tap(slot:VenueTimelineSlotDto,date:string){
    const bookable=(slot.status==="AVAILABLE"||slot.status==="PROMOTION")
      &&date>=today&&date<=limit;
    const mine=ownBooking(slot);
    // The public timetable does not reveal who reserved an unavailable slot.
    // Only a separately authenticated owner-only booking read enables interaction.
    if(!bookable&&!mine)return;
    setContactError(false);setCancelConfirm(false);
    setSelected({date,slot,fresh:days[date]?.fresh===true});
  }
  function book(){
    if(!selected||!connected||!selected.fresh||!["AVAILABLE","PROMOTION"].includes(selected.slot.status)
      ||selected.date<today||selected.date>limit)return;
    const slot=selected.slot;
    // Navigate only; the booking confirmation API independently revalidates price/occupancy.
    router.push({pathname:"/booking/confirm",params:{
      venueId:venue.id,areaId:slot.areaId,venueName:venue.name,
      startsAt:slot.startsAt,endsAt:slot.endsAt,
      priceAfn:String(slot.priceAfn),timeZone:venue.timezone,
    }});
  }
  function Slot({item,date}:{item:VenueTimelineSlotDto;date:string}){
    const mine=ownBooking(item);
    const ownFuture=!!mine&&Date.parse(mine.startsAt)>Date.now();
    const palette=mine?{bg:"#DBEAFE",border:"#60A5FA",ink:"#1D4ED8"}:statusColors[item.status];
    const disabled=!mine&&!((item.status==="AVAILABLE"||item.status==="PROMOTION")
      &&date>=today&&date<=limit);
    const isTarget=(!!promotionId&&item.promotionId===promotionId)||
      (!!startsAt&&item.startsAt===startsAt);
    return <Pressable key={item.areaId+"-"+item.startsAt}
      testID={"venue-public-slot-"+date+"-"+clock(item.startsAt,venue.timezone)}
      accessibilityRole="button" accessibilityState={{disabled}}
      accessibilityLabel={
        clock(item.startsAt,venue.timezone)+", "+item.priceAfn+" AFN, "+
        (mine?tr("yourBooking"):tr("status."+item.status))}
      disabled={disabled} onPress={()=>tap(item,date)}
      style={({pressed})=>[styles.slot,{backgroundColor:palette.bg,borderColor:palette.border},
        disabled&&styles.disabledSlot,isTarget&&styles.target,pressed&&!disabled&&styles.pressed]}>
      {item.status==="PROMOTION"?<View style={styles.corner}>
        <AppText variant="caption" weight="bold" style={{color:palette.ink}}>%</AppText>
      </View>:null}
      {mine?<Ionicons name="person-circle" size={17} color={palette.ink}
        style={styles.cornerIcon}/>:
        item.status==="UNAVAILABLE"?<Ionicons name="lock-closed" size={14}
        color={palette.ink} style={styles.cornerIcon}/>:null}
      <AppText weight="bold" style={{color:palette.ink,textAlign:"center"}}>
        {displayClock(item.startsAt,venue.timezone,language)}
      </AppText>
      <AppText variant="caption" weight="semibold" forceLtr
        style={{color:palette.ink,textAlign:"center"}}>{item.priceAfn} AFN</AppText>
      {mine?<AppText variant="caption" weight="semibold"
        style={{color:palette.ink,textAlign:"center"}}>
        {tr(ownFuture?"yourBooking":"yourPastBooking")}
      </AppText>:null}
    </Pressable>;
  }
  const selectedOwn=selected?ownBooking(selected.slot):undefined;
  const selectedWhatsapp=selected?venueWhatsAppUrl(venue,language,selected.slot,!!selectedOwn):null;
  return <View style={{gap:spacing.md}}>
    <Card style={{gap:spacing.sm}}>
      <AppText variant="bodyLarge" weight="bold">{tr("contactTitle")}</AppText>
      <View style={[styles.contactRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {callLink?<Button style={styles.contactButton} variant="secondary"
          label={tr("callVenue")} icon={<Ionicons name="call-outline" size={18} color={colors.primary}/>}
          onPress={()=>void openContact(callLink)}/>:null}
        {whatsappLink?<Button style={styles.contactButton} variant="secondary"
          label={tr("whatsapp")} icon={<Ionicons name="logo-whatsapp" size={18} color={colors.primary}/>}
          onPress={()=>void openContact(whatsappLink)}/>:null}
      </View>
      {!whatsappLink?<AppText variant="caption" muted>{tr("whatsappUnavailable")}</AppText>:null}
      <AppText variant="caption" muted>{tr("contactDisclaimer")}</AppText>
      {contactError?<AppText style={{color:colors.danger}}>{tr("contactFailed")}</AppText>:null}
    </Card>
    {!venue.onlineBookingEnabled?<Card style={{gap:spacing.sm}}>
      <AppText weight="bold">{t("vd.bookingPaused")}</AppText>
      <AppText muted>{t("vd.bookingPausedBody")}</AppText>
    </Card>:<>
      <Card style={{gap:spacing.md}}>
        <View style={[styles.controlRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Button variant="secondary" label={tr("today")} onPress={()=>{
            setAnchor(today);setSelected(null);
          }}/>
          <Button variant="secondary" label={tr("refresh")} onPress={()=>{
            setSelected(null);setReload(v=>v+1);
          }}/>
          <AppText variant="caption" muted style={{flex:1,textAlign:isRTL?"left":"right"}}>
            {tr("customerView")}
          </AppText>
        </View>
        <View style={[styles.controlRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Button style={styles.controlButton} variant="secondary" label={tr("previous")}
            disabled={anchor<=today} onPress={()=>navigate(-1)}/>
          <AppText weight="bold" style={styles.rangeLabel}>{formattedRange}</AppText>
          <Button style={styles.controlButton} variant="secondary" label={tr("next")}
            disabled={anchor>=limit} onPress={()=>navigate(1)}/>
        </View>
        <View style={[styles.modes,{flexDirection:isRTL?"row-reverse":"row"}]}>
          {(["MONTH","WEEK","DAY"] as const).map(option=><Pressable key={option}
            accessibilityRole="tab" accessibilityState={{selected:view===option}}
            style={[styles.mode,view===option&&styles.modeSelected]} onPress={()=>{
              setView(option);setSelected(null);
            }}>
            <AppText weight="semibold" style={{color:view===option?colors.primary:colors.text,
              textAlign:"center"}}>{tr("view."+option)}</AppText>
          </Pressable>)}
        </View>
      </Card>
      <Card style={{gap:spacing.sm}}>
        <AppText weight="bold">{tr("legendTitle")}</AppText>
        <AppText variant="caption" muted>{tr("legendExplanation")}</AppText>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.swatch,{backgroundColor:"#DBEAFE",borderColor:"#60A5FA"}]}/>
            <AppText variant="caption">{tr("yourBooking")}</AppText>
          </View>
          {(["AVAILABLE","UNAVAILABLE","PROMOTION","NOTICE_REQUIRED","PAST"] as const).map(status=>
            <View key={status} style={styles.legendItem}>
              <View style={[styles.swatch,{backgroundColor:statusColors[status].bg,
                borderColor:statusColors[status].border}]}/>
              <AppText variant="caption">{tr("status."+status)}</AppText>
            </View>)}
        </View>
      </Card>
      {mineError?<Card style={{gap:spacing.xs}}>
        <AppText variant="caption" muted>{tr("myBookingLoadFailed")}</AppText>
        <Button variant="secondary" label={tr("refresh")} onPress={()=>setReload(value=>value+1)}/>
      </Card>:null}
      {view==="MONTH"?<Card style={{gap:spacing.md}}>
        <AppText variant="caption" muted>{tr("monthHint")}</AppText>
        <View style={styles.monthGrid}>{monthDays.map(date=><Pressable key={date}
          accessibilityRole="button" accessibilityLabel={formatCalendarDate(date,language)}
          disabled={date<today||date>limit}
          style={[styles.monthDay,date===today&&styles.monthToday,
            (!isSameDisplayMonth(date,anchor,language)||date<today||date>limit)&&styles.dim]}
          onPress={()=>{setAnchor(date);setView("DAY");}}>
          <AppText variant="caption" weight={date===today?"bold":"regular"}
            style={{color:date===today?colors.primary:colors.text}}>
            {formatCalendarDate(date,language,{day:"numeric"})}
          </AppText>
        </Pressable>)}</View>
      </Card>:<>
        {!connected?<Card><AppText style={{color:colors.warning}}>{tr("offlineNote")}</AppText></Card>:null}
        {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
          <Button variant="secondary" label={t("common.retry")}
            onPress={()=>setReload(v=>v+1)}/></Card>:null}
        {busy?<DataLoadingState variant="calendar" minHeight={340}/>:view==="DAY"?<>
          {visibleDays.map(date=><View key={date} style={{gap:spacing.sm}}>
            <AppText variant="bodyLarge" weight="bold">{formatCalendarDate(date,language,{
              weekday:"long",month:"long",day:"numeric"})}</AppText>
            <View style={styles.dayGrid}>{(days[date]?.slots??[]).map(item=>
              <View key={item.areaId+"-"+item.startsAt} style={styles.dayCell}>
                <Slot item={item} date={date}/>
              </View>)}</View>
            {(!days[date]||days[date].slots.length===0)?<Card>
              <AppText muted>{tr("noScheduledSlots")}</AppText>
            </Card>:null}
          </View>)}
        </>:timeRows.length?<>
          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator
            style={{flexGrow:0}} contentContainerStyle={{flexGrow:0}}>
            <View>
              <View style={[styles.gridRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <View style={styles.timeHeading}><Ionicons name="time-outline" size={19}
                  color={colors.textMuted}/></View>
                {visibleDays.map(date=><Pressable key={date}
                  style={[styles.dayHeading,date===today&&styles.todayHeading]}
                  onPress={()=>{setAnchor(date);setView("DAY");}}>
                  <AppText variant="caption" weight="bold" style={{textAlign:"center"}}>
                    {formatCalendarDate(date,language,{weekday:"short"})}
                  </AppText>
                  <AppText variant="caption" muted>{formatCalendarDate(date,language,{day:"numeric",month:"short"})}</AppText>
                  {date===today?<AppText variant="caption" weight="semibold"
                    style={{color:colors.primary}}>{tr("today")}</AppText>:null}
                </Pressable>)}
              </View>
              {timeRows.map(time=><View key={time}
                style={[styles.gridRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <View style={styles.timeCell}><AppText variant="caption" weight="semibold"
                  forceLtr>{time}</AppText></View>
                {visibleDays.map(date=>{
                  const found=days[date]?.slots.filter(x=>clock(x.startsAt,venue.timezone)===time)??[];
                  return <View key={date+"-"+time} style={styles.weekCell}>
                    {found.map(item=><Slot key={item.areaId+"-"+item.startsAt} item={item} date={date}/>)}
                  </View>;
                })}
              </View>)}
            </View>
          </ScrollView>
        </>:<Card><AppText muted>{tr("noScheduledSlots")}</AppText></Card>}

      </>}
    </>}
    <Modal transparent visible={!!selected} animationType="fade"
      onRequestClose={()=>{if(!cancelBusy){setSelected(null);setCancelConfirm(false);}}}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button"
          accessibilityLabel={tr("close")} onPress={()=>{if(!cancelBusy){setSelected(null);setCancelConfirm(false);}}}/>
        {selected?<View style={styles.modalPanel}>
          <View style={[styles.modalHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <AppText variant="bodyLarge" weight="bold">{tr(selectedOwn?"yourBooking":"selectedSlot")}</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel={tr("close")}
              disabled={cancelBusy} onPress={()=>{setSelected(null);setCancelConfirm(false);}}>
              <Ionicons name="close-circle" size={29} color={colors.textMuted}/>
            </Pressable>
          </View>
          <AppText weight="semibold">{formatCalendarDate(selected.date,language,{
            weekday:"long",day:"numeric",month:"long"})}</AppText>
          <AppText variant="title" weight="bold" style={{color:colors.primary}}>
            {displayClock(selected.slot.startsAt,venue.timezone,language)+" – "+
              displayClock(selected.slot.endsAt,venue.timezone,language)}
          </AppText>
          <AppText weight="bold">{selectedOwn?selectedOwn.priceAfn:selected.slot.priceAfn} AFN</AppText>
          <AppText muted>{selectedOwn
            ?tr(selectedOwn.status==="PENDING"?"myPending":"myConfirmed")
            :tr("status."+selected.slot.status)}</AppText>
          {selected.slot.originalPriceAfn!==null&&!selectedOwn?<AppText variant="caption" muted
            style={{textDecorationLine:"line-through"}}>
            {selected.slot.originalPriceAfn} AFN
          </AppText>:null}
          {selectedOwn?<>
            <AppText variant="caption" muted>{selectedOwn.cancellationPolicySnapshot}</AppText>
            {Date.parse(selectedOwn.startsAt)>Date.now()?
              cancelConfirm?<Card style={{gap:spacing.sm}}>
                <AppText style={{color:colors.danger}}>{tr("cancelConfirm")}</AppText>
                <Button label={tr("cancelReservation")} variant="danger"
                  loading={cancelBusy} disabled={!connected} onPress={()=>void cancelMine()}/>
                <Button label={tr("keepReservation")} variant="secondary"
                  disabled={cancelBusy} onPress={()=>setCancelConfirm(false)}/>
              </Card>:<Button label={tr("cancelReservation")} variant="secondary"
                disabled={!connected} onPress={()=>setCancelConfirm(true)}/>:null}
          </>:selected.fresh&&connected&&["AVAILABLE","PROMOTION"].includes(selected.slot.status)?
            <Button label={t("booking.bookNow")} onPress={book}/>:
            <AppText variant="caption" muted>{tr("notBookable")}</AppText>}
          <View style={[styles.contactRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
            {callLink?<Button style={styles.contactButton} variant="secondary"
              label={tr("callVenue")} onPress={()=>void openContact(callLink)}/>:null}
            {selectedWhatsapp?<Button style={styles.contactButton} variant="secondary"
              label={tr("whatsapp")} onPress={()=>void openContact(selectedWhatsapp)}/>:null}
          </View>
          <AppText variant="caption" muted>{tr("contactDisclaimer")}</AppText>
          {contactError?<AppText variant="caption" style={{color:colors.danger}}>
            {tr("contactFailed")}</AppText>:null}
          {error?<AppText variant="caption" style={{color:colors.danger}}>{error}</AppText>:null}
          <Button label={tr("close")} variant="ghost" onPress={()=>{setSelected(null);setCancelConfirm(false);}}/>
        </View>:null}
      </View>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  controlRow:{alignItems:"center",gap:spacing.sm},
  controlButton:{minWidth:75,paddingHorizontal:spacing.sm},
  rangeLabel:{flex:1,minWidth:0,textAlign:"center"},
  modes:{borderRadius:radius.md,borderWidth:1,borderColor:colors.border,overflow:"hidden"},
  mode:{minHeight:46,flex:1,paddingHorizontal:spacing.xs,alignItems:"center",
    justifyContent:"center",backgroundColor:colors.surface},
  modeSelected:{backgroundColor:colors.primarySoft},
  legend:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  legendItem:{flexDirection:"row",alignItems:"center",gap:spacing.xs},
  swatch:{width:22,height:22,borderRadius:5,borderWidth:1},
  gridRow:{alignItems:"stretch"},
  timeHeading:{width:67,minHeight:80,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:colors.border},
  dayHeading:{width:124,minHeight:80,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center",gap:3,borderWidth:1,borderColor:colors.border},
  todayHeading:{backgroundColor:"#DBEAFE"},
  timeCell:{width:67,minHeight:92,justifyContent:"center",alignItems:"center",
    backgroundColor:"#EFF6FF",borderWidth:1,borderColor:colors.border},
  weekCell:{width:124,minHeight:92,padding:4,borderWidth:1,borderColor:colors.border,
    gap:3,justifyContent:"center",backgroundColor:colors.surface},
  slot:{minHeight:78,borderRadius:radius.md,borderWidth:1,justifyContent:"center",
    alignItems:"center",gap:4,paddingHorizontal:spacing.xs,position:"relative"},
  target:{borderWidth:2,borderColor:colors.primary},
  pressed:{opacity:0.68},
  disabledSlot:{opacity:0.72},
  contactRow:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  contactButton:{flexGrow:1,minWidth:125},
  modalBackdrop:{flex:1,backgroundColor:"rgba(9,22,47,0.72)",
    alignItems:"center",justifyContent:"center",padding:spacing.md},
  modalPanel:{width:"100%",maxWidth:480,maxHeight:"90%",backgroundColor:colors.surface,
    borderRadius:radius.lg,padding:spacing.lg,gap:spacing.sm},
  modalHeading:{justifyContent:"space-between",alignItems:"center"},
  corner:{position:"absolute",top:2,left:5},
  cornerIcon:{position:"absolute",top:2,left:5},
  dayGrid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  dayCell:{width:"48%",minWidth:0},
  monthGrid:{flexDirection:"row",flexWrap:"wrap",gap:3},
  monthDay:{width:"13.65%",minHeight:48,backgroundColor:colors.surfaceMuted,
    borderRadius:radius.sm,alignItems:"center",justifyContent:"center"},
  monthToday:{backgroundColor:colors.primarySoft,borderWidth:1,borderColor:colors.primary},
  dim:{opacity:.42},
});