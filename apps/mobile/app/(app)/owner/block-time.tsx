import {TimeOfDayPickerField} from "../../../src/components/ui/TimeOfDayPickerField";
import { colors, spacing } from "@leaguekick/design-tokens";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { ApiRequestError, ownerApi } from "../../../src/lib/api";
import {ownerBlockOverlaps,validOwnerBlockInterval} from "../../../src/lib/owner-schedule-management";
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
  const params=useLocalSearchParams<{blockId?:string;areaId?:string;date?:string;start?:string;end?:string;reason?:string;returnTo?:string}>();
  const {session}=useAuth(); const {t,isRTL}=useLocale();
  const [areaId,setAreaId]=useState(typeof params.areaId==="string"?params.areaId:"");
  const [date,setDate]=useState(typeof params.date==="string"?params.date:todayKabul());
  const [start,setStart]=useState(typeof params.start==="string"?params.start:"12:00");
  const [end,setEnd]=useState(typeof params.end==="string"?params.end:"13:30");
  const blockId=typeof params.blockId==="string"?params.blockId:null;
  const returnTo=params.returnTo==="blocks"?"/owner/blocks":null;
  const valid=useMemo(()=>validOwnerBlockInterval(date,start,end),[date,start,end]);
  const [reason,setReason]=useState(typeof params.reason==="string"?params.reason:"");
  const [busy,setBusy]=useState(false); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    if(!session){setAreaId("");setLoading(false);return;}
    let active=true;setLoading(true);
    ownerApi.getStatus(session.accessToken).then(status=>{
      if(active)setAreaId(status.venue?.areas.find(area=>area.id===areaId)?.id
        ??status.venue?.areas[0]?.id??"");
    }).catch(()=>{if(active)setError(t("owner.loadError"));})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[session?.accessToken,t]);

  async function submit(){
    if(!session||!areaId||!valid||busy)return;
    const token=session.accessToken;
    setBusy(true);setError(null);
    try{
      const input={areaId,startsAt:afghanistanIso(date,start),endsAt:afghanistanIso(date,end),reason};
      // Advisory preview only. Atomic createBlock/updateBlock still checks real
      // bookings, blocks and competition conflicts at the time of the write.
      const calendar=await ownerApi.timetableCalendar(token,date,date,areaId);
      const day=calendar.days.find(item=>item.date===date);
      if(day&&ownerBlockOverlaps(day.events,areaId,Date.parse(input.startsAt),
        Date.parse(input.endsAt),blockId)){
        setError(t("schedule.conflict"));return;
      }
      if(blockId)await ownerApi.updateBlock(token,blockId,input);
      else await ownerApi.createBlock(token,input);
      if(returnTo)router.replace(returnTo);
      else router.replace({pathname:"/owner/schedule",params:{date}});
    }catch(cause){
    if(cause instanceof ApiRequestError&&cause.code==="SLOT_UNAVAILABLE")setError(t("schedule.conflict"));
    else if(cause instanceof ApiRequestError&&cause.code==="SUBSCRIPTION_REQUIRED")setError(t("schedule.subscriptionRequired"));
    else setError(t("schedule.blockError"));
  }finally{setBusy(false);}}

  if(loading)return <Screen embedded><DataLoadingState variant="form" minHeight={500}/></Screen>;

  return <Screen embedded>
    <AppText variant="title" weight="bold">{t(blockId?"schedule.editBlock":"schedule.blockTitle")}</AppText>
    <TextField label={t("booking.date")} value={date} onChangeText={setDate} forceLtr/>
    {!valid?<AppText style={{color:colors.danger}}>{t("owner.phase4.invalidInterval")}</AppText>:null}
    <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
      <TimeOfDayPickerField label={t("schedule.startTime")} value={start} onChange={setStart} containerStyle={{flex:1}}/>
      <TimeOfDayPickerField label={t("schedule.endTime")} value={end} onChange={setEnd} containerStyle={{flex:1}}/>
    </View>
    <TextField label={t("schedule.reasonOptional")} value={reason} onChangeText={setReason}/>
    {error?<AppText style={{color:colors.danger}}>{error}</AppText>:null}
    <Button label={t(blockId?"schedule.updateBlock":"schedule.createBlock")} onPress={()=>void submit()} loading={busy} disabled={!areaId||!valid||Boolean(error&&error===t("owner.loadError"))}/>
    <Button label={t("owner.back")} onPress={()=>router.back()} variant="secondary"/>
  </Screen>;
}
