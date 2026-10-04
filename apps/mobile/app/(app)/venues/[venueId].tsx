import { colors, spacing } from "@leaguekick/design-tokens";
import type { PublicVenueDto, VenueAvailabilityResponse } from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { ApiRequestError, venueApi } from "../../../src/lib/api";
import { readAvailabilityCache, writeAvailabilityCache } from "../../../src/lib/availability-cache";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useLocale } from "../../../src/providers/LocaleProvider";
import { useNetwork } from "../../../src/providers/NetworkProvider";

function todayKabul(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kabul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function timeLabel(iso:string,timeZone:string){return new Intl.DateTimeFormat("en-GB",{timeZone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(iso));}

export default function VenueDetailScreen(){
  const {venueId}=useLocalSearchParams<{venueId:string}>();
  const {t}=useLocale();
  const {isOnline,reconnectVersion}=useNetwork();
  const [venue,setVenue]=useState<PublicVenueDto|null>(null);
  const [date,setDate]=useState(todayKabul());
  const [availability,setAvailability]=useState<VenueAvailabilityResponse|null>(null);
  const [live,setLive]=useState(false);
  const [cachedAt,setCachedAt]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!venueId)return;
    setLoading(true); setError(null);
    try{
      if(!venue) setVenue((await venueApi.get(venueId)).venue);
      if(!isOnline) throw new ApiRequestError("NETWORK_ERROR","Offline",null);
      const next=await venueApi.availability(venueId,date);
      setAvailability(next); setVenue(next.venue); setLive(true); setCachedAt(null);
      await writeAvailabilityCache(next);
    }catch(cause){
      const cached=await readAvailabilityCache(venueId,date);
      if(cached){setAvailability(cached.value);setVenue(cached.value.venue);setLive(false);setCachedAt(cached.cachedAt);}
      else setError(cause instanceof ApiRequestError&&cause.isNetworkError?t("booking.offlineNoCache"):t("booking.loadAvailabilityError"));
    }finally{setLoading(false);}
  },[date,isOnline,t,venue,venueId]);

  useEffect(()=>{void load();},[venueId,date,reconnectVersion]);

  return <Screen>
    {venue?<Card>
      <AppText variant="title" weight="bold">{venue.name}</AppText>
      <AppText muted>{venue.city}, {venue.province}</AppText>
      <AppText>{venue.address}</AppText>
      <AppText forceLtr>{venue.publicPhone}</AppText>
    </Card>:null}
    <TextField label={t("booking.date")} value={date} onChangeText={setDate} forceLtr hint="YYYY-MM-DD"/>
    <Button label={t("common.retry")} onPress={()=>void load()} loading={loading} variant="secondary"/>
    {!live&&availability?<Card style={{backgroundColor:colors.surfaceMuted}}>
      <AppText weight="semibold" style={{color:colors.warning}}>{t("booking.cachedAvailability")}</AppText>
      <AppText>{t("booking.cachedAvailabilityBody")}</AppText>
      {cachedAt?<AppText variant="caption" forceLtr>{cachedAt}</AppText>:null}
    </Card>:null}
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    {availability?.slots.length===0?<Card><AppText>{t("booking.noSlots")}</AppText></Card>:null}
    {availability?.slots.map((slot)=><Card key={`${slot.areaId}-${slot.startsAt}`}>
      <View style={{gap:spacing.xs}}>
        <AppText weight="bold">{slot.areaName}</AppText>
        <AppText forceLtr>{timeLabel(slot.startsAt,availability.venue.timezone)} - {timeLabel(slot.endsAt,availability.venue.timezone)}</AppText>
        <AppText weight="semibold">{slot.priceAfn} AFN</AppText>
      </View>
      <Button label={live&&isOnline?t("booking.bookNow"):t("booking.liveRequired")} disabled={!live||!isOnline}
        onPress={()=>router.push({pathname:"/booking/confirm",params:{
          venueId:slot.venueId,areaId:slot.areaId,areaName:slot.areaName,venueName:availability.venue.name,
          startsAt:slot.startsAt,endsAt:slot.endsAt,priceAfn:String(slot.priceAfn),timeZone:availability.venue.timezone
        }})}/>
    </Card>)}
  </Screen>;
}
