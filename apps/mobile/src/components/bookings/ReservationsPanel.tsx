import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {BookingDto} from "@leaguekick/contracts";
import {router} from "expo-router";
import {useMemo,useState} from "react";
import {Modal,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {formatCalendarDate} from "../../lib/timetable-calendar";
import {formatSlotStartTime} from "../../lib/slot-display";
import {displayReservations,reservationCounts,reservationDateKey,
  reservationGroup,reservationGroups,type ReservationGroup} from "../../lib/reservation-view";
import {useLocale} from "../../providers/LocaleProvider";
import {useNetwork} from "../../providers/NetworkProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";

type Props={
  items:readonly BookingDto[];
  loading:boolean;
  error:string|null;
  onRefresh:()=>void;
  onCancel:(bookingId:string)=>Promise<void>;
  scopedVenueId?:string;
};

const statePalette={
  UPCOMING:{background:"#E7F0FF",ink:"#1D4ED8",border:"#BFDBFE",icon:"calendar-outline"},
  PENDING:{background:"#FEF3C7",ink:"#92400E",border:"#FDE68A",icon:"hourglass-outline"},
  COMPLETED:{background:"#DCFCE7",ink:"#166534",border:"#BBF7D0",icon:"checkmark-circle-outline"},
  CANCELLED:{background:"#F1F5F9",ink:"#475569",border:"#CBD5E1",icon:"close-circle-outline"},
} as const;

const iconSize=19;
function bookingDate(iso:string,language:"en"|"fa-AF"|"ps-AF"){
  const day=reservationDateKey(iso);
  return day?formatCalendarDate(day,language,{
    weekday:"short",year:"numeric",month:"short",day:"numeric",
  }):"—";
}
function bookingTime(iso:string){return formatSlotStartTime(iso,"Asia/Kabul");}

export function ReservationsPanel({items,loading,error,onRefresh,onCancel,scopedVenueId}:Props){
  const {t,language,isRTL}=useLocale();
  const {isOnline,apiReachable}=useNetwork();
  const tr=(key:string)=>t(("booking.reserves."+key) as never);
  const [filter,setFilter]=useState<ReservationGroup>("ALL");
  const [expandedId,setExpandedId]=useState<string|null>(null);
  const [cancelTarget,setCancelTarget]=useState<BookingDto|null>(null);
  const [cancelBusy,setCancelBusy]=useState(false);
  const [cancelError,setCancelError]=useState<string|null>(null);
  const now=Date.now();
  const counts=useMemo(()=>reservationCounts(items,now),[items,now]);
  const visible=useMemo(()=>displayReservations(items,filter,now),[items,filter,now]);
  const canNetwork=isOnline&&apiReachable!==false;
  const rtlRow={flexDirection:isRTL?"row-reverse" as const:"row" as const};
  const openVenue=(item:BookingDto,available=false)=>{
    router.push({pathname:"/venues/[venueId]",params:{
      venueId:item.venueId,...(available?{focusAvailability:"1"}:{}),
    }});
  };
  function requestCancel(item:BookingDto){
    if(!canNetwork||cancelBusy||item.status==="CANCELLED"||Date.parse(item.startsAt)<=Date.now())return;
    setCancelError(null);
    setCancelTarget(item);
  }
  async function confirmCancel(){
    const target=cancelTarget;
    if(!target||!canNetwork||cancelBusy||Date.parse(target.startsAt)<=Date.now())return;
    setCancelBusy(true);setCancelError(null);
    try{
      await onCancel(target.id);
      setCancelTarget(null);
      setExpandedId(null);
    }catch{
      setCancelError(t("booking.cancelError"));
    }finally{setCancelBusy(false);}
  }
  return <View testID="my-reservations-panel" style={styles.root}>
    <View style={[styles.heading,rtlRow]}>
      <View style={styles.headingIcon}>
        <Ionicons name="ticket-outline" color={colors.primary} size={27}/>
      </View>
      <View style={styles.headingCopy}>
        <AppText variant="title" weight="bold">{t("booking.myBookings")}</AppText>
        <AppText variant="caption" muted>{tr("subtitle")}</AppText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={tr("refresh")}
        disabled={loading} onPress={onRefresh}
        style={({pressed})=>[styles.refresh,pressed&&styles.pressed]}>
        <Ionicons name="refresh" color={colors.primary} size={23}/>
      </Pressable>
    </View>
    <View style={[styles.summary,rtlRow]}>
      {(["UPCOMING","PENDING","COMPLETED"] as const).map(group=>{
        const palette=statePalette[group];
        return <Pressable key={group} accessibilityRole="button"
          accessibilityLabel={tr(group)+": "+counts[group]}
          onPress={()=>setFilter(group)}
          style={({pressed})=>[styles.summaryCard,
            {borderColor:filter===group?palette.ink:colors.border},
            pressed&&styles.pressed]}>
          <View style={[styles.summaryIcon,{backgroundColor:palette.background}]}>
            <Ionicons name={palette.icon} size={iconSize} color={palette.ink}/>
          </View>
          <AppText variant="title" weight="bold" style={{color:palette.ink}}>{counts[group]}</AppText>
          <AppText variant="caption" muted style={styles.summaryLabel}>{tr(group)}</AppText>
        </Pressable>;
      })}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      style={styles.filterScroll} contentContainerStyle={[styles.filterRow,rtlRow]}>
      {reservationGroups.map(group=><Pressable key={group}
        accessibilityRole="tab" accessibilityState={{selected:filter===group}}
        onPress={()=>setFilter(group)}
        style={({pressed})=>[styles.filterChip,
          filter===group&&styles.filterChipActive,pressed&&styles.pressed]}>
        <AppText variant="caption" weight="bold"
          style={{color:filter===group?"#FFFFFF":colors.text}}>
          {tr(group)} ({counts[group]})
        </AppText>
      </Pressable>)}
    </ScrollView>
    {!canNetwork?<Card style={styles.noticeCard}>
      <Ionicons name="cloud-offline-outline" size={20} color={colors.warning}/>
      <AppText style={styles.noticeText} variant="caption">{tr("offline")}</AppText>
    </Card>:null}
    {error?<Card style={styles.errorCard}>
      <Ionicons name="alert-circle-outline" size={23} color={colors.danger}/>
      <AppText style={styles.errorText}>{error}</AppText>
      <Button label={tr("retry")} variant="secondary" onPress={onRefresh}/>
    </Card>:null}
    {loading&&items.length===0?<DataLoadingState variant="list" minHeight={310}/>:null}
    {!loading&&!error&&items.length===0?<Card style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="calendar-outline" size={35} color={colors.primary}/>
      </View>
      <AppText variant="bodyLarge" weight="bold" style={styles.centerText}>{tr("emptyTitle")}</AppText>
      <AppText variant="caption" muted style={styles.centerText}>{tr("emptyBody")}</AppText>
      <Button label={tr("explore")} icon={<Ionicons name="search-outline" size={18} color="#FFFFFF"/>}
        onPress={()=>router.push("/venues")}/>
    </Card>:null}
    {!loading&&items.length>0&&visible.length===0?<Card style={styles.empty}>
      <Ionicons name="filter-outline" color={colors.textMuted} size={28}/>
      <AppText weight="semibold" style={styles.centerText}>{tr("noMatches")}</AppText>
      <Button variant="secondary" label={tr("showAll")} onPress={()=>setFilter("ALL")}/>
    </Card>:null}
    {visible.map(item=>{
      const group=reservationGroup(item,now);
      const palette=statePalette[group];
      const expanded=expandedId===item.id;
      const canCancel=item.status!=="CANCELLED"&&Date.parse(item.startsAt)>now;
      return <Card key={item.id} style={[styles.bookingCard,{borderLeftColor:palette.ink}]}>
        <View style={[styles.identity,rtlRow]}>
          <View style={[styles.venueIcon,{backgroundColor:palette.background}]}>
            <Ionicons name="football-outline" size={25} color={palette.ink}/>
          </View>
          <View style={styles.identityText}>
            <AppText variant="bodyLarge" weight="bold" numberOfLines={2}>{item.venueName}</AppText>
            <AppText variant="caption" muted>{tr("reference")}: {item.id.slice(0,8).toUpperCase()}</AppText>
          </View>
          <View style={[styles.status,{backgroundColor:palette.background,borderColor:palette.border}]}>
            <AppText variant="caption" weight="bold" style={{color:palette.ink}}>{tr(group)}</AppText>
          </View>
        </View>
        <View style={[styles.bookingDetails,rtlRow]}>
          <View style={styles.dateArea}>
            <View style={[styles.infoRow,rtlRow]}>
              <Ionicons name="calendar-outline" size={18} color={colors.textMuted}/>
              <AppText style={{flex:1}} weight="medium">{bookingDate(item.startsAt,language)}</AppText>
            </View>
            <View style={[styles.infoRow,rtlRow]}>
              <Ionicons name="time-outline" size={18} color={colors.textMuted}/>
              <AppText weight="semibold" forceLtr style={{flex:1}}>
                {bookingTime(item.startsAt)} – {bookingTime(item.endsAt)}
              </AppText>
            </View>
          </View>
          <View style={styles.priceArea}>
            <AppText variant="caption" muted>{tr("price")}</AppText>
            <AppText variant="bodyLarge" weight="bold" forceLtr
              style={styles.price}>{item.priceAfn} AFN</AppText>
          </View>
        </View>
        {group==="PENDING"?<View style={[styles.hint,{backgroundColor:palette.background}]}>
          <Ionicons name="information-circle-outline" size={17} color={palette.ink}/>
          <AppText variant="caption" style={{flex:1,color:palette.ink}}>{tr("pendingHint")}</AppText>
        </View>:null}
        <View style={[styles.actions,rtlRow]}>
          {!scopedVenueId?<Button style={styles.actionButton} variant="secondary" label={tr("viewVenue")}
            icon={<Ionicons name="location-outline" size={17} color={colors.primary}/>}
            onPress={()=>openVenue(item)}/>:null}
          <Button style={styles.actionButton} variant="secondary"
            label={canCancel?tr("details"):tr("findSlots")}
            icon={<Ionicons name={canCancel?"receipt-outline":"calendar-outline"} size={17} color={colors.primary}/>}
            onPress={()=>canCancel?setExpandedId(expanded?null:item.id):openVenue(item,true)}/>
        </View>
        {item.status==="CONFIRMED"&&item.source==="ONLINE"&&
          Date.parse(item.endsAt)<=now?<Button variant="secondary"
          testID={"booking-rate-venue-"+item.id}
          label={t("booking.community.rateVenue")} onPress={()=>
          router.push({pathname:"/venues/[venueId]",params:{
            venueId:item.venueId,reviewBookingId:item.id,
          }})}/>:null}
        {!canCancel?<Pressable accessibilityRole="button" accessibilityState={{expanded}}
          onPress={()=>setExpandedId(expanded?null:item.id)}
          style={[styles.detailsToggle,rtlRow]}>
          <Ionicons name={expanded?"chevron-up":"chevron-down"} size={16} color={colors.primary}/>
          <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
            {expanded?tr("hideDetails"):tr("details")}
          </AppText>
        </Pressable>:null}
        {expanded?<View style={styles.expanded}>
          <View style={[styles.infoRow,rtlRow]}>
            <Ionicons name="information-circle-outline" size={17} color={colors.textMuted}/>
            <AppText style={{flex:1}} variant="caption">
              {tr("fullReference")}: {item.id}
            </AppText>
          </View>
          <AppText variant="caption" muted>{tr("source")}: {tr(item.source)}</AppText>
          {item.note?<AppText variant="caption">{tr("note")}: {item.note}</AppText>:null}
          <AppText variant="caption" weight="semibold">{tr("policy")}</AppText>
          <AppText variant="caption" muted>{item.cancellationPolicySnapshot||tr("noPolicy")}</AppText>
          {canCancel?<Button label={tr("cancelBooking")} variant="secondary"
            disabled={!canNetwork} onPress={()=>requestCancel(item)}/>:null}
        </View>:null}
      </Card>;
    })}
    {items.length>0?<AppText variant="caption" muted style={styles.footer}>{tr("footer")}</AppText>:null}
    <Modal animationType="fade" transparent visible={cancelTarget!==null}
      onRequestClose={()=>{if(!cancelBusy)setCancelTarget(null);}}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button"
          accessibilityLabel={tr("keepBooking")} disabled={cancelBusy}
          onPress={()=>setCancelTarget(null)}/>
        {cancelTarget?<View style={styles.modalCard}>
          <View style={styles.modalIcon}>
            <Ionicons name="warning-outline" size={28} color={colors.danger}/>
          </View>
          <AppText variant="bodyLarge" weight="bold" style={styles.centerText}>
            {tr("cancelTitle")}
          </AppText>
          <AppText style={styles.centerText}>
            {cancelTarget.venueName}
          </AppText>
          <AppText variant="caption" style={styles.centerText}>
            {bookingDate(cancelTarget.startsAt,language)} · {bookingTime(cancelTarget.startsAt)}
          </AppText>
          <View style={styles.policyBox}>
            <AppText weight="semibold" variant="caption">{tr("policy")}</AppText>
            <AppText muted variant="caption">{cancelTarget.cancellationPolicySnapshot||tr("noPolicy")}</AppText>
          </View>
          <AppText muted variant="caption" style={styles.centerText}>{tr("cancelWarning")}</AppText>
          {cancelError?<AppText style={{color:colors.danger,textAlign:"center"}}>{cancelError}</AppText>:null}
          <Button label={tr("confirmCancel")} variant="danger"
            loading={cancelBusy} disabled={!canNetwork}
            onPress={()=>void confirmCancel()}/>
          <Button label={tr("keepBooking")} variant="secondary"
            disabled={cancelBusy} onPress={()=>setCancelTarget(null)}/>
        </View>:null}
      </View>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  root:{gap:spacing.md,paddingBottom:spacing.md},
  heading:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  headingCopy:{flex:1,gap:3},
  headingIcon:{height:48,width:48,borderRadius:radius.md,alignItems:"center",
    justifyContent:"center",backgroundColor:colors.primarySoft},
  refresh:{width:44,height:44,borderRadius:radius.md,backgroundColor:colors.surface,
    borderWidth:1,borderColor:colors.border,alignItems:"center",justifyContent:"center"},
  summary:{flexDirection:"row",gap:spacing.sm},
  summaryCard:{flex:1,minWidth:0,borderWidth:1,backgroundColor:colors.surface,
    borderRadius:radius.lg,paddingVertical:spacing.sm,alignItems:"center",gap:2},
  summaryIcon:{width:34,height:34,borderRadius:radius.sm,alignItems:"center",justifyContent:"center"},
  summaryLabel:{textAlign:"center",fontSize:11},
  filterScroll:{flexGrow:0},
  filterRow:{flexDirection:"row",alignItems:"center",gap:spacing.sm,paddingVertical:2},
  filterChip:{minHeight:39,paddingHorizontal:spacing.md,backgroundColor:colors.surface,
    borderColor:colors.border,borderWidth:1,borderRadius:radius.pill,
    alignItems:"center",justifyContent:"center"},
  filterChipActive:{backgroundColor:colors.primary,borderColor:colors.primary},
  pressed:{opacity:.75},
  errorCard:{gap:spacing.sm,borderColor:colors.danger,alignItems:"center"},
  errorText:{color:colors.danger,textAlign:"center"},
  noticeCard:{flexDirection:"row",alignItems:"center",gap:spacing.sm,backgroundColor:"#FFFBEB"},
  noticeText:{flex:1,color:colors.warning},
  empty:{minHeight:220,padding:spacing.lg,alignItems:"center",justifyContent:"center",gap:spacing.md},
  emptyIcon:{height:64,width:64,borderRadius:32,backgroundColor:colors.primarySoft,
    justifyContent:"center",alignItems:"center"},
  centerText:{textAlign:"center"},
  bookingCard:{padding:spacing.md,borderLeftWidth:4,gap:spacing.md},
  identity:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  venueIcon:{width:48,height:48,borderRadius:radius.md,alignItems:"center",justifyContent:"center"},
  identityText:{flex:1,minWidth:0,gap:2},
  status:{paddingHorizontal:8,paddingVertical:5,borderWidth:1,borderRadius:radius.pill,
    alignItems:"center"},
  bookingDetails:{flexDirection:"row",alignItems:"center",gap:spacing.sm,
    backgroundColor:colors.surfaceMuted,padding:spacing.sm,borderRadius:radius.md},
  dateArea:{flex:1,gap:spacing.sm,minWidth:0},
  infoRow:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  priceArea:{alignItems:"flex-end",gap:1,paddingHorizontal:spacing.xs},
  price:{color:colors.primary,textAlign:"right"},
  hint:{flexDirection:"row",alignItems:"center",gap:spacing.sm,
    borderRadius:radius.sm,padding:spacing.sm},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  actionButton:{flex:1,minWidth:140,paddingHorizontal:spacing.sm},
  detailsToggle:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:spacing.xs,
    paddingVertical:spacing.xs},
  expanded:{borderTopWidth:1,borderColor:colors.border,paddingTop:spacing.md,gap:spacing.sm},
  footer:{textAlign:"center"},
  modalOverlay:{flex:1,backgroundColor:"rgba(15,23,42,.66)",padding:spacing.md,
    alignItems:"center",justifyContent:"center"},
  modalCard:{backgroundColor:colors.surface,borderRadius:radius.lg,padding:spacing.lg,
    gap:spacing.md,width:"100%",maxWidth:480,maxHeight:"90%"},
  modalIcon:{alignSelf:"center",height:56,width:56,borderRadius:28,backgroundColor:"#FEE2E2",
    alignItems:"center",justifyContent:"center"},
  policyBox:{gap:spacing.xs,padding:spacing.sm,backgroundColor:colors.surfaceMuted,
    borderRadius:radius.md},
});
