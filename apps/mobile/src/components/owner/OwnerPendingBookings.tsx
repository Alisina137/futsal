import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { BookingDto } from "@leaguekick/contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { AppState, Modal, StyleSheet, View } from "react-native";
import { ownerApi } from "../../lib/api";
import { formatRefereeScheduleParts } from "../../lib/date-time";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

type Decision={booking:BookingDto;action:"approve"|"reject"};

/** This is independent of a calendar date. An owner's approval inbox lists
 * every PENDING online booking at their venue, even if the requested date
 * lies in a future week or a different timetable view. */
export function OwnerPendingBookings({token,compact=false,onChanged,focusBookingId}:{
  token:string|undefined;
  compact?:boolean;
  onChanged?:()=>void;
  focusBookingId?:string;
}){
  const {t,language,isRTL}=useLocale();
  const [bookings,setBookings]=useState<BookingDto[]>([]);
  const [loadedToken,setLoadedToken]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  const [decision,setDecision]=useState<Decision|null>(null);
  const [busy,setBusy]=useState(false);
  const [actionError,setActionError]=useState(false);
  const sequence=useRef(0);
  const actionLock=useRef(false);
  const safeBookings=loadedToken===token?bookings:[];
  const load=useCallback(async()=>{
    const id=++sequence.current;
    if(!token){
      setBookings([]);setLoadedToken(null);setLoading(false);
      return;
    }
    try{
      const result=await ownerApi.pendingBookings(token);
      if(id!==sequence.current)return;
      setBookings(result.bookings);
      setLoadedToken(token);
      setError(false);
    }catch{
      if(id===sequence.current)setError(true);
    }finally{
      if(id===sequence.current)setLoading(false);
    }
  },[token]);

  useFocusEffect(useCallback(()=>{
    setLoading(true);
    void load();
    // A reservation can be submitted while the venue owner is watching.
    // Poll moderately in foreground; always clear the timer on blur.
    const timer=setInterval(()=>{
      if(AppState.currentState==="active")void load();
    },20_000);
    return ()=>{sequence.current++;clearInterval(timer);};
  },[load]));

  async function applyDecision(){
    if(!token||!decision||actionLock.current)return;
    const {booking,action}=decision;
    actionLock.current=true;
    setBusy(true);setActionError(false);
    // Suppress a stale in-flight inbox response until the write finishes.
    sequence.current+=1;
    try{
      if(action==="approve")await ownerApi.confirmBooking(token,booking.id);
      else await ownerApi.cancelBooking(token,booking.id,t("schedule.requestsRejectedReason"));
      setBookings(previous=>previous.filter(item=>item.id!==booking.id));
      setDecision(null);
      onChanged?.();
      await load();
    }catch{
      setDecision(null);
      setActionError(true);
      await load();
    }finally{
      setBusy(false);
      actionLock.current=false;
    }
  }

  const shown=compact?safeBookings.slice(0,2):safeBookings;
  return <Card style={styles.wrapper} testID="owner-pending-bookings">
    <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.icon}><Ionicons name="mail-unread-outline" color="#92400E" size={22}/></View>
      <View style={styles.headingText}>
        <AppText weight="bold" variant="bodyLarge">{t("schedule.requestsTitle")}</AppText>
        <AppText variant="caption" muted>{t("schedule.requestsSubtitle")}</AppText>
      </View>
      <View testID="owner-pending-count" style={styles.countBadge}>
        <AppText weight="bold" forceLtr style={styles.countText}>
          {loadedToken===token?safeBookings.length:0}
        </AppText>
      </View>
    </View>
    {loading&&loadedToken!==token?<AppText muted variant="caption">
      {t("schedule.requestsLoading")}
    </AppText>:null}
    {error?<View style={styles.errorBox}>
      <AppText style={{color:colors.danger}}>{t("schedule.requestsLoadError")}</AppText>
      <Button label={t("common.retry")} variant="secondary"
        onPress={()=>void load()}/>
    </View>:null}
    {!loading&&!error&&safeBookings.length===0?
      <View style={[styles.empty,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="checkmark-circle-outline" size={21} color={colors.success}/>
        <AppText variant="caption" muted style={{flex:1}}>
          {t("schedule.requestsEmpty")}
        </AppText>
      </View>:null}
    {shown.map(booking=>{
      const time=formatRefereeScheduleParts(booking.startsAt,language);
      const expired=Date.parse(booking.startsAt)<=Date.now();
      return <View key={booking.id} testID={"owner-pending-"+booking.id}
        style={[styles.requestCard,focusBookingId===booking.id&&{borderWidth:2,borderColor:colors.primary,borderRadius:radius.md}]}>
        <View style={[styles.requestHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.customer}>
            <AppText weight="bold" numberOfLines={2}>
              {booking.customerName||t("schedule.onlinePlayer")}
            </AppText>
            <AppText variant="caption" muted>{booking.areaName}</AppText>
          </View>
          <View style={styles.pendingBadge}>
            <Ionicons name="time-outline" size={14} color="#92400E"/>
            <AppText variant="caption" weight="semibold" style={styles.pendingText}>
              {t("schedule.pendingApproval")}
            </AppText>
          </View>
        </View>
        <View style={[styles.whenRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="calendar-outline" size={17} color={colors.primary}/>
          <AppText style={{flex:1}}>{time.date}</AppText>
        </View>
        <View style={[styles.whenRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="time-outline" size={17} color={colors.primary}/>
          <AppText weight="semibold" forceLtr>{time.time}</AppText>
          <AppText style={{marginStart:spacing.sm}} weight="semibold" forceLtr>
            {booking.priceAfn.toLocaleString("en-US")} AFN
          </AppText>
        </View>
        {booking.note?<View style={styles.noteBox}>
          <AppText variant="caption" muted>{booking.note}</AppText>
        </View>:null}
        {expired?<AppText variant="caption" style={styles.expiredText}>
          {t("schedule.requestsExpired")}
        </AppText>:null}
        {!compact?<View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Button label={t("schedule.approveBooking")} style={styles.actionButton}
            disabled={busy||expired} onPress={()=>setDecision({booking,action:"approve"})}/>
          <Button label={t("schedule.requestsReject")} style={styles.actionButton}
            variant="secondary" disabled={busy}
            onPress={()=>setDecision({booking,action:"reject"})}/>
        </View>:null}
      </View>;
    })}
    {actionError?<AppText style={{color:colors.danger}}>{t("schedule.requestsActionError")}</AppText>:null}
    <View style={styles.bottomRow}>
      {compact?<Button label={t("schedule.requestsManage")}
        onPress={()=>router.push("/owner/schedule")}/>:<Button
        label={t("schedule.requestsRefresh")} variant="secondary"
        icon={<Ionicons name="refresh-outline" color={colors.primary} size={17}/>}
        onPress={()=>void load()}/>}
    </View>
    <Modal transparent visible={decision!==null} animationType="fade"
      onRequestClose={()=>{if(!busy)setDecision(null);}}>
      <View style={styles.overlay}>
        <Card style={styles.dialog}>
          <View style={styles.dialogIcon}>
            <Ionicons name="help-circle-outline" size={30} color={colors.primary}/>
          </View>
          <AppText weight="bold" variant="bodyLarge" style={styles.centered}>
            {decision?.action==="approve"?t("schedule.requestsApproveTitle"):t("schedule.requestsRejectTitle")}
          </AppText>
          <AppText muted style={styles.centered}>
            {decision?.action==="approve"?t("schedule.requestsApproveConfirm"):t("schedule.requestsRejectConfirm")}
          </AppText>
          {decision?<AppText weight="semibold" style={styles.centered}>
            {formatRefereeScheduleParts(decision.booking.startsAt,language).date}
            {" · "}{formatRefereeScheduleParts(decision.booking.startsAt,language).time}
          </AppText>:null}
          <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Button label={t("common.cancel")} variant="secondary"
              style={styles.actionButton} disabled={busy} onPress={()=>setDecision(null)}/>
            <Button label={decision?.action==="approve"?t("schedule.approveBooking"):t("schedule.requestsReject")}
              variant={decision?.action==="approve"?"primary":"danger"}
              style={styles.actionButton} loading={busy} onPress={()=>void applyDecision()}/>
          </View>
        </Card>
      </View>
    </Modal>
  </Card>;
}
const styles=StyleSheet.create({
  wrapper:{gap:spacing.md,padding:spacing.md},
  heading:{alignItems:"center",gap:spacing.sm},
  icon:{height:42,width:42,alignItems:"center",justifyContent:"center",
    backgroundColor:"#FFFBEB",borderRadius:radius.md},
  headingText:{flex:1,minWidth:0,gap:3},
  countBadge:{minWidth:36,minHeight:34,paddingHorizontal:spacing.sm,
    justifyContent:"center",alignItems:"center",backgroundColor:"#FEF3C7",
    borderRadius:radius.pill},
  countText:{color:"#92400E"},
  empty:{gap:spacing.sm,alignItems:"center",padding:spacing.md,
    borderRadius:radius.md,backgroundColor:"#F0FDF4"},
  errorBox:{gap:spacing.sm},
  requestCard:{gap:spacing.sm,borderRadius:radius.md,borderWidth:1,
    borderColor:"#F3D7A2",backgroundColor:"#FFFCF4",padding:spacing.md},
  requestHeading:{alignItems:"center",gap:spacing.sm},
  customer:{flex:1,minWidth:0,gap:3},
  pendingBadge:{alignItems:"center",flexDirection:"row",gap:4,
    borderRadius:radius.pill,backgroundColor:"#FEF3C7",
    paddingHorizontal:spacing.sm,paddingVertical:spacing.xs},
  pendingText:{color:"#92400E"},
  whenRow:{alignItems:"center",gap:spacing.sm,flexWrap:"wrap"},
  noteBox:{borderRadius:radius.sm,padding:spacing.sm,backgroundColor:colors.surface},
  expiredText:{color:colors.danger},
  actions:{gap:spacing.sm,flexWrap:"wrap"},
  actionButton:{flexGrow:1,flexBasis:130,minWidth:130},
  bottomRow:{alignItems:"flex-end"},
  overlay:{flex:1,backgroundColor:"rgba(9,21,35,0.58)",
    padding:spacing.lg,alignItems:"center",justifyContent:"center"},
  dialog:{width:"100%",maxWidth:420,gap:spacing.md,alignItems:"stretch",
    padding:spacing.lg},
  dialogIcon:{alignSelf:"center",backgroundColor:colors.primarySoft,
    width:52,height:52,borderRadius:26,alignItems:"center",justifyContent:"center"},
  centered:{textAlign:"center"},
});
