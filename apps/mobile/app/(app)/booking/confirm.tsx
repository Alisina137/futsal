import { colors, spacing } from "@leaguekick/design-tokens";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import { ApiRequestError, bookingApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";
import { useNetwork } from "../../../src/providers/NetworkProvider";

export default function BookingConfirmScreen(){
  const params=useLocalSearchParams<{venueId:string;areaId:string;venueName:string;startsAt:string;endsAt:string;priceAfn:string;timeZone:string}>();
  const {session}=useAuth(); const {t}=useLocale(); const {isOnline}=useNetwork();
  const [note,setNote]=useState(""); const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null);
  const key=useRef(`booking-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  async function confirm(){
    if(!session||!isOnline)return;
    setBusy(true);setError(null);
    try{
      await bookingApi.create(session.accessToken,{areaId:params.areaId,startsAt:params.startsAt,idempotencyKey:key.current,note});
      router.replace("/bookings");
    }catch(cause){
      if(cause instanceof ApiRequestError&&cause.code==="SLOT_UNAVAILABLE")setError(t("booking.slotTaken"));
      else if(cause instanceof ApiRequestError&&cause.isNetworkError)setError(t("booking.confirmNeedsInternet"));
      else setError(t("booking.confirmError"));
    }finally{setBusy(false);}
  }

  return <Screen>
    <AppText variant="title" weight="bold">{t("booking.confirmTitle")}</AppText>
    <Card>
      <AppText variant="bodyLarge" weight="bold">{params.venueName}</AppText>
      <AppText forceLtr>{params.startsAt}</AppText>
      <AppText weight="semibold">{params.priceAfn} AFN</AppText>
      <AppText variant="caption" muted>{t("booking.serverRecheck")}</AppText>
    </Card>
    <TextField label={t("booking.noteOptional")} value={note} onChangeText={setNote} multiline/>
    {!isOnline?<AppText style={{color:colors.warning}}>{t("booking.confirmNeedsInternet")}</AppText>:null}
    {error?<AppText style={{color:colors.danger}}>{error}</AppText>:null}
    <View style={{gap:spacing.sm}}>
      <Button label={t("booking.confirmButton")} onPress={()=>void confirm()} loading={busy} disabled={!isOnline}/>
      <Button label={t("booking.backToVenue")} onPress={()=>router.back()} variant="secondary"/>
    </View>
  </Screen>;
}
