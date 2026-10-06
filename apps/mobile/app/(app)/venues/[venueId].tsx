import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { FollowStateDto, PublicVenueDto, VenueAvailabilityResponse } from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ApiRequestError, marketingApi, venueApi } from "../../../src/lib/api";
import { readAvailabilityCache, writeAvailabilityCache } from "../../../src/lib/availability-cache";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";
import { useNetwork } from "../../../src/providers/NetworkProvider";

function todayKabul(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kabul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function timeLabel(iso:string,timeZone:string){return new Intl.DateTimeFormat("en-GB",{timeZone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(iso));}

export default function VenueDetailScreen(){
  const {venueId,promotionId,startsAt}=useLocalSearchParams<{venueId:string;promotionId?:string;startsAt?:string}>();
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const {isOnline,reconnectVersion}=useNetwork();
  const [venue,setVenue]=useState<PublicVenueDto|null>(null);
  const [date,setDate]=useState(todayKabul());
  const [availability,setAvailability]=useState<VenueAvailabilityResponse|null>(null);
  const [live,setLive]=useState(false);
  const [cachedAt,setCachedAt]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [followState,setFollowState]=useState<FollowStateDto|null>(null);
  const [followBusy,setFollowBusy]=useState(false);

  const load=useCallback(async()=>{
    if(!venueId)return;
    setLoading(true);setError(null);
    try{
      if(!venue)setVenue((await venueApi.get(venueId)).venue);
      if(!isOnline)throw new ApiRequestError("NETWORK_ERROR","Offline",null);
      const next=await venueApi.availability(venueId,date);
      setAvailability(next);setVenue(next.venue);setLive(true);setCachedAt(null);
      await writeAvailabilityCache(next);
    }catch(cause){
      const cached=await readAvailabilityCache(venueId,date);
      if(cached){setAvailability(cached.value);setVenue(cached.value.venue);setLive(false);setCachedAt(cached.cachedAt);}
      else setError(cause instanceof ApiRequestError&&cause.isNetworkError?t("booking.offlineNoCache"):t("booking.loadAvailabilityError"));
    }finally{setLoading(false);}
  },[date,isOnline,t,venue,venueId]);

  useEffect(()=>{void load();},[venueId,date,reconnectVersion]);

  useEffect(()=>{
    if(!venue||!startsAt)return;
    const promotedDate=new Intl.DateTimeFormat("en-CA",{timeZone:venue.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(startsAt));
    if(promotedDate!==date)setDate(promotedDate);
  },[date,startsAt,venue]);

  useEffect(()=>{
    if(!session||!venueId)return;
    marketingApi.followState(session.accessToken,venueId).then(setFollowState).catch(()=>{});
  },[session,venueId]);

  async function toggleFollow(){
    if(!session||!venueId||!followState)return;
    setFollowBusy(true);setError(null);
    try{
      setFollowState(followState.following
        ?await marketingApi.unfollow(session.accessToken,venueId)
        :await marketingApi.follow(session.accessToken,venueId));
    }catch{
      setError(t("feed.followError"));
    }finally{setFollowBusy(false);}
  }

  return <Screen showHeader>
    {venue?<>
      <View style={styles.hero}>
        <View style={styles.heroMark}>
          <Ionicons name="football-outline" size={36} color={colors.primary}/>
        </View>
        <View style={styles.heroCopy}>
          <View style={styles.typeBadge}>
            <AppText variant="caption" weight="bold" style={styles.typeBadgeText}>{t("social.entity.VENUE")}</AppText>
          </View>
          <AppText variant="title" weight="bold" style={styles.heroTitle}>{venue.name}</AppText>
          <View style={[styles.inline,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Ionicons name="location-outline" size={16} color="#DCE8FF"/>
            <AppText style={styles.heroMuted}>{venue.city}, {venue.province}</AppText>
          </View>
          {followState?<AppText variant="caption" style={styles.heroMuted}>{t("social.followers",{count:followState.followerCount})}</AppText>:null}
        </View>
      </View>

      {followState?<Button
        label={followState.following?t("social.unfollow"):t("social.follow")}
        onPress={()=>void toggleFollow()}
        loading={followBusy}
        variant={followState.following?"secondary":"primary"}
      />:null}

      <View style={styles.statGrid}>
        <ProfileStat icon="grid-outline" value={String(venue.areas.length)} label={t("publicProfile.playingAreas")}/>
        <ProfileStat icon="flash-outline" value={t(`publicProfile.bookingMode.${venue.bookingMode}` as never)} label={t("publicProfile.bookingMode")}/>
      </View>

      <Card style={styles.aboutCard}>
        <View style={[styles.sectionHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.sectionIcon}><Ionicons name="information-circle-outline" size={21} color={colors.primary}/></View>
          <AppText variant="bodyLarge" weight="bold">{t("publicProfile.aboutVenue")}</AppText>
        </View>
        <InfoRow icon="location-outline" value={venue.address} rtl={isRTL}/>
        <InfoRow icon="call-outline" value={venue.publicPhone} rtl={isRTL} ltr/>
        <InfoRow icon="time-outline" value={venue.timezone} rtl={isRTL} ltr/>
      </Card>
    </>:null}

    <View style={{gap:spacing.xs}}>
      <AppText variant="bodyLarge" weight="bold">{t("publicProfile.availability")}</AppText>
      <AppText muted>{t("publicProfile.availabilityBody")}</AppText>
    </View>

    <Card style={{gap:spacing.md}}>
      <TextField label={t("booking.date")} value={date} onChangeText={setDate} forceLtr hint="YYYY-MM-DD"/>
      <Button label={t("common.retry")} onPress={()=>void load()} loading={loading} variant="secondary"/>
    </Card>

    {!live&&availability?<Card style={{backgroundColor:colors.surfaceMuted}}>
      <AppText weight="semibold" style={{color:colors.warning}}>{t("booking.cachedAvailability")}</AppText>
      <AppText>{t("booking.cachedAvailabilityBody")}</AppText>
      {cachedAt?<AppText variant="caption" forceLtr>{cachedAt}</AppText>:null}
    </Card>:null}

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    {availability?.slots.length===0?<Card><AppText>{t("booking.noSlots")}</AppText></Card>:null}

    {availability?.slots.map((slot)=><Card
      key={`${slot.areaId}-${slot.startsAt}`}
      style={[
        styles.slotCard,
        promotionId&&slot.promotionId===promotionId?styles.slotPromoted:undefined,
      ]}
    >
      <View style={[styles.slotHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.slotIcon}><Ionicons name="football-outline" size={20} color={colors.primary}/></View>
        <View style={{flex:1,gap:2}}>
          <AppText weight="bold">{slot.areaName}</AppText>
          <AppText variant="caption" muted forceLtr>
            {timeLabel(slot.startsAt,availability.venue.timezone)} - {timeLabel(slot.endsAt,availability.venue.timezone)}
          </AppText>
        </View>
        <AppText weight="bold" style={{color:colors.primary}}>{slot.priceAfn} AFN</AppText>
      </View>
      {slot.promotionId?<View style={styles.promoBadge}>
        <AppText variant="caption" weight="bold" style={{color:colors.primary}}>{t("feed.promotedSlot")}</AppText>
        {slot.originalPriceAfn!==null?<AppText variant="caption" muted style={{textDecorationLine:"line-through"}}>{slot.originalPriceAfn} AFN</AppText>:null}
      </View>:null}
      <Button
        label={live&&isOnline?t("booking.bookNow"):t("booking.liveRequired")}
        disabled={!live||!isOnline}
        onPress={()=>router.push({pathname:"/booking/confirm",params:{
          venueId:slot.venueId,areaId:slot.areaId,areaName:slot.areaName,venueName:availability.venue.name,
          startsAt:slot.startsAt,endsAt:slot.endsAt,priceAfn:String(slot.priceAfn),timeZone:availability.venue.timezone
        }})}
      />
    </Card>)}
  </Screen>;
}

function ProfileStat({icon,value,label}:{icon:keyof typeof Ionicons.glyphMap;value:string;label:string}){
  return <Card style={styles.statCard}>
    <View style={styles.statIcon}><Ionicons name={icon} size={20} color={colors.primary}/></View>
    <AppText weight="bold" style={{textAlign:"center"}}>{value}</AppText>
    <AppText variant="caption" muted style={{textAlign:"center"}}>{label}</AppText>
  </Card>;
}

function InfoRow({icon,value,rtl,ltr=false}:{icon:keyof typeof Ionicons.glyphMap;value:string;rtl:boolean;ltr?:boolean}){
  return <View style={[styles.infoRow,{flexDirection:rtl?"row-reverse":"row"}]}>
    <Ionicons name={icon} size={18} color={colors.textMuted}/>
    <AppText style={{flex:1}} forceLtr={ltr}>{value}</AppText>
  </View>;
}

const styles=StyleSheet.create({
  hero:{
    borderRadius:radius.lg,
    padding:spacing.lg,
    backgroundColor:colors.primary,
    alignItems:"center",
    gap:spacing.md,
  },
  heroMark:{
    width:82,
    height:82,
    borderRadius:41,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:"#FFFFFF",
    borderWidth:4,
    borderColor:"#DCE8FF",
  },
  heroCopy:{alignItems:"center",gap:spacing.xs},
  heroTitle:{color:"#FFFFFF",textAlign:"center"},
  heroMuted:{color:"#DCE8FF",textAlign:"center"},
  typeBadge:{paddingHorizontal:spacing.sm,paddingVertical:4,borderRadius:radius.pill,backgroundColor:"rgba(255,255,255,0.16)"},
  typeBadgeText:{color:"#FFFFFF"},
  inline:{alignItems:"center",gap:4},
  statGrid:{flexDirection:"row",gap:spacing.sm},
  statCard:{flex:1,alignItems:"center",gap:spacing.xs,padding:spacing.md},
  statIcon:{width:36,height:36,borderRadius:18,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  aboutCard:{gap:spacing.md},
  sectionHeading:{alignItems:"center",gap:spacing.sm},
  sectionIcon:{width:38,height:38,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  infoRow:{alignItems:"center",gap:spacing.sm},
  slotCard:{gap:spacing.md},
  slotPromoted:{borderWidth:2,borderColor:colors.primary},
  slotHeader:{alignItems:"center",gap:spacing.sm},
  slotIcon:{width:40,height:40,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  promoBadge:{flexDirection:"row",alignItems:"center",gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:colors.primarySoft},
});
