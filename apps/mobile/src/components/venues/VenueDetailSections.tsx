import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {BookingDto,PromotionDto,PublicVenueDto,VenueAvailabilityResponse,VenuePostDto} from "@leaguekick/contracts";
import {router} from "expo-router";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {Image,Linking,Modal,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {ApiRequestError,bookingApi,marketingApi,resolveMediaImageUrl,venueApi} from "../../lib/api";
import {readAvailabilityCache,writeAvailabilityCache} from "../../lib/availability-cache";
import {formatPostTimeAgo} from "../../lib/date-time";
import {usePostTimeNow} from "../../hooks/usePostTimeNow";
import {useAuth} from "../../providers/AuthProvider";
import {useLocale} from "../../providers/LocaleProvider";
import {useNetwork} from "../../providers/NetworkProvider";
import {NearbyVenuesMap} from "./NearbyVenuesMap";
import {VenueSlotTimetable} from "./VenueSlotTimetable";
import {VenueReviewsPanel} from "./VenueCommunityPanels";
import {VenueSavedTimesAndAlertsPanel} from "./VenueSavedTimesAndAlertsPanel";
import {VenueCompetitionsPanel} from "./VenueCompetitionsPanel";
import {SlotTileContent} from "../ui/SlotTileContent";
import {softenSlotColor} from "../../lib/slot-color";
import {ReservationsPanel} from "../bookings/ReservationsPanel";
import {formatSlotStartTime,formatSlotTilePrice} from "../../lib/slot-display";
import {formatAppClock,formatClock12From24Hour} from "../../lib/clock-display";
import {callVenueUrl,venueWhatsAppUrl} from "../../lib/venue-contact";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";
import {TextField} from "../ui/TextField";

export type VenueMainTab="media"|"reserve"|"competitions"|"updates"|"about";
export type VenueMediaSub="posts"|"photos"|"videos";
export type VenueReserveSub="slots"|"offers"|"bookings"|"saved";
export type VenueCompetitionSub="registration"|"upcoming"|"live"|"completed"|"matches";
export type VenueUpdatesSub="announcements"|"alerts";
export type VenueAboutSub="overview"|"facilities"|"hours"|"location"|"reviews"|"policies";
export const venueNavItems:{id:VenueMainTab;icon:keyof typeof Ionicons.glyphMap}[]=[
  {id:"media",icon:"images-outline"},{id:"reserve",icon:"calendar-outline"},
  {id:"competitions",icon:"trophy-outline"},{id:"updates",icon:"notifications-outline"},
  {id:"about",icon:"information-circle-outline"},
];
export const venueSubtabs:Record<VenueMainTab,string[]>={
  media:["posts","photos","videos"],reserve:["slots","offers","bookings","saved"],
  competitions:["registration","upcoming","live","completed","matches"],updates:["announcements","alerts"],
  about:["overview","facilities","hours","location","reviews","policies"],
};
export function todayAtKabul(){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kabul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const values=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return values.year+"-"+values.month+"-"+values.day;
}
export function shiftVenueDate(day:string,offset:number){
  const value=Date.parse(day+"T12:00:00Z");
  return Number.isFinite(value)?new Date(value+offset*86400000).toISOString().slice(0,10):day;
}
function messageForError(error:unknown,fallback:string){
  return error instanceof Error?error.message:fallback;
}
function Empty({icon,title,detail,action}:{icon:keyof typeof Ionicons.glyphMap;title:string;detail?:string;action?:()=>void}){
  const {t}=useLocale();
  return <Card style={styles.empty}>
    <View style={styles.emptyIcon}><Ionicons name={icon} size={28} color={colors.primary}/></View>
    <AppText weight="bold" style={{textAlign:"center"}}>{title}</AppText>
    {detail?<AppText variant="caption" muted style={{textAlign:"center"}}>{detail}</AppText>:null}
    {action?<Button variant="secondary" label={t("common.retry")} onPress={action}/>:null}
  </Card>;
}
function Pill({label,selected,onPress}:{label:string;selected:boolean;onPress:()=>void}){
  return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress}
    style={[styles.pill,selected&&styles.pillActive]}>
    <AppText weight="semibold" variant="caption"
      style={{textAlign:"center",color:selected?"#FFFFFF":colors.primary}}>{label}</AppText>
  </Pressable>;
}
function MetaRow({icon,value,forceLtr=false}:{icon:keyof typeof Ionicons.glyphMap;value:string;forceLtr?:boolean}){
  const {isRTL}=useLocale();
  return <View style={[styles.meta,{flexDirection:isRTL?"row-reverse":"row"}]}>
    <Ionicons name={icon} color={colors.primary} size={18}/>
    <AppText style={{flex:1}} forceLtr={forceLtr}>{value}</AppText>
  </View>;
}
function SectionHeading({name,icon}:{name:string;icon:keyof typeof Ionicons.glyphMap}){
  const {isRTL}=useLocale();
  return <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
    <View style={styles.headingIcon}><Ionicons name={icon} size={20} color={colors.primary}/></View>
    <AppText variant="bodyLarge" weight="bold">{name}</AppText>
  </View>;
}

function venueVideoLink(text:string){
  const match=text.match(/https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[\w-]{7,}|youtu\.be\/[\w-]{7,}|vimeo\.com\/[0-9]{4,})[^\s]*/i);
  return match?.[0]??null;
}
type VenueContentProps={venue:PublicVenueDto;sub:VenueMediaSub|"announcements"|"alerts";onReserve:(startsAt?:string,promotionId?:string)=>void};
export function VenueMediaContent({venue,sub,onReserve}:VenueContentProps){
  const {t,isRTL,language}=useLocale(),tr=(key:string)=>t(("vd."+key) as never);
  const {session}=useAuth(),now=usePostTimeNow();
  const [posts,setPosts]=useState<VenuePostDto[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false);
  const [filter,setFilter]=useState<"all"|"promotion"|"competition">("all");
  const [photo,setPhoto]=useState<string|null>(null);
  const load=useCallback(async()=>{
    setLoading(true);setError(false);
    try{const value=await marketingApi.venuePosts(venue.id,session?.accessToken);
      setPosts(value.posts);}
    catch{setError(true);}
    finally{setLoading(false);}
  },[venue.id,session?.accessToken]);
  useEffect(()=>{void load();},[load]);
  const photos=useMemo(()=>posts.filter(p=>!!resolveMediaImageUrl(p.imageUrl)),[posts]);
  const videos=useMemo(()=>posts.flatMap(p=>{
    const url=venueVideoLink(p.body);
    return url?[{...p,videoUrl:url}]:[];
  }),[posts]);
  const filtered=useMemo(()=>{
    if(sub==="announcements"||sub==="alerts")return posts.filter(p=>p.postType==="ANNOUNCEMENT");
    if(filter==="promotion")return posts.filter(p=>p.postType==="PROMOTION");
    if(filter==="competition")return posts.filter(p=>p.postType==="COMPETITION");
    return posts;
  },[posts,filter,sub]);
  async function openCta(post:VenuePostDto){
    if(post.ctaType==="COMPETITION"&&post.ctaTargetId){
      router.push({pathname:"/competitions/[competitionId]",params:{competitionId:post.ctaTargetId}});
    }else if(post.ctaType==="PROMOTION"&&post.ctaTargetId){
      try{
        const result=await marketingApi.promotion(post.ctaTargetId);
        if(result.promotion.venueId===venue.id)
          onReserve(result.promotion.startsAt,result.promotion.id);
      }catch{setError(true);}
    }else if(post.ctaType==="VENUE")onReserve();
  }
  if(loading)return <DataLoadingState variant="list" minHeight={240}/>;
  if(error)return <Empty icon="cloud-offline-outline" title={tr("postsError")} action={()=>void load()}/>;
  if(sub==="photos")return <>
    {photos.length===0?<Empty icon="images-outline" title={tr("noPhotos")}/>:<View style={styles.photoGrid}>
      {photos.map(p=><Pressable key={p.id} style={styles.photoItem}
        accessibilityRole="button" accessibilityLabel={tr("viewPhoto")}
        onPress={()=>setPhoto(resolveMediaImageUrl(p.imageUrl))}>
        <Image source={{uri:resolveMediaImageUrl(p.imageUrl)!}} style={styles.photo} resizeMode="cover"/>
      </Pressable>)}
    </View>}
    <Modal visible={!!photo} animationType="fade" transparent onRequestClose={()=>setPhoto(null)}>
      <View style={styles.viewer}>
        <Button label={tr("close")} variant="secondary" onPress={()=>setPhoto(null)}/>
        {photo?<Image source={{uri:photo}} resizeMode="contain" style={styles.viewerImage}/>:null}
      </View>
    </Modal>
  </>;
  if(sub==="videos")return videos.length===0?
    <Empty icon="videocam-outline" title={tr("noVideos")} detail={tr("videosHint")}/>:
    <>{videos.map(p=><Card key={p.id} style={{gap:spacing.sm}}>
      <SectionHeading icon="play-circle-outline" name={tr("videoPost")}/>
      {resolveMediaImageUrl(p.imageUrl)?<Image source={{uri:resolveMediaImageUrl(p.imageUrl)!}}
        style={styles.postPhoto} resizeMode="cover"/>:null}
      <AppText>{p.body}</AppText>
      <Button label={tr("playVideo")} onPress={()=>void Linking.openURL(p.videoUrl)}/>
    </Card>)}</>;
  if(sub==="alerts"){
    return <>{!venue.onlineBookingEnabled?<Card>
      <SectionHeading icon="alert-circle-outline" name={tr("bookingPaused")}/>
      <AppText muted>{tr("bookingPausedBody")}</AppText>
    </Card>:null}
    <Empty icon="shield-checkmark-outline" title={tr("noAdditionalAlerts")}
      detail={tr("updatesInfo")}/></>;
  }
  if(sub==="announcements"&&filtered.length===0)
    return <Empty icon="megaphone-outline" title={tr("noAnnouncements")}/>;
  return <>
    {sub==="posts"?<View style={[styles.filters,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {(["all","promotion","competition"] as const).map(key=>
        <Pill key={key} selected={filter===key} label={tr("filter."+key)}
          onPress={()=>setFilter(key)}/>)}
    </View>:null}
    {filtered.length===0?<Empty icon="document-text-outline" title={tr("noPosts")}/>:null}
    {filtered.map(post=><Card key={post.id} style={{gap:spacing.md}}>
      <View style={[styles.meta,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.smallAvatar}><Ionicons name="football" size={17} color={colors.primary}/></View>
        <View style={{flex:1}}>
          <AppText weight="bold">{venue.name}</AppText>
          <AppText variant="caption" muted>{formatPostTimeAgo(post.publishedAt,language,now)}</AppText>
        </View>
        <View style={styles.badge}>
          <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
            {t(("media.type."+post.postType) as never)}
          </AppText>
        </View>
      </View>
      <AppText>{post.body}</AppText>
      {resolveMediaImageUrl(post.imageUrl)?<Pressable accessibilityRole="button"
        onPress={()=>setPhoto(resolveMediaImageUrl(post.imageUrl))}>
        <Image source={{uri:resolveMediaImageUrl(post.imageUrl)!}} style={styles.postPhoto} resizeMode="cover"/>
      </Pressable>:null}
      <View style={[styles.filters,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {post.ctaType!=="NONE"&&post.ctaTargetId?<Button variant="secondary"
          label={t("feed.openCta")} onPress={()=>void openCta(post)}/>:null}
        {post.socialPostId?<Button variant="secondary" label={t("social.comment")} onPress={()=>
          router.push({pathname:"/posts/[postId]/comments",params:{postId:post.socialPostId!}})}/>:null}
        <Button variant="ghost" label={t("feed.openPost")} onPress={()=>
          router.push({pathname:"/posts/[postId]",params:{postId:post.id}})}/>
      </View>
    </Card>)}
    <Modal visible={!!photo} animationType="fade" transparent onRequestClose={()=>setPhoto(null)}>
      <View style={styles.viewer}>
        <Button label={tr("close")} variant="secondary" onPress={()=>setPhoto(null)}/>
        {photo?<Image source={{uri:photo}} resizeMode="contain" style={styles.viewerImage}/>:null}
      </View>
    </Modal>
  </>;
}

function ReserveStatusBanner({venue}:{venue:PublicVenueDto}){
  const {t}=useLocale(),tr=(key:string)=>t(("vd3."+key) as never);
  return <Card style={{gap:spacing.xs,backgroundColor:colors.primarySoft}}>
    <View style={{flexDirection:"row",gap:spacing.sm,alignItems:"center"}}>
      <Ionicons name={venue.onlineBookingEnabled
        ?venue.bookingMode==="APPROVAL"?"hourglass-outline":"checkmark-circle-outline"
        :"pause-circle-outline"} color={colors.primary} size={21}/>
      <AppText weight="semibold" style={{flex:1}}>
        {!venue.onlineBookingEnabled?tr("bookingPaused"):
          venue.bookingMode==="APPROVAL"?tr("approvalMode"):tr("instantMode")}
      </AppText>
    </View>
    <AppText variant="caption" muted>
      {!venue.onlineBookingEnabled?tr("bookingPausedDescription"):
        venue.bookingMode==="APPROVAL"?tr("approvalDescription"):tr("instantDescription")}
    </AppText>
  </Card>;
}

export function VenueReserveContent({venue,sub,startsAt,promotionId,bookingDate}:{
  venue:PublicVenueDto;sub:VenueReserveSub;startsAt?:string|undefined;promotionId?:string|undefined;
  bookingDate?:string|undefined;
}){
  const {session}=useAuth(),{isOnline,reconnectVersion}=useNetwork();
  const {t,language,isRTL}=useLocale(),tr=(key:string)=>t(("vd."+key) as never);
  const tr3=(key:string)=>t(("vd3."+key) as never);
  const [date,setDate]=useState(bookingDate??todayAtKabul());
  const [availability,setAvailability]=useState<VenueAvailabilityResponse|null>(null);
  const [availabilityDate,setAvailabilityDate]=useState<string|null>(null);
  const [loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null);
  const [fresh,setFresh]=useState(false),[cachedAt,setCachedAt]=useState<string|null>(null);
  const [bookings,setBookings]=useState<BookingDto[]>([]),[bookingsLoading,setBookingsLoading]=useState(true);
  const [bookingsActor,setBookingsActor]=useState<string|null>(null);
  const bookingLoadSerial=useRef(0);
  const [promotions,setPromotions]=useState<PromotionDto[]>([]);
  const [promotionsLoading,setPromotionsLoading]=useState(false);
  const [promotionsError,setPromotionsError]=useState(false);
  const [promotionReload,setPromotionReload]=useState(0);
  const [promotionLimit,setPromotionLimit]=useState(8);
  const [highlightPromo,setHighlightPromo]=useState<string|null>(promotionId??null);
  const [openingSlot,setOpeningSlot]=useState<string|null>(null);
  const offerRequestSerial=useRef(0);
  const offerNavigationEpoch=useRef(0);
  useEffect(()=>()=>{offerNavigationEpoch.current+=1;},[venue.id]);
  const [reload,setReload]=useState(0);
  const today=todayAtKabul();
  const maximum=shiftVenueDate(today,venue.maximumAdvanceBookingDays);
  const dateValid=/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+"T12:00:00Z"))
    &&date>=today&&date<=maximum;
  useEffect(()=>{
    if(!startsAt){if(bookingDate&&/^\d{4}-\d{2}-\d{2}$/.test(bookingDate))setDate(bookingDate);return;}
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:venue.timezone,year:"numeric",
      month:"2-digit",day:"2-digit"}).formatToParts(new Date(startsAt));
    const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    const next=v.year+"-"+v.month+"-"+v.day;
    if(/^\d{4}-\d{2}-\d{2}$/.test(next))setDate(next);
  },[venue.id,startsAt,bookingDate]);
  const load=useCallback(async()=>{
    if(!dateValid||!venue.onlineBookingEnabled)return;
    setLoading(true);setError(null);
    try{
      if(!isOnline)throw new ApiRequestError("NETWORK_ERROR","Offline",null);
      const response=await venueApi.availability(venue.id,date);
      setAvailability(response);setAvailabilityDate(date);setFresh(true);setCachedAt(null);
      await writeAvailabilityCache(response);
    }catch(e){
      const cached=await readAvailabilityCache(venue.id,date);
      if(cached){setAvailability(cached.value);setAvailabilityDate(date);setFresh(false);setCachedAt(cached.cachedAt);}
      else{setAvailability(null);setAvailabilityDate(null);setFresh(false);
        setError(e instanceof ApiRequestError&&e.isNetworkError?
          t("booking.offlineNoCache"):t("booking.loadAvailabilityError"));}
    }finally{setLoading(false);}
  },[date,dateValid,isOnline,venue.id,venue.onlineBookingEnabled,t]);
  // The time-grid has its own scoped 1- or 7-day availability loader.
  // Avoid a second parallel request from the Offers view loader.
  useEffect(()=>{if(sub==="offers")void load();},[sub,date,reconnectVersion,reload,load]);
  useEffect(()=>{
    const serial=++offerRequestSerial.current;
    if(sub!=="offers"){setPromotions([]);setPromotionsLoading(false);return;}
    setPromotions([]);setPromotionsError(false);setPromotionsLoading(true);
    void marketingApi.venuePromotions(venue.id).then(result=>{
      if(serial===offerRequestSerial.current)setPromotions(result.promotions.filter(item=>
        item.venueId===venue.id&&item.status==="ACTIVE"&&
        Date.parse(item.startsAt)>Date.now()).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)));
    }).catch(()=>{if(serial===offerRequestSerial.current)setPromotionsError(true);})
      .finally(()=>{if(serial===offerRequestSerial.current)setPromotionsLoading(false);});
    return()=>{offerRequestSerial.current+=1;};
  },[sub,venue.id,promotionReload,reconnectVersion]);
  const loadMine=useCallback(async()=>{
    const serial=++bookingLoadSerial.current;
    if(!session){setBookings([]);setBookingsActor(null);setBookingsLoading(false);return;}
    setBookingsLoading(true);setError(null);
    try{
      const result=await bookingApi.mine(session.accessToken);
      if(serial===bookingLoadSerial.current){
        setBookings(result.bookings.filter(x=>x.venueId===venue.id&&x.playerUserId===session.user.id));
        setBookingsActor(session.user.id);
      }
    }catch(e){
      if(serial===bookingLoadSerial.current)
        setError(messageForError(e,t("booking.loadBookingsError")));
    }finally{
      if(serial===bookingLoadSerial.current)setBookingsLoading(false);
    }
  },[session?.accessToken,session?.user.id,venue.id,t]);
  useEffect(()=>{if(sub==="bookings"&&session)void loadMine();},[sub,venue.id,reload,session?.accessToken,loadMine]);
  async function cancel(id:string){
    if(!session||!isOnline)throw Error("Not connected");
    setError(null);
    try{
      const response=await bookingApi.cancel(session.accessToken,id);
      setBookings(previous=>previous.map(x=>x.id===id?response.booking:x));
      void loadMine();
    }catch(e){
      setError(messageForError(e,t("booking.cancelError")));
      throw e;
    }
  }
  async function openSlot(slot:VenueAvailabilityResponse["slots"][number]){
    if(!fresh||!isOnline||availabilityDate!==date||openingSlot)return;
    const key=slot.areaId+"-"+slot.startsAt;
    const epoch=offerNavigationEpoch.current;
    setOpeningSlot(key);setError(null);
    try{
      const live=await venueApi.availabilityLive(venue.id,date);
      if(epoch!==offerNavigationEpoch.current)return;
      const verified=live.slots.find(item=>item.areaId===slot.areaId&&
        item.startsAt===slot.startsAt&&item.endsAt===slot.endsAt&&
        item.promotionId===slot.promotionId&&item.priceAfn===slot.priceAfn);
      if(!verified||!live.venue.onlineBookingEnabled)throw Error("Offer changed");
      router.push({pathname:"/booking/confirm",params:{
        venueId:venue.id,areaId:verified.areaId,venueName:venue.name,
        startsAt:verified.startsAt,endsAt:verified.endsAt,priceAfn:String(verified.priceAfn),
        timeZone:venue.timezone,
      }});
    }catch{
      if(epoch===offerNavigationEpoch.current){
        setError(tr3("offerChanged"));
        setFresh(false);
        setReload(value=>value+1);
        setPromotionReload(value=>value+1);
      }
    }finally{if(epoch===offerNavigationEpoch.current)setOpeningSlot(null);}
  }
  function choosePromotion(item:PromotionDto){
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:venue.timezone,
      year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(item.startsAt));
    const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
    const target=values.year+"-"+values.month+"-"+values.day;
    if(target<today||target>maximum){
      setError(tr3("outsideBookingWindow"));return;
    }
    setError(null);setHighlightPromo(item.id);setDate(target);
  }
  if(sub==="saved")return <VenueSavedTimesAndAlertsPanel venue={venue}/>;
  if(sub==="slots")return <View style={{gap:spacing.md}}>
    <ReserveStatusBanner venue={venue}/>
    <VenueSlotTimetable venue={venue} startsAt={startsAt}
      promotionId={promotionId} initialDate={bookingDate}/>
  </View>;
  const usable=availabilityDate===date?availability?.slots??[]:[];
  const slots=sub==="offers"?usable.filter(slot=>slot.promotionId!==null):usable;
  if(sub==="bookings")return <View style={{gap:spacing.md}}>
    <ReserveStatusBanner venue={venue}/>
    {!session
      ?<Empty icon="person-outline" title={tr("signInBookings")} detail={tr("signInBookingsHint")}/>
      :<ReservationsPanel items={bookingsActor===session.user.id?bookings.filter(b=>b.venueId===venue.id):[]}
        loading={bookingsLoading} error={error}
        onRefresh={()=>void loadMine()} onCancel={cancel} scopedVenueId={venue.id}/>}
  </View>;
  return <>
    <ReserveStatusBanner venue={venue}/>
    {!venue.onlineBookingEnabled?<Empty icon="pause-circle-outline"
      title={tr("bookingPaused")} detail={tr("bookingPausedBody")}/>:<>
      <Card style={{gap:spacing.sm}}>
        <SectionHeading icon="pricetags-outline" name={tr3("upcomingOffers")}/>
        <AppText variant="caption" muted>{tr3("offersDisclaimer")}</AppText>
        {promotionsLoading?<DataLoadingState variant="list" minHeight={100}/>:null}
        {promotionsError?<AppText style={{color:colors.danger}}>{tr3("offersLoadError")}</AppText>:null}
        {!promotionsLoading&&!promotionsError&&!promotions.length?
          <AppText variant="caption" muted>{tr3("noUpcomingOffers")}</AppText>:null}
        {promotions.slice(0,promotionLimit).map(promo=><View key={promo.id}
          testID={"venue-offer-"+promo.id}
          style={{gap:spacing.xs,borderTopWidth:1,borderColor:colors.border,
            paddingTop:spacing.sm}}>
          <AppText weight="bold">{promo.title}</AppText>
          <AppText variant="caption" muted>{new Intl.DateTimeFormat(language==="en"?"en-GB":language,{
            timeZone:venue.timezone,weekday:"short",day:"numeric",month:"short",year:"numeric",
          }).format(new Date(promo.startsAt))+" · "+
            formatAppClock(promo.startsAt,venue.timezone)}</AppText>
          <AppText weight="semibold">{promo.discountedPriceAfn+" AFN · "+
            promo.discountPercent+"% "+tr("off")+" ("+promo.originalPriceAfn+" AFN)"}</AppText>
          {promo.note?<AppText variant="caption" muted>{promo.note}</AppText>:null}
          <Button label={tr3("viewOfferSlots")} variant="secondary"
            onPress={()=>choosePromotion(promo)}/>
        </View>)}
        {promotions.length>promotionLimit?<Button label={tr3("moreOffers")}
          variant="secondary" onPress={()=>setPromotionLimit(current=>current+8)}/>:null}
        <Button variant="secondary" label={t("common.retry")}
          disabled={promotionsLoading} onPress={()=>setPromotionReload(x=>x+1)}/>
      </Card>
      <Card style={{gap:spacing.sm}}>
        <SectionHeading icon="calendar-outline" name={tr("chooseDate")}/>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0}}
          contentContainerStyle={{gap:spacing.xs,flexDirection:isRTL?"row-reverse":"row"}}>
          {Array.from({length:Math.min(7,venue.maximumAdvanceBookingDays+1)},(_,i)=>{
            const day=shiftVenueDate(today,i);
            const formatted=new Intl.DateTimeFormat(language==="en"?"en-GB":language,{
              timeZone:"UTC",weekday:"short",day:"numeric",month:"short",
            }).format(new Date(day+"T12:00:00Z"));
            return <Pill key={day} selected={date===day} label={i===0?tr("today"):formatted}
              onPress={()=>setDate(day)}/>;
          })}
        </ScrollView>
        <View style={[styles.filters,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Button style={{flex:1}} variant="secondary" label={tr("previousDate")}
            disabled={!dateValid||date<=today} onPress={()=>setDate(shiftVenueDate(date,-1))}/>
          <Button style={{flex:1}} variant="secondary" label={tr("nextDate")}
            disabled={!dateValid||date>=maximum} onPress={()=>setDate(shiftVenueDate(date,1))}/>
        </View>
        <TextField label={t("booking.date")} value={date} onChangeText={setDate}
          forceLtr hint={"YYYY-MM-DD · "+tr("dateLimit")+" "+maximum}/>
        {!dateValid?<AppText variant="caption" style={{color:colors.warning}}>{tr("invalidDate")}</AppText>:null}
        <Button variant="secondary" disabled={!dateValid} label={t("common.retry")}
          onPress={()=>setReload(v=>v+1)} loading={loading}/>
      </Card>
      {!fresh&&availabilityDate===date&&availability?<Card style={{backgroundColor:colors.surfaceMuted}}>
        <AppText weight="semibold" style={{color:colors.warning}}>{t("booking.cachedAvailability")}</AppText>
        <AppText variant="caption" muted>{t("booking.cachedAvailabilityBody")}</AppText>
        {cachedAt?<AppText variant="caption" muted>{cachedAt}</AppText>:null}
      </Card>:null}
      {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
      {loading?<DataLoadingState variant="list" minHeight={250}/>:null}
      {!loading&&dateValid&&slots.length===0?<Empty icon="calendar-clear-outline"
        title={sub==="offers"?tr("noOffers"):tr("noSlots")}
        detail={sub==="offers"?tr("offersHint"):tr("tryOtherDate")}/>:null}
      {!loading?<View style={styles.offerGrid}>
        {slots.map(slot=><Pressable key={slot.areaId+"-"+slot.startsAt}
          accessibilityRole="button"
          accessibilityState={{disabled:!fresh||!isOnline||openingSlot!==null}}
          accessibilityLabel={formatSlotStartTime(slot.startsAt,venue.timezone)+
            ", "+formatSlotTilePrice(slot.priceAfn)+
            (slot.originalPriceAfn!==null&&slot.originalPriceAfn>slot.priceAfn?
              ", "+Math.round(100*(1-slot.priceAfn/slot.originalPriceAfn))+"% "+tr("off"):"")}
          disabled={!fresh||!isOnline||openingSlot!==null}
          onPress={()=>void openSlot(slot)}
          style={({pressed})=>[
            styles.offerSlot,
            !fresh||!isOnline?styles.offerDisabled:null,
            (slot.promotionId===highlightPromo||slot.promotionId===promotionId)?styles.highlight:null,
            pressed&&styles.offerPressed,
          ]}>
          <SlotTileContent startsAt={slot.startsAt} timeZone={venue.timezone}
            priceAfn={slot.priceAfn} ink="#7E22CE"
            marker={<Ionicons name="pricetag-outline" size={15} color="#7E22CE"/>}/>
          {promotions.find(p=>p.id===slot.promotionId)?.title?
            <AppText variant="caption" weight="semibold" numberOfLines={2}>
              {promotions.find(p=>p.id===slot.promotionId)?.title}
            </AppText>:null}
          {slot.originalPriceAfn!==null&&slot.originalPriceAfn>slot.priceAfn?
            <AppText variant="caption" muted>
              {slot.originalPriceAfn+" AFN · "+
                Math.round(100*(1-slot.priceAfn/slot.originalPriceAfn))+"% "+tr("off")}
            </AppText>:null}
        </Pressable>)}
      </View>:null}
    </>}
  </>;
}

export function VenueCompetitionsContent({venue,sub}:{venue:PublicVenueDto;sub:VenueCompetitionSub}){
  return <VenueCompetitionsPanel venue={venue} sub={sub}/>;
}

export function VenueUpdatesContent({venue,sub,onReserve}:{
  venue:PublicVenueDto;sub:VenueUpdatesSub;onReserve:()=>void;
}){
  const {t}=useLocale(),tr=(key:string)=>t(("vd."+key) as never);
  return <>
    {sub==="alerts"?<>
      {!venue.onlineBookingEnabled?<Card>
        <SectionHeading name={tr("bookingPaused")} icon="warning-outline"/>
        <AppText muted>{tr("bookingPausedBody")}</AppText>
      </Card>:<Empty icon="checkmark-circle-outline" title={tr("noAlerts")}
        detail={tr("alertsDescription")}/>}
    </>:<VenueMediaContent venue={venue} sub="announcements"
      onReserve={()=>onReserve()}/>}
    <Button label={tr("notificationSettings")} variant="secondary"
      onPress={()=>router.push("/notifications/preferences")}/>
  </>;
}

export function VenueAboutContent({venue,sub,reviewBookingId}:{
  venue:PublicVenueDto;sub:VenueAboutSub;reviewBookingId?:string|undefined;
}){
  const {t,isRTL,language}=useLocale(),tr=(key:string)=>t(("vd."+key) as never);
  const tx=(key:string)=>t(("vd2."+key) as never);
  const [mapFailed,setMapFailed]=useState(false);
  const [linkFailed,setLinkFailed]=useState(false);
  const [reviewFacts,setReviewFacts]=useState<{averageRating:number;reviewCount:number}|null>(null);
  useEffect(()=>{
    let active=true;setReviewFacts(null);
    if(sub==="overview")void venueApi.reviews(venue.id).then(result=>{
      if(active)setReviewFacts({averageRating:result.averageRating,reviewCount:result.reviewCount});
    }).catch(()=>{});
    return()=>{active=false;};
  },[venue.id,sub]);
  const position=venue.latitude!==null&&venue.longitude!==null?
    {latitude:venue.latitude,longitude:venue.longitude}:null;
  const mapVenue=useMemo(()=>position?[{id:venue.id,name:venue.name,city:venue.city,
    province:venue.province,imageUrl:venue.pageProfileImageUrl,
    latitude:position.latitude,longitude:position.longitude,
    distanceKm:0,onlineBookingEnabled:venue.onlineBookingEnabled}]:[],
    [venue.id,venue.name,venue.city,venue.province,venue.pageProfileImageUrl,
      venue.latitude,venue.longitude,venue.onlineBookingEnabled]);
  async function openLink(url:string){
    setLinkFailed(false);
    try{await Linking.openURL(url);}catch{setLinkFailed(true);}
  }
  function maps(){
    if(!position)return;
    void openLink("https://www.google.com/maps/search/?api=1&query="+
      encodeURIComponent(position.latitude+","+position.longitude));
  }
  const callUrl=callVenueUrl(venue.publicPhone);
  const whatsappUrl=venueWhatsAppUrl(venue,language);
  if(sub==="reviews")return <VenueReviewsPanel venue={venue} reviewBookingId={reviewBookingId}/>;

  if(sub==="overview")return <>
    <Card style={{gap:spacing.sm}}>
      <SectionHeading name={tr("aboutVenue")} icon="information-circle-outline"/>
      {venue.verificationStatus==="VERIFIED"?<View style={[styles.meta,{alignSelf:"flex-start"}]}>
        <Ionicons name="shield-checkmark" color="#15803D" size={20}/>
        <AppText weight="semibold" style={{color:"#15803D"}}>{tx("verified")}</AppText>
      </View>:null}
      <AppText>{venue.pageBio||tr("noBio")}</AppText>
      <MetaRow icon="location-outline" value={[venue.city,venue.province].filter(Boolean).join(", ")}/>
      <MetaRow icon="football-outline" value={tr("oneCourt")}/>
      <MetaRow icon={venue.onlineBookingEnabled?"checkmark-circle-outline":"pause-circle-outline"}
        value={venue.onlineBookingEnabled?tx("onlineOpen"):tr("bookingPaused")}/>
    </Card>
    <Card style={{gap:spacing.sm}}>
      <SectionHeading name={tx("customerReviews")} icon="star-outline"/>
      <AppText variant="bodyLarge" weight="bold">{reviewFacts&&reviewFacts.reviewCount>0
        ?reviewFacts.averageRating.toFixed(1)+" / 5 · "+reviewFacts.reviewCount
        :tx("ratingNotAvailable")}</AppText>
      <AppText variant="caption" muted>{tx("verifiedReviewsOnly")}</AppText>
    </Card>
  </>;
  if(sub==="facilities")return <>
    <Card style={{gap:spacing.sm}}>
      <SectionHeading name={tr("courtAndFacilities")} icon="football-outline"/>
      {venue.areas.map(a=><View key={a.id} style={{gap:spacing.xs}}>
        <AppText weight="bold">{a.name}</AppText>
        <MetaRow icon="time-outline" value={a.defaultSessionDurationMinutes+" "+tr("minutes")}/>
        <MetaRow icon="pricetag-outline" value={a.basePriceAfn+" AFN · "+tr("baseRate")}/>
      </View>)}
      <AppText variant="caption" muted>{tr("oneCourt")}</AppText>
    </Card>
    <Card style={{gap:spacing.sm}}>
      <SectionHeading name={tx("amenities")} icon="checkmark-done-outline"/>
      {venue.amenities.length?venue.amenities.map(item=>
        <MetaRow key={item} icon="checkmark-circle-outline" value={tx("amenity."+item)}/>
      ):<AppText muted>{tr("facilitiesNotListed")}</AppText>}
      <AppText variant="caption" muted>{tx("ownerDeclared")}</AppText>
    </Card>
  </>;
  if(sub==="hours")return <>
    <Card style={{gap:spacing.sm}}>
      <SectionHeading name={tx("regularHours")} icon="time-outline"/>
      {venue.openingHours.length?venue.openingHours
        .slice().sort((a,b)=>((a.dayOfWeek+6)%7)-((b.dayOfWeek+6)%7))
        .map(hour=><View key={hour.dayOfWeek}
          style={[styles.meta,{justifyContent:"space-between",flexDirection:isRTL?"row-reverse":"row"}]}>
          <AppText weight="semibold">{tx("day."+hour.dayOfWeek)}</AppText>
          <AppText forceLtr>{hour.isClosed||!hour.opensAt||!hour.closesAt
            ?tx("closed")
            :formatClock12From24Hour(hour.opensAt)+" – "+formatClock12From24Hour(hour.closesAt)}</AppText>
        </View>):<AppText muted>{tx("hoursNotListed")}</AppText>}
      <AppText variant="caption" muted>{tx("hoursDisclaimer")}</AppText>
    </Card>
    <Card style={{gap:spacing.sm}}>
      <SectionHeading name={tx("basePricing")} icon="pricetag-outline"/>
      {venue.areas.map(area=><View key={area.id} style={{gap:spacing.xs}}>
        <AppText weight="bold">{area.name}</AppText>
        <MetaRow icon="pricetag-outline" value={area.basePriceAfn+" AFN"}/>
        <MetaRow icon="time-outline" value={area.defaultSessionDurationMinutes+" "+tr("minutes")}/>
      </View>)}
      <AppText variant="caption" muted>{tx("priceDisclaimer")}</AppText>
    </Card>
  </>;
  if(sub==="policies")return <>
    <Card style={{gap:spacing.sm}}>
      <SectionHeading name={tr("bookingRules")} icon="calendar-outline"/>
      <MetaRow icon="checkmark-circle-outline"
        value={t(("publicProfile.bookingMode."+venue.bookingMode) as never)}/>
      <MetaRow icon="time-outline" value={t("venueSettings.minimumNoticeValue",{
        minutes:venue.minimumBookingNoticeMinutes})}/>
      <MetaRow icon="calendar-outline" value={t("venueSettings.advanceDaysValue",{
        days:venue.maximumAdvanceBookingDays})}/>
      {!venue.onlineBookingEnabled?<AppText style={{color:colors.warning}}>
        {tr("bookingPausedBody")}</AppText>:null}
    </Card>
    <Card style={{gap:spacing.sm}}>
      <SectionHeading name={t("venueSettings.cancellationPolicy")} icon="document-text-outline"/>
      <AppText>{venue.cancellationPolicy}</AppText>
      <AppText variant="caption" muted>{tx("policySnapshot")}</AppText>
    </Card>
    <Card style={{gap:spacing.sm}}>
      <SectionHeading name={tx("houseRules")} icon="shield-checkmark-outline"/>
      <AppText>{venue.houseRules||tx("noHouseRules")}</AppText>
    </Card>
  </>;
  return <Card style={{gap:spacing.sm}}>
    <SectionHeading name={tx("locationContact")} icon="map-outline"/>
    {position?<>
      {!mapFailed?<View style={styles.map}>
        <NearbyVenuesMap position={position} venues={mapVenue} onSelect={maps}
          onReady={()=>{}} onFailed={()=>setMapFailed(true)}/>
      </View>:<AppText muted>{tr("mapUnavailable")}</AppText>}
      <Button variant="secondary" label={tr("openMaps")} onPress={maps}/>
    </>:<AppText muted>{tr("locationNotSet")}</AppText>}
    <MetaRow icon="location-outline" value={[venue.address,venue.city,venue.province].filter(Boolean).join(", ")}/>
    {callUrl?<Button variant="secondary" label={tr("callVenue")}
      onPress={()=>void openLink(callUrl)}/>:null}
    {whatsappUrl?<Button variant="secondary" label={tx("whatsapp")}
      onPress={()=>void openLink(whatsappUrl)}/>:null}
    {linkFailed?<AppText style={{color:colors.danger}}>{tx("contactFailed")}</AppText>:null}
  </Card>;
}
const styles=StyleSheet.create({
  empty:{minHeight:140,padding:spacing.lg,alignItems:"center",justifyContent:"center",gap:spacing.sm},
  emptyIcon:{width:52,height:52,borderRadius:26,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  pill:{minHeight:42,minWidth:78,borderRadius:radius.md,paddingHorizontal:spacing.sm,
    paddingVertical:spacing.sm,alignItems:"center",justifyContent:"center",
    backgroundColor:colors.primarySoft,borderColor:colors.border,borderWidth:1},
  pillActive:{backgroundColor:colors.primary,borderColor:colors.primary},
  filters:{flexWrap:"wrap",gap:spacing.sm,alignItems:"center"},
  meta:{alignItems:"center",gap:spacing.sm},
  heading:{alignItems:"center",gap:spacing.sm},
  headingIcon:{width:34,height:34,borderRadius:12,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  badge:{alignSelf:"flex-start",paddingHorizontal:spacing.sm,paddingVertical:4,
    borderRadius:radius.md,backgroundColor:colors.primarySoft},
  smallAvatar:{width:36,height:36,borderRadius:18,backgroundColor:colors.primarySoft,
    justifyContent:"center",alignItems:"center"},
  photoGrid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  photoItem:{width:"48%",aspectRatio:1,backgroundColor:colors.surfaceMuted,borderRadius:radius.md,overflow:"hidden"},
  photo:{width:"100%",height:"100%"},
  postPhoto:{width:"100%",height:230,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
  viewer:{flex:1,backgroundColor:"#061426",padding:spacing.lg,paddingTop:60},
  viewerImage:{width:"100%",flex:1},
  offerGrid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.xs},
  offerSlot:{width:"48%",minHeight:54,backgroundColor:softenSlotColor("#F3E8FF"),borderColor:"#D8B4FE",
    borderWidth:1,borderRadius:radius.md,overflow:"hidden",paddingHorizontal:2,justifyContent:"center"},
  offerDisabled:{opacity:.65},
  offerPressed:{opacity:.75},
  slotIcon:{width:42,height:42,borderRadius:12,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  highlight:{borderColor:colors.primary,borderWidth:2},
  map:{height:300,borderRadius:radius.md,overflow:"hidden"},
});