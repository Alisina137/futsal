import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { AvailabilitySlotDto } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { ApiRequestError, ownerApi, venueApi } from "../../../../src/lib/api";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { Screen } from "../../../../src/components/ui/Screen";
import { TextField } from "../../../../src/components/ui/TextField";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

function todayKabul(){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kabul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}

export default function CreatePromotionScreen(){
  const {session}=useAuth();
  const {t}=useLocale();
  const [date,setDate]=useState(todayKabul());
  const [slots,setSlots]=useState<AvailabilitySlotDto[]>([]);
  const [selected,setSelected]=useState<AvailabilitySlotDto|null>(null);
  const [title,setTitle]=useState("");
  const [price,setPrice]=useState("");
  const [note,setNote]=useState("");
  const [notifyFollowers,setNotifyFollowers]=useState(true);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!session)return;
    setLoading(true);setError(null);setSelected(null);
    try{
      const status=await ownerApi.getStatus(session.accessToken);
      if(!status.venue)throw new Error("VENUE_REQUIRED");
      const response=await venueApi.availability(status.venue.id,date);
      setSlots(response.slots.filter((slot)=>!slot.promotionId));
    }catch(cause){
      if(cause instanceof ApiRequestError&&cause.code==="VENUE_NOT_BOOKABLE")setError(t("ownerMarketing.entitlementRequired"));
      else setError(t("ownerMarketing.loadSlotsError"));
      setSlots([]);
    }finally{setLoading(false);}
  },[date,session,t]);

  useEffect(()=>{void load();},[load]);

  const discountedPrice=Number(price);
  const validPrice=selected!==null&&price.trim()!==""&&Number.isFinite(discountedPrice)&&discountedPrice>=0&&discountedPrice<selected.priceAfn;
  const canSubmit=Boolean(selected&&title.trim().length>=2&&validPrice&&!busy);

  async function submit(){
    if(!session||!selected||!canSubmit)return;
    setBusy(true);setError(null);
    try{
      await ownerApi.createPromotion(session.accessToken,{
        areaId:selected.areaId,
        startsAt:selected.startsAt,
        discountedPriceAfn:discountedPrice,
        title:title.trim(),
        note,
        notifyFollowers,
      });
      router.replace("/owner/promotions");
    }catch(cause){
      if(cause instanceof ApiRequestError&&cause.code==="SLOT_UNAVAILABLE")setError(t("ownerMarketing.slotNoLongerAvailable"));
      else if(cause instanceof ApiRequestError&&cause.code==="PROMOTION_EXISTS")setError(t("ownerMarketing.promotionExists"));
      else if(cause instanceof ApiRequestError&&cause.code==="SUBSCRIPTION_REQUIRED")setError(t("ownerMarketing.entitlementRequired"));
      else setError(t("ownerMarketing.createPromotionError"));
    }finally{setBusy(false);}
  }

  const selectedLabel=useMemo(()=>selected?`${selected.areaName} · ${selected.priceAfn} AFN`:null,[selected]);

  return <Screen>
    <AppText variant="title" weight="bold">{t("ownerMarketing.createPromotion")}</AppText>
    <AppText muted>{t("ownerMarketing.createPromotionBody")}</AppText>

    <TextField label={t("booking.date")} value={date} onChangeText={setDate} forceLtr hint="YYYY-MM-DD"/>
    <Button label={t("ownerMarketing.refreshSlots")} onPress={()=>void load()} loading={loading} variant="secondary"/>

    {!loading&&slots.length===0?<Card><AppText>{t("ownerMarketing.noPromotableSlots")}</AppText></Card>:null}
    {slots.map((slot)=><Pressable key={`${slot.areaId}-${slot.startsAt}`} onPress={()=>{
      setSelected(slot);
      if(!title.trim())setTitle(t("ownerMarketing.defaultPromotionTitle"));
    }}>
      <Card style={selected?.areaId===slot.areaId&&selected.startsAt===slot.startsAt?{borderColor:colors.primary,borderWidth:2}:undefined}>
        <AppText weight="bold">{slot.areaName}</AppText>
        <AppText forceLtr>{slot.startsAt}</AppText>
        <AppText>{slot.priceAfn} AFN</AppText>
      </Card>
    </Pressable>)}

    {selected?<Card style={{backgroundColor:colors.primarySoft}}>
      <AppText weight="bold">{t("ownerMarketing.selectedSlot")}</AppText>
      <AppText>{selectedLabel}</AppText>
      <AppText forceLtr>{selected.startsAt}</AppText>
    </Card>:null}

    <TextField label={t("ownerMarketing.promotionTitle")} value={title} onChangeText={setTitle}/>
    <TextField label={t("ownerMarketing.discountedPrice")} value={price} onChangeText={setPrice} keyboardType="number-pad" forceLtr hint={selected?`< ${selected.priceAfn} AFN`:undefined}/>
    {selected&&price.trim()&&!validPrice?<AppText style={{color:colors.danger}}>{t("ownerMarketing.discountValidation")}</AppText>:null}
    <TextField label={t("booking.noteOptional")} value={note} onChangeText={setNote} multiline/>

    <Card>
      <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:spacing.md}}>
        <AppText style={{flex:1}}>{t("ownerMarketing.notifyFollowers")}</AppText>
        <Switch value={notifyFollowers} onValueChange={setNotifyFollowers}/>
      </View>
    </Card>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    <Button label={t("ownerMarketing.publishPromotion")} onPress={()=>void submit()} loading={busy} disabled={!canSubmit}/>
    <Button label={t("owner.back")} onPress={()=>router.back()} variant="secondary"/>
  </Screen>;
}
