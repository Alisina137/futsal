import { colors, spacing } from "@leaguekick/design-tokens";
import type { OwnerScheduleResponse } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { ownerApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

function todayKabul(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kabul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function time(iso:string){return new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kabul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(iso));}

export default function OwnerScheduleScreen(){
  const {session}=useAuth(); const {t}=useLocale();
  const [date,setDate]=useState(todayKabul());
  const [data,setData]=useState<OwnerScheduleResponse|null>(null);
  const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{if(!session)return;setLoading(true);setError(null);try{setData(await ownerApi.schedule(session.accessToken,date));}catch{setError(t("schedule.loadError"));}finally{setLoading(false);}},[date,session,t]);
  useEffect(()=>{void load();},[load]);

  async function cancelBooking(id:string){if(!session)return;try{await ownerApi.cancelBooking(session.accessToken,id);await load();}catch{setError(t("schedule.cancelError"));}}
  async function unblock(id:string){if(!session)return;try{await ownerApi.deleteBlock(session.accessToken,id);await load();}catch{setError(t("schedule.unblockError"));}}

  if(loading)return <Screen showHeader><DataLoadingState variant="list" minHeight={460}/></Screen>;

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("schedule.title")}</AppText>
      <AppText muted>{t("schedule.subtitle")}</AppText>
    </View>
    <TextField label={t("booking.date")} value={date} onChangeText={setDate} forceLtr hint="YYYY-MM-DD"/>
    <View style={{gap:spacing.sm}}>
      <Button label={t("schedule.refresh")} onPress={()=>void load()} loading={loading} variant="secondary"/>
      <Button label={t("schedule.addManual")} onPress={()=>router.push("/owner/manual-booking")}/>
      <Button label={t("schedule.blockTime")} onPress={()=>router.push("/owner/block-time")} variant="secondary"/>
    </View>
    {error?<AppText style={{color:colors.danger}}>{error}</AppText>:null}
    {!loading&&data&&data.bookings.length===0&&data.blocks.length===0?<Card><AppText>{t("schedule.empty")}</AppText></Card>:null}
    {data?.bookings.map((item)=><Card key={item.id}>
      <AppText variant="bodyLarge" weight="bold">{item.areaName}</AppText>
      <AppText forceLtr>{time(item.startsAt)} - {time(item.endsAt)}</AppText>
      <AppText>{item.customerName??t("schedule.onlinePlayer")}</AppText>
      {item.customerPhone?<AppText forceLtr>{item.customerPhone}</AppText>:null}
      <AppText weight="semibold">{item.priceAfn} AFN · {t(`booking.status.${item.status}` as never)} · {t(`schedule.source.${item.source}` as never)}</AppText>
      {item.status!=="CANCELLED"?<Button label={t("schedule.cancelBooking")} onPress={()=>void cancelBooking(item.id)} variant="secondary"/>:null}
    </Card>)}
    {data?.blocks.map((item)=><Card key={item.id} style={{backgroundColor:colors.surfaceMuted}}>
      <AppText variant="bodyLarge" weight="bold">{t("schedule.blocked")} · {item.areaName}</AppText>
      <AppText forceLtr>{time(item.startsAt)} - {time(item.endsAt)}</AppText>
      {item.reason?<AppText>{item.reason}</AppText>:null}
      <Button label={t("schedule.unblock")} onPress={()=>void unblock(item.id)} variant="secondary"/>
    </Card>)}
  </Screen>;
}
