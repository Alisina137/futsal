import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { OwnerOnboardingStatus } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { ApiRequestError, ownerApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

function todayKabul(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kabul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function afghanistanIso(date:string,time:string){return `${date}T${time}:00+04:30`;}

export default function BlockTimeScreen(){
  const {session}=useAuth(); const {t,isRTL}=useLocale();
  const [owner,setOwner]=useState<OwnerOnboardingStatus|null>(null);
  const [areaId,setAreaId]=useState(""); const [date,setDate]=useState(todayKabul()); const [start,setStart]=useState("12:00"); const [end,setEnd]=useState("13:30"); const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null);
  useEffect(()=>{if(!session)return;ownerApi.getStatus(session.accessToken).then((next)=>{setOwner(next);setAreaId(next.venue?.areas[0]?.id??"");}).catch(()=>setError(t("owner.loadError")));},[session,t]);

  async function submit(){if(!session||!areaId)return;setBusy(true);setError(null);try{
    await ownerApi.createBlock(session.accessToken,{areaId,startsAt:afghanistanIso(date,start),endsAt:afghanistanIso(date,end),reason});
    router.replace("/schedule");
  }catch(cause){
    if(cause instanceof ApiRequestError&&cause.code==="SLOT_UNAVAILABLE")setError(t("schedule.conflict"));
    else if(cause instanceof ApiRequestError&&cause.code==="SUBSCRIPTION_REQUIRED")setError(t("schedule.subscriptionRequired"));
    else setError(t("schedule.blockError"));
  }finally{setBusy(false);}}

  return <Screen>
    <AppText variant="title" weight="bold">{t("schedule.blockTitle")}</AppText>
    <Card><AppText weight="semibold">{t("schedule.area")}</AppText><View style={{flexDirection:isRTL?"row-reverse":"row",flexWrap:"wrap",gap:spacing.sm}}>
      {owner?.venue?.areas.map((area)=><Pressable key={area.id} onPress={()=>setAreaId(area.id)} style={{padding:spacing.md,borderRadius:radius.md,borderWidth:1,borderColor:areaId===area.id?colors.primary:colors.border,backgroundColor:areaId===area.id?colors.primarySoft:colors.surface}}><AppText>{area.name}</AppText></Pressable>)}
    </View></Card>
    <TextField label={t("booking.date")} value={date} onChangeText={setDate} forceLtr/>
    <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
      <TextField label={t("schedule.startTime")} value={start} onChangeText={setStart} forceLtr containerStyle={{flex:1}}/>
      <TextField label={t("schedule.endTime")} value={end} onChangeText={setEnd} forceLtr containerStyle={{flex:1}}/>
    </View>
    <TextField label={t("schedule.reasonOptional")} value={reason} onChangeText={setReason}/>
    {error?<AppText style={{color:colors.danger}}>{error}</AppText>:null}
    <Button label={t("schedule.createBlock")} onPress={()=>void submit()} loading={busy} disabled={!areaId}/>
    <Button label={t("owner.back")} onPress={()=>router.back()} variant="secondary"/>
  </Screen>;
}
