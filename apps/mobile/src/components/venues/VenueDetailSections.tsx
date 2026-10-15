import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {BookingDto,PromotionDto,PublicVenueDto,VenueAvailabilityResponse,VenuePostDto,VenuePostType} from "@leaguekick/contracts";
import {router} from "expo-router";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {Image,Linking,Modal,Pressable,ScrollView,Share,StyleSheet,View} from "react-native";
import {ApiRequestError,bookingApi,marketingApi,resolveMediaImageUrl,venueApi} from "../../lib/api";
import {readAvailabilityCache,writeAvailabilityCache} from "../../lib/availability-cache";
import {formatPostTimeAgo} from "../../lib/date-time";
import {isCurrentVenueAvailability,isVenueBookingDay,isValidVenueDay,venueDayKey} from "../../lib/venue-detail-dates";
import {usePostTimeNow} from "../../hooks/usePostTimeNow";
import {useVisibleTab} from "../../hooks/useVisibleTab";
import {useAuth} from "../../providers/AuthProvider";
import {useLocale} from "../../providers/LocaleProvider";
import {useNetwork} from "../../providers/NetworkProvider";
import {NearbyVenuesMap} from "./NearbyVenuesMap";
import {VenueSlotTimetable} from "./VenueSlotTimetable";
import {VenueReviewsPanel} from "./VenueCommunityPanels";
import {VenueSavedTimesAndAlertsPanel} from "./VenueSavedTimesAndAlertsPanel";
import {VenueCompetitionsPanel} from "./VenueCompetitionsPanel";
import {VenueUpdatesPanel} from "./VenueUpdatesPanel";
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
import {VenueReserveDatePicker} from "./VenueReserveDatePicker";

export type VenueMainTab="media"|"reserve"|"competitions"|"updates"|"about";
export type VenueMediaSub="posts"|"photos"|"videos";
export type VenueReserveSub="slots"|"offers"|"bookings"|"saved";
export type VenueCompetitionSub="registration"|"upcoming"|"live"|"completed"|"matches";
export type VenueUpdatesSub="announcements"|"schedule"|"alerts";
export type VenueAboutSub="overview"|"facilities"|"hours"|"location"|"reviews"|"policies";
export const venueNavItems:{id:VenueMainTab;icon:keyof typeof Ionicons.glyphMap}[]=[
  {id:"media",icon:"images-outline"},{id:"reserve",icon:"calendar-outline"},
  {id:"competitions",icon:"trophy-outline"},{id:"updates",icon:"notifications-outline"},
  {id:"about",icon:"information-circle-outline"},
];
export const venueSubtabs:Record<VenueMainTab,string[]>={
  media:["posts","photos","videos"],reserve:["slots","offers","bookings","saved"],
  competitions:["registration","upcoming","live","completed","matches"],updates:["announcements","schedule","alerts"],
  about:["overview","facilities","hours","location","reviews","policies"],
};
export function todayAtKabul(){
  return venueDayKey("Asia/Kabul");
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
type VenuePostFilter="all"|"general"|"announcement"|"promotion"|"competition"|"result";
const venuePostFilters:readonly VenuePostFilter[]=[
  "all","general","announcement","promotion","competition","result",
];
type VenueContentProps={venue:PublicVenueDto;sub:VenueMediaSub|"announcements";onReserve:(startsAt?:string,promotionId?:string)=>void};
export function VenueMediaContent({venue,sub,onReserve}:VenueContentProps){
  const {t,isRTL,language}=useLocale(),tr=(key:string)=>t(("vd."+key) as never);
  const tr5=(key:string)=>t(("vd5."+key) as never);
  const {session}=useAuth(),now=usePostTimeNow();
  const token=session?.accessToken;
  const [posts,setPosts]=useState<VenuePostDto[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(false);
  const [filter,setFilter]=useState<VenuePostFilter>("all");
  const postFilterNav=useVisibleTab<VenuePostFilter>(filter);
  const [photo,setPhoto]=useState<string|null>(null);
  const [videoError,setVideoError]=useState(false);
  const [actionError,setActionError]=useState(false);
  const [page,setPage]=useState(1),[hasMore,setHasMore]=useState(false);
  const [loadingMore,setLoadingMore]=useState(false),[moreError,setMoreError]=useState(false);
  const requestId=useRef(0);
  const isMedia=sub==="posts"||sub==="photos"||sub==="videos"||sub==="announcements";
  const kind=sub==="photos"?"photos":sub==="videos"?"videos":"posts";
  useEffect(()=>{if(sub==="posts")setFilter("all");},[sub,venue.id]);
  const postType=sub==="announcements"?"ANNOUNCEMENT":
    sub==="posts"&&filter!=="all"?filter.toUpperCase() as VenuePostType:undefined;
  const load=useCallback(async()=>{
    const id=++requestId.current;
    setLoading(true);setError(false);setMoreError(false);
    setPosts([]);setPage(1);setHasMore(false);setLoadingMore(false);setPhoto(null);
    setVideoError(false);setActionError(false);
    try{
      if(isMedia){
        const value=await marketingApi.venueMedia(venue.id,{
          kind,postType,sort:"newest",page:1,limit:12,
        },token);
        if(id!==requestId.current)return;
        setPosts(value.posts.filter(p=>p.venueId===venue.id&&p.status==="PUBLISHED"&&p.visibility!=="PRIVATE"));
        setPage(value.page);setHasMore(value.hasMore);
      }else{
        const value=await marketingApi.venuePosts(venue.id,token);
        if(id!==requestId.current)return;
        setPosts(value.posts.filter(p=>p.venueId===venue.id&&p.status==="PUBLISHED"));
      }
    }catch{if(id===requestId.current)setError(true);}
    finally{if(id===requestId.current)setLoading(false);}
  },[venue.id,token,isMedia,kind,postType]);
  useEffect(()=>{void load();return()=>{requestId.current+=1;};},[load]);
  async function loadMore(){
    if(!isMedia||!hasMore||loading||loadingMore)return;
    const id=requestId.current;
    setLoadingMore(true);setMoreError(false);
    try{
      const result=await marketingApi.venueMedia(venue.id,{
        kind,postType,sort:"newest",page:page+1,limit:12,
      },token);
      if(id!==requestId.current)return;
      setPosts(current=>[...current,...result.posts.filter(p=>
        p.venueId===venue.id&&p.status==="PUBLISHED"&&p.visibility!=="PRIVATE"&&
        !current.some(old=>old.id===p.id))]);
      setPage(result.page);setHasMore(result.hasMore);
    }catch{if(id===requestId.current)setMoreError(true);}
    finally{if(id===requestId.current)setLoadingMore(false);}
  }
  const photos=useMemo(()=>posts.filter(p=>!!resolveMediaImageUrl(p.imageUrl)),[posts]);
  const videos=useMemo(()=>posts.flatMap(p=>{
    const url=venueVideoLink(p.body);
    return url?[{...p,videoUrl:url}]:[];
  }),[posts]);
  const filtered=useMemo(()=>sub==="announcements"
    ?posts.filter(p=>p.postType==="ANNOUNCEMENT"):posts,[posts,sub]);
  const index=photos.findIndex(p=>p.id===photo);
  const selected=photos[index];
  function openPhoto(post:VenuePostDto){setPhoto(post.id);}
  async function openCta(post:VenuePostDto){
    setActionError(false);
    if(post.ctaType==="COMPETITION"&&post.ctaTargetId){
      router.push({pathname:"/competitions/[competitionId]",params:{competitionId:post.ctaTargetId}});
    }else if(post.ctaType==="PROMOTION"&&post.ctaTargetId){
      try{
        const result=await marketingApi.promotion(post.ctaTargetId);
        if(result.promotion.venueId===venue.id)
          onReserve(result.promotion.startsAt,result.promotion.id);
        else setActionError(true);
      }catch{setActionError(true);}
    }else if(post.ctaType==="VENUE")onReserve();
  }
  async function playVideo(url:string){
    setVideoError(false);
    try{await Linking.openURL(url);}catch{setVideoError(true);}
  }
  async function sharePost(post:VenuePostDto){
    setActionError(false);
    try{await Share.share({message:venue.name+"\n"+post.body});}
    catch{setActionError(true);}
  }
  const more=<View style={{gap:spacing.xs}}>
    {moreError?<AppText style={{color:colors.danger}}>{tr5("moreError")}</AppText>:null}
    {hasMore?<Button variant="secondary" label={tr5("loadMore")}
      loading={loadingMore} disabled={loadingMore}
      onPress={()=>void loadMore()}/>:null}
  </View>;
  const viewer=<Modal visible={!!selected} animationType="fade" transparent
    onRequestClose={()=>setPhoto(null)}>
    <View style={styles.viewer} testID="venue-photo-viewer">
      <View style={[styles.filters,{flexDirection:isRTL?"row-reverse":"row",justifyContent:"space-between"}]}>
        <AppText weight="bold" style={{color:"#FFFFFF",flex:1}}>
          {selected?(index+1)+" / "+photos.length:""}
        </AppText>
        <Button label={tr("close")} variant="secondary" onPress={()=>setPhoto(null)}/>
      </View>
      {selected?<Image source={{uri:resolveMediaImageUrl(selected.imageUrl)!}}
        resizeMode="contain" style={styles.viewerImage}/>:null}
      {selected?.body?<AppText numberOfLines={3} style={{color:"#FFFFFF"}}>{selected.body}</AppText>:null}
      {selected?<AppText variant="caption" style={{color:"#FFFFFF"}}>
        {formatPostTimeAgo(selected.publishedAt,language,now)}
      </AppText>:null}
      <View style={[styles.filters,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Button variant="secondary" style={{flex:1}} label={tr5("previous")}
          disabled={index<=0} onPress={()=>setPhoto(photos[index-1]!.id)}/>
        <Button variant="secondary" style={{flex:1}} label={tr5("next")}
          disabled={index<0||index>=photos.length-1}
          onPress={()=>setPhoto(photos[index+1]!.id)}/>
      </View>
    </View>
  </Modal>;
  if(loading&&sub!=="posts")return <DataLoadingState variant="list" minHeight={240}/>;
  if(error&&sub!=="posts")return <Empty icon="cloud-offline-outline" title={tr("postsError")} action={()=>void load()}/>;
  if(sub==="photos")return <View style={{gap:spacing.md}}>
    <AppText variant="caption" muted>{tr5("photosDescription")}</AppText>
    {photos.length===0?<Empty icon="images-outline" title={tr("noPhotos")}/>:<View style={styles.photoGrid}>
      {photos.map(p=><Pressable key={p.id} testID={"venue-photo-"+p.id}
        style={styles.photoItem} accessibilityRole="button"
        accessibilityLabel={tr("viewPhoto")+" · "+p.body}
        onPress={()=>openPhoto(p)}>
        <Image source={{uri:resolveMediaImageUrl(p.imageUrl)!}} style={styles.photo} resizeMode="cover"/>
      </Pressable>)}
    </View>}
    {more}{viewer}
  </View>;
  if(sub==="videos")return <View style={{gap:spacing.md}}>
    <AppText variant="caption" muted>{tr5("videosDescription")}</AppText>
    {videos.length===0?<Empty icon="videocam-outline" title={tr("noVideos")} detail={tr("videosHint")}/>:null}
    {videos.map(p=><Card key={p.id} testID={"venue-video-"+p.id} style={{gap:spacing.sm}}>
      <View style={[styles.meta,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="play-circle-outline" size={24} color={colors.primary}/>
        <AppText weight="semibold" style={{flex:1}}>{tr("videoPost")}</AppText>
        <AppText variant="caption" muted>{formatPostTimeAgo(p.publishedAt,language,now)}</AppText>
      </View>
      {resolveMediaImageUrl(p.imageUrl)?<Image source={{uri:resolveMediaImageUrl(p.imageUrl)!}}
        style={styles.postPhoto} resizeMode="cover"/>:null}
      <AppText numberOfLines={5}>{p.body}</AppText>
      <Button label={tr("playVideo")} variant="secondary" onPress={()=>void playVideo(p.videoUrl)}/>
    </Card>)}
    {videoError?<AppText style={{color:colors.danger}}>{tr5("videoOpenError")}</AppText>:null}
    {more}
  </View>;

  if(sub==="announcements"&&filtered.length===0)
    return <Empty icon="megaphone-outline" title={tr("noAnnouncements")}/>;
  return <View style={{gap:spacing.md}} testID="venue-media-posts">
    {sub==="posts"?<ScrollView
      testID="venue-posts-filter-nav"
      ref={postFilterNav.scrollRef}
      onLayout={postFilterNav.onViewport}
      onContentSizeChange={postFilterNav.onContentSize}
      horizontal showsHorizontalScrollIndicator={false}
      style={{flexGrow:0}}
      contentContainerStyle={[styles.postFilterRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {venuePostFilters.map(key=><Pressable key={key}
        testID={"venue-posts-filter-"+key}
        accessibilityRole="tab"
        accessibilityLabel={tr5("filter."+key)}
        accessibilityState={{selected:filter===key}}
        onLayout={event=>postFilterNav.cellLayout(key,event)}
        onPress={()=>{setFilter(key);postFilterNav.focus(key,true);}}
        style={[styles.pill,styles.postFilterItem,filter===key&&styles.pillActive]}>
        <AppText weight="semibold" variant="caption"
          style={{textAlign:"center",color:filter===key?"#FFFFFF":colors.primary}}>
          {tr5("filter."+key)}
        </AppText>
      </Pressable>)}
    </ScrollView>:null}
    {loading?<DataLoadingState variant="list" minHeight={240}/>:
      error?<Empty icon="cloud-offline-outline" title={tr("postsError")} action={()=>void load()}/>:
      <>
    {filtered.length===0?<Empty icon="document-text-outline" title={tr("noPosts")}/>:null}
    {filtered.map(post=><Card key={post.id} testID={"venue-post-"+post.id} style={{gap:spacing.md}}>
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
        accessibilityLabel={tr("viewPhoto")} onPress={()=>openPhoto(post)}>
        <Image source={{uri:resolveMediaImageUrl(post.imageUrl)!}} style={styles.postPhoto} resizeMode="cover"/>
      </Pressable>:null}
      <View style={[styles.filters,{flexDirection:isRTL?"row-reverse":"row",flexWrap:"wrap"}]}>
        {post.ctaType!=="NONE"&&post.ctaTargetId?<Button variant="secondary"
          label={t("feed.openCta")} onPress={()=>void openCta(post)}/>:null}
        {post.socialPostId?<Button variant="secondary" label={t("social.comment")} onPress={()=>
          router.push({pathname:"/posts/[postId]/comments",params:{postId:post.socialPostId!}})}/>:null}
        <Button variant="ghost" label={tr5("share")} onPress={()=>void sharePost(post)}/>
        <Button variant="ghost" label={t("feed.openPost")} onPress={()=>
          router.push({pathname:"/posts/[postId]",params:{postId:post.id}})}/>
      </View>
    </Card>)}
    {actionError?<AppText style={{color:colors.danger}}>{tr5("actionError")}</AppText>:null}
    {isMedia?more:null}
    {viewer}
    </>}
  </View>;
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
  const [date,setDate]=useState(bookingDate??venueDayKey(venue.timezone));
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
  const availabilityLoadSerial=useRef(0);
  const today=venueDayKey(venue.timezone);
  const maximum=shiftVenueDate(today,venue.maximumAdvanceBookingDays);
  const dateValid=isVenueBookingDay(date,today,venue.maximumAdvanceBookingDays);
  useEffect(()=>{
    if(!startsAt){if(bookingDate&&isValidVenueDay(bookingDate))setDate(bookingDate);return;}
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:venue.timezone,year:"numeric",
      month:"2-digit",day:"2-digit"}).formatToParts(new Date(startsAt));
    const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    const next=v.year+"-"+v.month+"-"+v.day;
    if(isValidVenueDay(next))setDate(next);
  },[venue.id,startsAt,bookingDate]);
  const load=useCallback(async()=>{
    const request=++availabilityLoadSerial.current;
    setError(null);setAvailability(null);setAvailabilityDate(null);
    setFresh(false);setCachedAt(null);
    if(!dateValid||!venue.onlineBookingEnabled){setLoading(false);return;}
    setLoading(true);
    try{
      if(!isOnline)throw new ApiRequestError("NETWORK_ERROR","Offline",null);
      const response=await venueApi.availability(venue.id,date);
      if(request!==availabilityLoadSerial.current)return;
      // Cached or delayed responses from another venue/day must not paint bookable slots.
      if(!isCurrentVenueAvailability(response,venue.id,date))throw Error("Mismatched availability");
      setAvailability(response);setAvailabilityDate(date);setFresh(true);
      await writeAvailabilityCache(response);
    }catch(e){
      if(request!==availabilityLoadSerial.current)return;
      const cached=await readAvailabilityCache(venue.id,date);
      if(request!==availabilityLoadSerial.current)return;
      if(isCurrentVenueAvailability(cached?.value,venue.id,date)&&cached){
        setAvailability(cached.value);setAvailabilityDate(date);setFresh(false);
        setCachedAt(cached.cachedAt);
      }else{
        setAvailability(null);setAvailabilityDate(null);setFresh(false);
        setError(e instanceof ApiRequestError&&e.isNetworkError?
          t("booking.offlineNoCache"):t("booking.loadAvailabilityError"));
      }
    }finally{
      if(request===availabilityLoadSerial.current)setLoading(false);
    }
  },[date,dateValid,isOnline,venue.id,venue.onlineBookingEnabled,t]);
  // Cancel any prior Offers page read when the venue, date, tab or connection changes.
  // Live booking remains separately checked immediately before confirmation.
  useEffect(()=>{
    if(sub==="offers")void load();
    else{
      availabilityLoadSerial.current+=1;
      setLoading(false);setAvailability(null);setAvailabilityDate(null);setFresh(false);
    }
    return()=>{availabilityLoadSerial.current+=1;};
  },[sub,date,reconnectVersion,reload,load]);
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
    setBookings([]);setBookingsActor(null);
    if(!session){setBookingsLoading(false);return;}
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
  useEffect(()=>{
    if(sub==="bookings")void loadMine();
    else bookingLoadSerial.current+=1;
    return()=>{bookingLoadSerial.current+=1;};
  },[sub,venue.id,reload,session?.accessToken,loadMine]);
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
  const usable=availabilityDate===date&&isCurrentVenueAvailability(availability,venue.id,date)
    ?availability?.slots??[]:[];
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
        <VenueReserveDatePicker selected={date} today={today}
          maximumAdvanceBookingDays={venue.maximumAdvanceBookingDays} onChange={setDate}/>
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
  if(sub==="announcements")return <VenueMediaContent venue={venue}
    sub="announcements" onReserve={()=>onReserve()}/>;
  return <VenueUpdatesPanel venue={venue} sub={sub} onReserve={onReserve}/>;
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
  postFilterRow:{gap:spacing.sm,paddingVertical:spacing.xs,alignItems:"center",flexWrap:"nowrap"},
  postFilterItem:{minHeight:48,justifyContent:"center"},
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