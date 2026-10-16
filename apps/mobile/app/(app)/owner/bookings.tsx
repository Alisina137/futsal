import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {BookingDto,OwnerBookingListResponse,BookingSource,BookingStatus} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {AppState,Modal,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {OwnerBookingDatePicker} from "../../../src/components/owner/OwnerBookingDatePicker";
import {AppText} from "../../../src/components/ui/AppText";
import {Button} from "../../../src/components/ui/Button";
import {Card} from "../../../src/components/ui/Card";
import {DataLoadingState} from "../../../src/components/ui/DataLoadingState";
import {Screen} from "../../../src/components/ui/Screen";
import {TextField} from "../../../src/components/ui/TextField";
import {ownerApi} from "../../../src/lib/api";
import {formatLocalDateTimeParts} from "../../../src/lib/date-time";
import {ownerBookingStatusOptions,ownerBookingStatusScope,ownerBookingDateFilter,
  ownerBookingStatusThemes,ownerBookingDisplayStatus,type OwnerBookingStatusFilter}
  from "../../../src/lib/owner-bookings";
import {useAuth} from "../../../src/providers/AuthProvider";
import {useLocale} from "../../../src/providers/LocaleProvider";

type SourceFilter="ALL"|BookingSource;
type OwnerDecision={booking:BookingDto;kind:"approve"|"reject"|"cancel"};
const sourceOptions:SourceFilter[]=["ALL","ONLINE","MANUAL"];
const PAGE_SIZE=15;

export default function OwnerBookingsScreen(){
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const token=session?.accessToken;
  const userId=session?.user.id;
  const [searchText,setSearchText]=useState("");
  const [query,setQuery]=useState("");
  const [source,setSource]=useState<SourceFilter>("ALL");
  const [status,setStatus]=useState<OwnerBookingStatusFilter>("ALL");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [page,setPage]=useState(1);
  const [data,setData]=useState<OwnerBookingListResponse|null>(null);
  const [loadedToken,setLoadedToken]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [decision,setDecision]=useState<OwnerDecision|null>(null);
  const [decisionBusy,setDecisionBusy]=useState(false);
  const [actionError,setActionError]=useState<string|null>(null);
  const generation=useRef(0);
  const actionLock=useRef(false);
  const criteria=ownerBookingDateFilter(from,to);
  const scope=ownerBookingStatusScope(status);
  const safeData=loadedToken===token?data:null;
  const formatter=useMemo(()=>new Intl.NumberFormat(language),[language]);
  const nowMs=Date.now();

  useEffect(()=>{
    // A role or signed-in account switch must never retain another owner's data.
    generation.current++;
    setData(null);setLoadedToken(null);
    setSearchText("");setQuery("");setSource("ALL");setStatus("ALL");
    setFrom("");setTo("");setPage(1);setError(null);setActionError(null);
    setDecision(null);
  },[userId,token]);

  useEffect(()=>{
    const timer=setTimeout(()=>{
      setQuery(searchText.trim());setPage(1);
    },350);
    return()=>clearTimeout(timer);
  },[searchText]);

  const load=useCallback(async()=>{
    const request=++generation.current;
    if(!token||!criteria.valid){
      setData(null);setLoadedToken(null);setLoading(false);return;
    }
    setLoading(true);setError(null);
    try{
      const result=await ownerApi.listBookings(token,{
        scope,page,pageSize:PAGE_SIZE,q:query,
        ...(source!=="ALL"?{source}:{}),
        ...(status!=="ALL"&&status!=="HISTORY"?{status}:{}),
        ...(criteria.from?{from:criteria.from}:{}),
        ...(criteria.to?{to:criteria.to}:{}),
      });
      if(request!==generation.current)return;
      setData(result);setLoadedToken(token);
    }catch{
      if(request===generation.current){
        setError(t("owner.phase3.loadError"));setData(null);
      }
    }finally{
      if(request===generation.current)setLoading(false);
    }
  },[token,scope,criteria.valid,criteria.from,criteria.to,page,query,source,status,t]);

  useFocusEffect(useCallback(()=>{
    void load();
    const timer=setInterval(()=>{
      if(AppState.currentState==="active")void load();
    },30_000);
    return()=>{generation.current++;clearInterval(timer);};
  },[load]));

  const resetResults=()=>{generation.current++;setData(null);setPage(1);setError(null);};
  function clearFilters(){
    resetResults();
    setSearchText("");setQuery("");setSource("ALL");setStatus("ALL");
    setFrom("");setTo("");
  }
  async function applyDecision(){
    if(!token||!decision||actionLock.current)return;
    actionLock.current=true;setDecisionBusy(true);setActionError(null);
    const target=decision;
    const request=++generation.current;
    try{
      if(target.kind==="approve"){
        await ownerApi.confirmBooking(token,target.booking.id);
      }else{
        await ownerApi.cancelBooking(token,target.booking.id,
          t(target.kind==="reject"?"schedule.requestsRejectedReason":"owner.phase3.cancelReason"));
      }
      if(request===generation.current){
        setDecision(null);setData(null);setPage(1);
        // Reload with current criteria; focus/interval refresh are also safe.
        await load();
      }
    }catch{
      if(request===generation.current){
        setDecision(null);setActionError(t(target.kind==="approve"||target.kind==="reject"
          ?"schedule.requestsActionError":"owner.phase3.cancelError"));
        setData(null);await load();
      }
    }finally{setDecisionBusy(false);actionLock.current=false;}
  }
  const currentDecision=decision?.kind;
  const confirmTitle=currentDecision==="approve"?t("schedule.requestsApproveTitle"):
    currentDecision==="reject"?t("schedule.requestsRejectTitle"):t("owner.phase3.cancelTitle");
  const confirmDescription=currentDecision==="approve"?t("schedule.requestsApproveConfirm"):
    currentDecision==="reject"?t("schedule.requestsRejectConfirm"):t("owner.phase3.cancelConfirm");
  const actionLabel=currentDecision==="approve"?t("schedule.approveBooking"):
    currentDecision==="reject"?t("schedule.requestsReject"):t("owner.phase3.cancelBooking");

  return <Screen embedded>
    <View testID="owner-phase1-bookings" style={styles.stack}>
      <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.headingIcon}>
          <Ionicons name="receipt-outline" size={24} color={colors.primary}/>
        </View>
        <View style={{flex:1}}>
          <AppText variant="title" weight="bold">{t("owner.dashboardNav.bookings")}</AppText>
          <AppText variant="caption" muted>{t("owner.phase3.subtitle")}</AppText>
        </View>
      </View>
      {/* The former four-tab navigation has been replaced by a single,
          searchable booking directory and a clear status filter. */}
      <Card testID="owner-booking-search-filters" style={styles.filters}>
        <TextField label={t("owner.phase3.search")} value={searchText}
          placeholder={t("owner.phase3.searchHint")}
          maxLength={100} onChangeText={value=>{setSearchText(value);resetResults();}}/>
        <AppText variant="caption" weight="semibold">{t("owner.phase3.status")}</AppText>
        <View testID="owner-booking-status-filters"
          style={[styles.filterRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          {ownerBookingStatusOptions.map(value=><Chip key={value}
            testID={`owner-booking-status-${value}`}
            active={status===value}
            colorsForStatus={ownerBookingStatusThemes[value]}
            text={t(`owner.phase3.status.${value}` as never)}
            onPress={()=>{resetResults();setStatus(value);}}/>)}
        </View>
        <AppText variant="caption" weight="semibold">{t("owner.phase3.source")}</AppText>
        <View style={[styles.filterRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          {sourceOptions.map(value=><Chip key={value}
            text={t(`owner.phase3.source.${value}` as never)}
            active={source===value} onPress={()=>{resetResults();setSource(value);}}/>)}
        </View>
        <View testID="owner-booking-date-filters"
          style={[styles.dateRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <OwnerBookingDatePicker label={t("owner.phase3.from")} value={from}
            testID="owner-booking-from-date-picker"
            onChange={value=>{resetResults();setFrom(value);}}/>
          <OwnerBookingDatePicker label={t("owner.phase3.to")} value={to}
            testID="owner-booking-to-date-picker"
            onChange={value=>{resetResults();setTo(value);}}/>
        </View>
        {!criteria.valid?<AppText style={{color:colors.danger}}>
          {t("owner.phase3.invalidDates")}
        </AppText>:null}
        <View style={[styles.actionRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Button variant="ghost" label={t("owner.phase3.clearFilters")}
            onPress={clearFilters} style={{flex:1}}/>
          <Button label={t("owner.phase1.openCalendar")} variant="secondary"
            style={{flex:1}} onPress={()=>router.push("/owner/schedule")}/>
        </View>
      </Card>
      {actionError?<Card><AppText style={{color:colors.danger}}>{actionError}</AppText></Card>:null}
      {error?<Card style={styles.stack}>
        <AppText style={{color:colors.danger}}>{error}</AppText>
        <Button variant="secondary" label={t("common.retry")} onPress={()=>void load()}/>
      </Card>:null}
      {criteria.valid?<>
        <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <AppText weight="bold" variant="bodyLarge" style={{flex:1}}>
            {t("owner.phase3.results")}
          </AppText>
          <AppText variant="caption" muted>
            {safeData?`${formatter.format(safeData.total)} ${t("owner.phase3.records")}`:"—"}
          </AppText>
        </View>
        {loading&&!safeData?<DataLoadingState variant="list" minHeight={240}/>:null}
        {safeData?.bookings.length===0&&!loading&&!error?<Card>
          <AppText muted>{t("owner.phase3.empty")}</AppText>
        </Card>:null}
        {safeData?.bookings.map(booking=><BookingCard key={booking.id}
          booking={booking} nowMs={nowMs}
          onApprove={()=>setDecision({booking,kind:"approve"})}
          onReject={()=>setDecision({booking,kind:"reject"})}
          onCancel={()=>setDecision({booking,kind:"cancel"})}/>)}
        {safeData&&safeData.total>0?<View style={styles.pager}>
          <AppText variant="caption" muted style={{textAlign:"center"}}>
            {t("owner.phase3.page",{page:safeData.page,
              total:Math.max(1,Math.ceil(safeData.total/safeData.pageSize))})}
          </AppText>
          <View style={[styles.dateRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Button label={t("owner.phase3.previous")} variant="secondary"
              disabled={page<=1||loading} style={{flex:1}}
              onPress={()=>{setData(null);setPage(current=>Math.max(1,current-1));}}/>
            <Button label={t("owner.phase3.next")} variant="secondary"
              disabled={!safeData.hasMore||loading} style={{flex:1}}
              onPress={()=>{setData(null);setPage(current=>current+1);}}/>
          </View>
        </View>:null}
      </>:null}
      <Modal transparent visible={decision!==null} animationType="fade"
        onRequestClose={()=>{if(!decisionBusy)setDecision(null);}}>
        <View style={styles.overlay}>
          <Card style={styles.dialog}>
            <AppText variant="bodyLarge" weight="bold">{confirmTitle}</AppText>
            <AppText>{confirmDescription}</AppText>
            {decision?<AppText variant="caption" muted>
              {decision.booking.customerName||t("schedule.onlinePlayer")} ·
              {" "}{formatLocalDateTimeParts(decision.booking.startsAt,language).date}
              {" · "}{formatLocalDateTimeParts(decision.booking.startsAt,language).time}
            </AppText>:null}
            <View style={[styles.actionRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Button label={t("common.cancel")} variant="secondary" disabled={decisionBusy}
                onPress={()=>setDecision(null)} style={{flex:1}}/>
              <Button label={actionLabel} loading={decisionBusy}
                variant={currentDecision==="approve"?"primary":"danger"}
                onPress={()=>void applyDecision()} style={{flex:1}}/>
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  </Screen>;
}

function Chip({text,active,onPress}:{text:string;active:boolean;onPress:()=>void}){
  return <Pressable onPress={onPress} accessibilityRole="button"
    accessibilityState={{selected:active}}
    style={[styles.chip,active&&styles.selected]}>
    <AppText variant="caption" weight="semibold"
      style={active?styles.selectedText:undefined}>{text}</AppText>
  </Pressable>;
}

function BookingCard({booking,onCancel,nowMs}:{booking:BookingDto;onCancel:()=>void;nowMs:number}){
  const {t,isRTL,language}=useLocale();
  const start=formatLocalDateTimeParts(booking.startsAt,language);
  const end=formatLocalDateTimeParts(booking.endsAt,language);
  const canCancel=booking.status==="CONFIRMED"&&Date.parse(booking.startsAt)>nowMs;
  return <Card testID={`owner-phase3-booking-${booking.id}`} style={styles.bookingCard}>
    <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={{flex:1,gap:4}}>
        <AppText weight="bold" variant="bodyLarge" numberOfLines={2}>
          {booking.customerName||t("schedule.onlinePlayer")}
        </AppText>
        <AppText variant="caption" muted>{booking.areaName}</AppText>
      </View>
      <View style={styles.statusBadge}>
        <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
          {t(`owner.phase3.status.${booking.status}` as never)}
        </AppText>
      </View>
    </View>
    <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Ionicons name="calendar-outline" size={17} color={colors.primary}/>
      <AppText style={{flex:1}}>{start.date}</AppText>
    </View>
    <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Ionicons name="time-outline" size={17} color={colors.primary}/>
      <AppText forceLtr style={{flex:1}}>{start.time} – {end.time}</AppText>
    </View>
    <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <AppText variant="caption" muted>{t(`owner.phase3.source.${booking.source}` as never)}</AppText>
      <AppText style={{flex:1}} weight="semibold">
        {new Intl.NumberFormat(language).format(booking.priceAfn)} AFN
      </AppText>
    </View>
    {booking.customerPhone?<AppText variant="caption" muted forceLtr>
      {booking.customerPhone}
    </AppText>:null}
    {booking.note?<AppText variant="caption" muted>{booking.note}</AppText>:null}
    {booking.status==="CANCELLED"&&booking.cancellationReason?<AppText
      variant="caption" muted>{booking.cancellationReason}</AppText>:null}
    {canCancel?<Button variant="secondary" label={t("owner.phase3.cancelBooking")}
      onPress={onCancel}/>:null}
  </Card>;
}

const styles=StyleSheet.create({
  stack:{gap:spacing.md},
  heading:{alignItems:"center",gap:spacing.sm},
  headingIcon:{width:42,height:42,borderRadius:radius.md,
    backgroundColor:colors.primarySoft,justifyContent:"center",alignItems:"center"},
  tabs:{flexGrow:1,alignItems:"center",gap:spacing.sm,paddingVertical:spacing.sm},
  tab:{minHeight:44,minWidth:112,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.pill,alignItems:"center",justifyContent:"center",
    paddingHorizontal:spacing.md,backgroundColor:colors.surface},
  selected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  selectedText:{color:colors.primary},
  filters:{gap:spacing.sm},
  filterRow:{gap:spacing.xs,flexWrap:"wrap"},
  chip:{minHeight:42,paddingHorizontal:spacing.md,justifyContent:"center",
    borderWidth:1,borderColor:colors.border,borderRadius:radius.pill,
    backgroundColor:colors.surface},
  dateRow:{gap:spacing.sm,alignItems:"center"},
  statusBadge:{backgroundColor:colors.primarySoft,paddingHorizontal:spacing.sm,
    paddingVertical:spacing.xs,borderRadius:radius.pill},
  bookingCard:{gap:spacing.md},
  pager:{gap:spacing.md,marginTop:spacing.sm},
  overlay:{flex:1,backgroundColor:"#00000066",padding:spacing.lg,
    justifyContent:"center"},
  dialog:{gap:spacing.md,width:"100%",maxWidth:500,alignSelf:"center"},
});
