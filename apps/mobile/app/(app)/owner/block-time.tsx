import { colors, spacing } from "@leaguekick/design-tokens";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { ApiRequestError, ownerApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

function todayKabul(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kabul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function afghanistanIso(date:string,time:string){return `${date}T${time}:00+04:30`;}

export default function BlockTimeScreen(){
  const params=useLocalSearchParams<{blockId?:string;areaId?:string;date?:string;start?:string;end?:string;reason?:string}>();
  const {session}=useAuth(); const {t,isRTL}=useLocale();
  const [areaId,setAreaId]=useState(typeof params.areaId==="string"?params.areaId:"");
  const [date,setDate]=useState(typeof params.date==="string"?params.date:todayKabul());
  const [start,setStart]=useState(typeof params.start==="string"?params.start:"12:00");
  const [end,setEnd]=useState(typeof params.end==="string"?params.end:"13:30");
  const blockId=typeof params.blockId==="string"?params.blockId:null;
  const [reason,setReason]=useState(typeof params.reason==="string"?params.reason:"");
  const [busy,setBusy]=useState(false); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  useEffect(()=>{if(!session){setLoading(false);return;}setLoading(true);ownerApi.getStatus(session.accessToken).then((status)=>{
    setAreaId(status.venue?.areas[0]?.id??"");
  }).catch(()=>setError(t("owner.loadError"))).finally(()=>setLoading(false));},[session,t]);

  async function submit(){if(!session||!areaId)return;setBusy(true);setError(null);try{
    const input={areaId,startsAt:afghanistanIso(date,start),endsAt:afghanistanIso(date,end),reason};
    if(blockId)await ownerApi.updateBlock(session.accessToken,blockId,input);
    else await ownerApi.createBlock(session.accessToken,input);
    router.replace({pathname:"/owner/schedule",params:{date}});
  }catch(cause){
    if(cause instanceof ApiRequestError&&cause.code==="SLOT_UNAVAILABLE")setError(t("schedule.conflict"));
    else if(cause instanceof ApiRequestError&&cause.code==="SUBSCRIPTION_REQUIRED")setError(t("schedule.subscriptionRequired"));
    else setError(t("schedule.blockError"));
  }finally{setBusy(false);}}

  if(loading)return <Screen embedded><DataLoadingState variant="form" minHeight={500}/></Screen>;

  return <Screen embedded>
    <AppText variant="title" weight="bold">{t(blockId?"schedule.editBlock":"schedule.blockTitle")}</AppText>
    <TextField label={t("booking.date")} value={date} onChangeText={setDate} forceLtr/>
    <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
      <TextField label={t("schedule.startTime")} value={start} onChangeText={setStart} forceLtr containerStyle={{flex:1}}/>
      <TextField label={t("schedule.endTime")} value={end} onChangeText={setEnd} forceLtr containerStyle={{flex:1}}/>
    </View>
    <TextField label={t("schedule.reasonOptional")} value={reason} onChangeText={setReason}/>
    {error?<AppText style={{color:colors.danger}}>{error}</AppText>:null}
    <Button label={t(blockId?"schedule.updateBlock":"schedule.createBlock")} onPress={()=>void submit()} loading={busy} disabled={!areaId}/>
    <Button label={t("owner.back")} onPress={()=>router.back()} variant="secondary"/>
  </Screen>;
}
