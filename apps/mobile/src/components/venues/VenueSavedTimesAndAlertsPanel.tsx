import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,spacing} from "@leaguekick/design-tokens";
import type {PublicVenueDto,VenueSlotWatchDto} from "@leaguekick/contracts";
import {useCallback,useEffect,useRef,useState} from "react";
import {View} from "react-native";
import {bookingApi} from "../../lib/api";
import {formatAppClock} from "../../lib/clock-display";
import {useAuth} from "../../providers/AuthProvider";
import {useLocale} from "../../providers/LocaleProvider";
import {useNetwork} from "../../providers/NetworkProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";
import {VenueSavedTimePanel} from "./VenueCommunityPanels";

/** Saved preference and one-shot slot watches are private to the current account. */
export function VenueSavedTimesAndAlertsPanel({venue}:{venue:PublicVenueDto}){
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const {isOnline,reconnectVersion}=useNetwork();
  const tr=(key:string)=>t(("vd3."+key) as never);
  const [watches,setWatches]=useState<VenueSlotWatchDto[]>([]);
  const [loading,setLoading]=useState(false);
  const [busyId,setBusyId]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const sequence=useRef(0);
  const token=session?.accessToken;
  const load=useCallback(async()=>{
    const request=++sequence.current;
    setWatches([]);setError(null);setBusyId(null);
    if(!token){setLoading(false);return;}
    setLoading(true);
    try{
      const result=await bookingApi.slotWatches(token,venue.id);
      if(request!==sequence.current)return;
      setWatches(result.watches.filter(item=>item.venueId===venue.id&&
        Date.parse(item.expiresAt)>Date.now())
        .sort((a,b)=>a.startsAt.localeCompare(b.startsAt)));
    }catch{
      if(request===sequence.current)setError(tr("watchLoadError"));
    }finally{
      if(request===sequence.current)setLoading(false);
    }
  },[token,venue.id,t]);
  useEffect(()=>{
    void load();
    return()=>{sequence.current+=1;};
  },[load,reconnectVersion]);
  async function stopWatch(watch:VenueSlotWatchDto){
    if(!token||!isOnline||busyId)return;
    const request=sequence.current;
    setBusyId(watch.id);setError(null);
    try{
      const result=await bookingApi.unwatchSlot(token,watch.id);
      if(request!==sequence.current)return;
      if(!result.removed)throw new Error("Watch not found");
      setWatches(items=>items.filter(item=>item.id!==watch.id));
    }catch{
      if(request===sequence.current)setError(tr("watchRemoveError"));
    }finally{
      if(request===sequence.current)setBusyId(null);
    }
  }
  function displayDate(value:string){
    const date=new Date(value);
    if(!Number.isFinite(date.getTime()))return "";
    return new Intl.DateTimeFormat(language==="en"?"en-GB":language,{
      timeZone:venue.timezone,weekday:"short",day:"numeric",month:"short",year:"numeric",
    }).format(date);
  }
  return <View testID="venue-reserve-saved-alerts" style={{gap:spacing.md}}>
    <VenueSavedTimePanel venue={venue}/>
    <Card style={{gap:spacing.md}}>
      <View style={[{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}]}>
        <Ionicons name="notifications-outline" size={23} color={colors.primary}/>
        <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>{tr("watchedSlots")}</AppText>
      </View>
      <AppText variant="caption" muted>{tr("watchExplanation")}</AppText>
      {!token?<AppText muted>{tr("signInWatches")}</AppText>:<>
        {loading?<DataLoadingState variant="list" minHeight={100}/>:null}
        {!loading&&watches.length===0&&!error?<AppText muted>{tr("noWatches")}</AppText>:null}
        {watches.map(watch=><View key={watch.id} testID={"venue-watch-"+watch.id}
          style={{gap:spacing.sm,borderTopWidth:1,borderColor:colors.border,
            paddingTop:spacing.sm}}>
          <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
            <Ionicons name="time-outline" size={19} color={colors.primary}/>
            <View style={{flex:1,gap:3}}>
              <AppText weight="semibold">{displayDate(watch.startsAt)}</AppText>
              <AppText weight="medium" forceLtr>{formatAppClock(watch.startsAt,venue.timezone)}</AppText>
            </View>
            <Button variant="secondary" label={tr("stopWatching")}
              disabled={!isOnline||busyId!==null} loading={busyId===watch.id}
              onPress={()=>void stopWatch(watch)}/>
          </View>
        </View>)}
        {error?<AppText style={{color:colors.danger}}>{error}</AppText>:null}
        <Button variant="secondary" label={t("common.retry")}
          disabled={loading||busyId!==null||!isOnline}
          onPress={()=>void load()}/>
      </>}
    </Card>
  </View>;
}
