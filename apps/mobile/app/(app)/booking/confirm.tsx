import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing,touchTarget} from "@leaguekick/design-tokens";
import {router,useLocalSearchParams} from "expo-router";
import {useRef,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,View} from "react-native";
import {ApiRequestError,bookingApi} from "../../../src/lib/api";
import {formatBookingPrice,formatBookingSlot} from "../../../src/lib/booking-confirm-display";
import {AppText} from "../../../src/components/ui/AppText";
import {Button} from "../../../src/components/ui/Button";
import {Card} from "../../../src/components/ui/Card";
import {Screen} from "../../../src/components/ui/Screen";
import {TextField} from "../../../src/components/ui/TextField";
import {useAuth} from "../../../src/providers/AuthProvider";
import {useLocale} from "../../../src/providers/LocaleProvider";
import {useNetwork} from "../../../src/providers/NetworkProvider";

export default function BookingConfirmScreen(){
  const params=useLocalSearchParams<{
    venueId:string;areaId:string;venueName:string;startsAt:string;
    endsAt:string;priceAfn:string;timeZone:string;
  }>();
  const {session}=useAuth();
  const {t,language,isRTL}=useLocale();
  const {isOnline}=useNetwork();
  const [note,setNote]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const submitting=useRef(false);
  // Retain one key across retries so network retries cannot duplicate the booking.
  const key=useRef(`booking-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const start=formatBookingSlot(params.startsAt,language,params.timeZone);
  const end=formatBookingSlot(params.endsAt,language,params.timeZone);
  const price=formatBookingPrice(params.priceAfn,language);
  const validSlot=Boolean(params.areaId&&params.startsAt&&start);
  const canConfirm=Boolean(session&&isOnline&&validSlot&&!busy);
  const timeRange=start
    ?end
      ?`${start.time} – ${start.dayKey===end.dayKey?"":end.date+" · "}${end.time}`
      :start.time
    :null;

  async function confirm(){
    if(!session||!isOnline||!validSlot||submitting.current)return;
    submitting.current=true;
    setBusy(true);setError(null);
    try{
      // The backend still determines live availability and final price. Never
      // trust the URL-provided price or end time for reservation creation.
      await bookingApi.create(session.accessToken,{
        areaId:params.areaId,startsAt:params.startsAt,
        idempotencyKey:key.current,note:note.trim(),
      });
      router.replace("/bookings");
    }catch(cause){
      if(cause instanceof ApiRequestError&&cause.code==="SLOT_UNAVAILABLE")
        setError(t("booking.slotTaken"));
      else if(cause instanceof ApiRequestError&&cause.isNetworkError)
        setError(t("booking.confirmNeedsInternet"));
      else setError(t("booking.confirmError"));
    }finally{
      submitting.current=false;
      setBusy(false);
    }
  }

  return <Screen style={styles.page}>
    <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.headingIcon}>
        <Ionicons name="calendar-outline" size={24} color={colors.primary}/>
      </View>
      <View style={styles.headingText}>
        <AppText variant="title" weight="bold">{t("booking.confirmTitle")}</AppText>
        <AppText variant="caption" muted>{t("booking.summaryIntro")}</AppText>
      </View>
    </View>

    <Card style={styles.summaryCard} testID="booking-confirm-summary">
      <View style={[styles.venueRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.venueIcon}>
          <Ionicons name="football-outline" size={22} color={colors.primary}/>
        </View>
        <View style={styles.venueText}>
          <AppText variant="caption" muted>{t("booking.venueLabel")}</AppText>
          <AppText variant="bodyLarge" weight="bold" numberOfLines={2}>
            {params.venueName?.trim()||"—"}
          </AppText>
        </View>
      </View>
      <View style={styles.divider}/>
      {start?<View style={styles.details}>
        <View style={[styles.dateRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.detailCell}>
            <View style={[styles.detailLabel,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Ionicons name="calendar-clear-outline" size={15} color={colors.textMuted}/>
              <AppText variant="caption" muted>{t("booking.date")}</AppText>
            </View>
            <AppText weight="semibold" style={styles.detailValue} numberOfLines={2}>
              {start.date}
            </AppText>
          </View>
          <View style={styles.dateDivider}/>
          <View style={styles.detailCell}>
            <View style={[styles.detailLabel,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Ionicons name="today-outline" size={15} color={colors.textMuted}/>
              <AppText variant="caption" muted>{t("booking.dayLabel")}</AppText>
            </View>
            <AppText weight="semibold" style={styles.detailValue} numberOfLines={2}>
              {start.day}
            </AppText>
          </View>
        </View>
        <View style={styles.timePanel}>
          <View style={[styles.detailLabel,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Ionicons name="time-outline" size={16} color={colors.primary}/>
            <AppText variant="caption" muted>{t("booking.timeLabel")}</AppText>
          </View>
          <AppText weight="bold" forceLtr style={styles.timeValue} numberOfLines={2}>
            {timeRange}
          </AppText>
        </View>
      </View>:<AppText style={styles.errorText} testID="booking-invalid-slot">
        {t("booking.detailsUnavailable")}
      </AppText>}
      <View style={[styles.priceRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={[styles.priceLabel,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="wallet-outline" size={17} color={colors.primary}/>
          <AppText weight="medium">{t("booking.priceLabel")}</AppText>
        </View>
        <AppText variant="bodyLarge" weight="bold" style={styles.priceValue} forceLtr>
          {price??"—"}
        </AppText>
      </View>
    </Card>

    <View style={styles.noteSection}>
      <TextField
        label={t("booking.noteOptional")}
        placeholder={t("booking.noteOptional")}
        value={note}
        onChangeText={setNote}
        maxLength={500}
        multiline
        numberOfLines={3}
        style={styles.noteInput}
      />
    </View>

    <View style={[styles.recheck,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Ionicons name="shield-checkmark-outline" size={21} color={colors.primary}/>
      <AppText variant="caption" muted style={styles.recheckText}>
        {t("booking.serverRecheck")}
      </AppText>
    </View>

    {!isOnline?<AppText style={styles.warningText} accessibilityLiveRegion="polite">
      {t("booking.confirmNeedsInternet")}
    </AppText>:null}
    {error?<AppText style={styles.errorText} accessibilityLiveRegion="polite">
      {error}
    </AppText>:null}

    <View style={styles.actions}>
      <Pressable
        testID="booking-confirm-button"
        accessibilityRole="button"
        accessibilityLabel={t("booking.confirmButton")}
        accessibilityState={{disabled:!canConfirm,busy}}
        disabled={!canConfirm}
        onPress={()=>void confirm()}
        style={({pressed})=>[
          styles.confirmButton,
          !canConfirm&&styles.confirmDisabled,
          pressed&&canConfirm&&styles.confirmPressed,
        ]}
      >
        <View style={[styles.confirmContents,{flexDirection:isRTL?"row-reverse":"row"}]}>
          {busy?<ActivityIndicator color="#FFFFFF" size="small"/>:
            <Ionicons name="checkmark-circle-outline" size={21} color="#FFFFFF"/>}
          {/* Keep the label visible while submitting: a spinner alone
              looked like a blank primary button on Android. */}
          <AppText weight="bold" style={styles.confirmText}>
            {t("booking.confirmButton")}
          </AppText>
        </View>
      </Pressable>
      <Button label={t("booking.backToVenue")} onPress={()=>router.back()}
        variant="secondary" disabled={busy}/>
    </View>
  </Screen>;
}

const styles=StyleSheet.create({
  page:{gap:spacing.md,paddingTop:spacing.lg},
  heading:{alignItems:"center",gap:spacing.sm},
  headingIcon:{width:48,height:48,borderRadius:radius.md,
    alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  headingText:{flex:1,minWidth:0,gap:2},
  summaryCard:{padding:spacing.md,gap:spacing.md},
  venueRow:{alignItems:"center",gap:spacing.sm},
  venueIcon:{width:44,height:44,borderRadius:radius.md,
    alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  venueText:{flex:1,minWidth:0,gap:2},
  divider:{height:1,backgroundColor:colors.border},
  details:{gap:spacing.md},
  dateRow:{alignItems:"stretch",gap:spacing.sm},
  detailCell:{flex:1,minWidth:0,gap:spacing.xs},
  dateDivider:{width:1,backgroundColor:colors.border},
  detailLabel:{alignItems:"center",gap:spacing.xs},
  detailValue:{lineHeight:23},
  timePanel:{padding:spacing.sm+4,backgroundColor:colors.surfaceMuted,
    borderRadius:radius.md,gap:spacing.xs},
  timeValue:{fontSize:16,lineHeight:24,color:colors.text},
  priceRow:{alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",
    paddingTop:spacing.sm,borderTopWidth:1,borderColor:colors.border,gap:spacing.sm},
  priceLabel:{alignItems:"center",gap:spacing.xs},
  priceValue:{color:colors.primary,fontSize:19},
  noteSection:{gap:spacing.xs},
  noteInput:{minHeight:86,textAlignVertical:"top",paddingTop:spacing.sm+4},
  recheck:{gap:spacing.sm,padding:spacing.md,borderRadius:radius.md,
    backgroundColor:colors.primarySoft,alignItems:"flex-start"},
  recheckText:{flex:1,minWidth:0,lineHeight:19},
  warningText:{color:colors.warning},
  errorText:{color:colors.danger},
  actions:{gap:spacing.sm},
  confirmButton:{minHeight:touchTarget+6,borderRadius:radius.md,
    backgroundColor:colors.primary,alignItems:"center",justifyContent:"center",
    paddingVertical:spacing.sm,paddingHorizontal:spacing.md},
  confirmContents:{alignItems:"center",justifyContent:"center",gap:spacing.sm},
  confirmText:{color:"#FFFFFF",textAlign:"center"},
  confirmDisabled:{opacity:0.48},
  confirmPressed:{backgroundColor:colors.primaryPressed},
});
