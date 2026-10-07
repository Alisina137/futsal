import { colors, spacing } from "@leaguekick/design-tokens";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { ApiRequestError, ownerApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

function todayKabul(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kabul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function afghanistanIso(date:string,time:string){return `${date}T${time}:00+04:30`;}

export default function ManualBookingScreen(){
  const params=useLocalSearchParams<{areaId?:string;date?:string;start?:string;end?:string;price?:string}>();
  const {session}=useAuth(); const {t,isRTL}=useLocale();
  const [areaId,setAreaId]=useState(typeof params.areaId==="string"?params.areaId:"");
  const [date,setDate]=useState(typeof params.date==="string"?params.date:todayKabul());
  const [start,setStart]=useState(typeof params.start==="string"?params.start:"18:00");
  const [end,setEnd]=useState(typeof params.end==="string"?params.end:"19:30");
  const [name,setName]=useState(""); const [phone,setPhone]=useState(""); const [price,setPrice]=useState(typeof params.price==="string"?params.price:""); const [note,setNote]=useState("");
  const [busy,setBusy]=useState(false); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);

  useEffect(()=>{if(!session){setLoading(false);return;}setLoading(true);ownerApi.getStatus(session.accessToken).then((next)=>{
    const court=next.venue?.areas[0]??null;
    setAreaId(court?.id??"");
    if(!(typeof params.price==="string"&&params.price.trim())&&!price&&court){
      setPrice(String(court.basePriceAfn));
    }
  }).catch(()=>setError(t("owner.loadError"))).finally(()=>setLoading(false));},[params.price,session,t]);

  async function submit(){if(!session||!areaId)return;setBusy(true);setError(null);try{
    await ownerApi.createManualBooking(session.accessToken,{areaId,startsAt:afghanistanIso(date,start),endsAt:afghanistanIso(date,end),customerName:name,customerPhone:phone, ...(price.trim()?{priceAfn:Number(price)}:{}),note});
    router.replace("/owner/schedule");
  }catch(cause){
    if(cause instanceof ApiRequestError&&cause.code==="SLOT_UNAVAILABLE")setError(t("schedule.conflict"));
    else if(cause instanceof ApiRequestError&&cause.code==="SUBSCRIPTION_REQUIRED")setError(t("schedule.subscriptionRequired"));
    else setError(t("schedule.manualError"));
  }finally{setBusy(false);}}

  if(loading)return <Screen embedded><DataLoadingState variant="form" minHeight={500}/></Screen>;

  return <Screen embedded>
    <AppText variant="title" weight="bold">{t("schedule.manualTitle")}</AppText>
    <TextField label={t("booking.date")} value={date} onChangeText={setDate} forceLtr/>
    <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
      <TextField label={t("schedule.startTime")} value={start} onChangeText={setStart} forceLtr containerStyle={{flex:1}}/>
      <TextField label={t("schedule.endTime")} value={end} onChangeText={setEnd} forceLtr containerStyle={{flex:1}}/>
    </View>
    <TextField label={t("schedule.customerName")} value={name} onChangeText={setName}/>
    <TextField label={t("schedule.customerPhone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" forceLtr/>
    <TextField label={t("schedule.price")} value={price} onChangeText={setPrice} keyboardType="number-pad" forceLtr/>
    <TextField label={t("booking.noteOptional")} value={note} onChangeText={setNote}/>
    {error?<AppText style={{color:colors.danger}}>{error}</AppText>:null}
    <Button label={t("schedule.createManual")} onPress={()=>void submit()} loading={busy} disabled={!areaId||name.trim().length<2}/>
    <Button label={t("owner.back")} onPress={()=>router.back()} variant="secondary"/>
  </Screen>;
}
