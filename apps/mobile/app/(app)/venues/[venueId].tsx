import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {FollowStateDto,PublicVenueDto} from "@leaguekick/contracts";
import {useLocalSearchParams} from "expo-router";
import {useCallback,useEffect,useRef,useState} from "react";
import {Image,Pressable,ScrollView,Share,StyleSheet,View,useWindowDimensions} from "react-native";
import {marketingApi,resolveMediaImageUrl,venueApi} from "../../../src/lib/api";
import {AppText} from "../../../src/components/ui/AppText";
import {VenueHeroReviewBadge} from "../../../src/components/venues/VenueHeroReviewBadge";
import {Button} from "../../../src/components/ui/Button";
import {Card} from "../../../src/components/ui/Card";
import {DataLoadingState} from "../../../src/components/ui/DataLoadingState";
import {Screen} from "../../../src/components/ui/Screen";
import {useAuth} from "../../../src/providers/AuthProvider";
import {useLocale} from "../../../src/providers/LocaleProvider";
import {useVisibleTab} from "../../../src/hooks/useVisibleTab";
import {VenueAboutContent,VenueCompetitionsContent,VenueMediaContent,
  VenueReserveContent,VenueUpdatesContent,venueNavItems,venueSubtabs,
  type VenueMainTab,type VenueMediaSub,type VenueReserveSub,type VenueCompetitionSub,
  type VenueUpdatesSub,type VenueAboutSub} from "../../../src/components/venues/VenueDetailSections";
import {initialVenueNavigation,switchVenueMain,switchVenueSub,
  type VenueDetailSubtabState} from "../../../src/lib/venue-detail-navigation";

export default function VenueDetailScreen(){
  const {venueId,focusAvailability,startsAt,promotionId,bookingDate,reviewBookingId}=useLocalSearchParams<{
    venueId:string;focusAvailability?:string;startsAt?:string;promotionId?:string;bookingDate?:string;
    reviewBookingId?:string;
  }>();
  const {session}=useAuth(),{t,isRTL}=useLocale();
  const {height:viewportHeight}=useWindowDimensions();
  const tr=(key:string)=>t(("vd."+key) as never);
  const targetId=typeof venueId==="string"?venueId:"";
  const bookingDeepLink=focusAvailability==="1"||!!startsAt||!!promotionId||!!bookingDate;
  const [navigation,setNavigation]=useState(()=>initialVenueNavigation(bookingDeepLink,reviewBookingId));
  const {main,sub}=navigation;
  const [venue,setVenue]=useState<PublicVenueDto|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
  const [followState,setFollowState]=useState<FollowStateDto|null>(null),[followBusy,setFollowBusy]=useState(false);
  const [followError,setFollowError]=useState<string|null>(null);
  const [reserveStartsAt,setReserveStartsAt]=useState<string|undefined>(startsAt);
  const [reservePromotionId,setReservePromotionId]=useState<string|undefined>(promotionId);
  const [reserveDate,setReserveDate]=useState<string|undefined>(bookingDate);
  const initialVenue=useRef(targetId);
  const venueLoadSequence=useRef(0),followActionSequence=useRef(0);
  const mainNav=useVisibleTab<VenueMainTab>(main);
  const subNav=useVisibleTab<string>(sub[main]??venueSubtabs[main][0]!);
  const loadVenue=useCallback(async()=>{
    const requestId=++venueLoadSequence.current;
    setLoading(true);setError(null);setVenue(null);
    try{
      if(!targetId)throw new Error("Missing venue");
      const result=await venueApi.get(targetId);
      if(requestId!==venueLoadSequence.current)return;
      // Old or mis-scoped responses must never replace the newly selected venue.
      if(result.venue.id!==targetId)throw new Error("Venue response mismatch");
      setVenue(result.venue);
    }catch{
      if(requestId===venueLoadSequence.current)setError(tr("venueError"));
    }finally{
      if(requestId===venueLoadSequence.current)setLoading(false);
    }
  },[targetId,t]);
  useEffect(()=>{
    void loadVenue();
    return()=>{venueLoadSequence.current+=1;};
  },[loadVenue]);
  useEffect(()=>{
    if(initialVenue.current!==targetId){
      initialVenue.current=targetId;
      // A new venue resets the menu, but ordinary tab changes do not.
      setNavigation(initialVenueNavigation(bookingDeepLink,reviewBookingId));
      setReserveStartsAt(startsAt);setReservePromotionId(promotionId);
      setReserveDate(bookingDate);
      setVenue(null);setFollowState(null);setFollowError(null);
    }
  },[targetId,bookingDeepLink,reviewBookingId,startsAt,promotionId,bookingDate]);
  // Clicking "Reserve Online" from any venue result/followed card must open
  // Reserve > Available Slots, not the default Media feed.
  useEffect(()=>{
    if(!bookingDeepLink)return;
    setReserveStartsAt(startsAt);setReservePromotionId(promotionId);
    setReserveDate(bookingDate);
    setNavigation(current=>switchVenueMain(current,"reserve","slots"));
  },[targetId,focusAvailability,startsAt,promotionId,bookingDate]);
  useEffect(()=>{
    if(!reviewBookingId||bookingDeepLink)return;
    setNavigation(current=>switchVenueMain(current,"about","reviews"));
  },[targetId,reviewBookingId,bookingDeepLink]);
  useEffect(()=>{
    // Follow UI belongs only to the current signed-in user and current venue.
    followActionSequence.current+=1;
    setFollowState(null);setFollowBusy(false);setFollowError(null);
    if(!session?.accessToken||!targetId)return;
    let active=true;
    void marketingApi.followState(session.accessToken,targetId).then(value=>{
      if(active)setFollowState(value);
    }).catch(()=>{});
    return()=>{active=false;};
  },[session?.accessToken,targetId]);
  function chooseMain<T extends VenueMainTab>(id:T,target?:VenueDetailSubtabState[T]){
    // Ordinary taps preserve per-tab selection; shortcuts specify a destination.
    // Only the horizontal menu focuses; never scroll the page vertically.
    setNavigation(current=>switchVenueMain(current,id,target));
    mainNav.focus(id,true);
  }
  function reserve(date?:string,promo?:string){
    setReserveStartsAt(date);setReservePromotionId(promo);
    setReserveDate(undefined);
    chooseMain("reserve","slots");
  }
  async function toggleFollow(){
    if(!session||!followState||followBusy)return;
    const actionId=++followActionSequence.current;
    setFollowBusy(true);setFollowError(null);
    try{
      const next=followState.following
        ?await marketingApi.unfollow(session.accessToken,targetId)
        :await marketingApi.follow(session.accessToken,targetId);
      if(actionId===followActionSequence.current)setFollowState(next);
    }catch{
      if(actionId===followActionSequence.current)setFollowError(t("feed.followError"));
    }finally{
      if(actionId===followActionSequence.current)setFollowBusy(false);
    }
  }
  async function share(){
    if(!venue)return;
    try{
      await Share.share({message:venue.name+"\n"+venue.address+"\nleaguekick://venues/"+venue.id});
    }catch{}
  }
  if(loading&&(!venue||venue.id!==targetId))
    return <Screen showHeader><DataLoadingState variant="detail" minHeight={460}/></Screen>;
  if(!venue||venue.id!==targetId)return <Screen showHeader><Card style={{gap:spacing.md}}>
    <AppText style={{color:colors.danger}}>{error||tr("venueError")}</AppText>
    <Button variant="secondary" label={t("common.retry")} onPress={()=>void loadVenue()}/>
  </Card></Screen>;

  return <Screen showHeader>
    <View style={styles.header}>
      <View style={styles.cover}>
        {resolveMediaImageUrl(venue.pageCoverImageUrl)?
          <Image source={{uri:resolveMediaImageUrl(venue.pageCoverImageUrl)!}}
            style={StyleSheet.absoluteFill} resizeMode="cover"/>:
          <View style={styles.coverFallback}>
            <Ionicons name="football-outline" color="#CFE0FF" size={52}/>
          </View>}
      </View>
      <View style={styles.identity}>
        <AppText variant="title" weight="bold" style={{textAlign:"center"}}>{venue.name}</AppText>
        <VenueHeroReviewBadge venueId={venue.id}
          onOpenReviews={()=>chooseMain("about","reviews")}/>
        <View style={[styles.location,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="location-outline" color={colors.textMuted} size={16}/>
          <AppText variant="caption" muted>{venue.city+", "+venue.province}</AppText>
          {followState?<AppText variant="caption" muted>
            {" · "+t("social.followers",{count:followState.followerCount})}
          </AppText>:null}
        </View>
        <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Button style={styles.primaryAction} label={followState?.following?t("social.unfollow"):t("social.follow")}
            variant={followState?.following?"secondary":"primary"} loading={followBusy}
            disabled={!session||!followState} onPress={()=>void toggleFollow()}/>
          <Button style={styles.primaryAction} label={t("booking.reserveOnline")}
            variant="secondary" onPress={()=>reserve()}/>
        </View>
        {followError?<AppText variant="caption" style={{color:colors.danger,textAlign:"center"}}>
          {followError}
        </AppText>:null}
        <View style={[styles.secondaryActions,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Pressable style={styles.iconButton} accessibilityRole="button"
            accessibilityLabel={tr("notifications")} onPress={()=>chooseMain("updates","alerts")}>
            <Ionicons name="notifications-outline" color={colors.primary} size={21}/>
            <AppText variant="caption" weight="medium">{tr("notifications")}</AppText>
          </Pressable>
          <Pressable style={styles.iconButton} accessibilityRole="button"
            accessibilityLabel={tr("share")} onPress={()=>void share()}>
            <Ionicons name="share-social-outline" color={colors.primary} size={21}/>
            <AppText variant="caption" weight="medium">{tr("share")}</AppText>
          </Pressable>
          <Pressable style={styles.iconButton} accessibilityRole="button"
            accessibilityLabel={tr("location")} onPress={()=>chooseMain("about","location")}>
            <Ionicons name="map-outline" color={colors.primary} size={21}/>
            <AppText variant="caption" weight="medium">{tr("location")}</AppText>
          </Pressable>
        </View>
      </View>
    </View>

    <View style={styles.navContainer}>
      <ScrollView ref={mainNav.scrollRef} onLayout={mainNav.onViewport}
        onContentSizeChange={mainNav.onContentSize}
        horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0}}
        contentContainerStyle={[styles.navRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {venueNavItems.map(item=>{
          const active=main===item.id;
          return <Pressable key={item.id} accessibilityRole="tab"
            testID={"venue-main-tab-"+item.id}
            accessibilityLabel={tr("tab."+item.id)}
            onLayout={event=>mainNav.cellLayout(item.id,event)}
            accessibilityState={{selected:active}}
            onPress={()=>chooseMain(item.id)}
            style={[styles.navItem,active&&styles.navActive]}>
            <Ionicons name={item.icon} size={22} color={active?colors.primary:colors.textMuted}/>
            <AppText variant="caption" weight="semibold" numberOfLines={1}
              style={{color:active?colors.primary:colors.textMuted}}>
              {tr("tab."+item.id)}
            </AppText>
          </Pressable>;
        })}
      </ScrollView>
    </View>
    <View style={styles.subNavFrame}>
      <ScrollView ref={subNav.scrollRef} onLayout={subNav.onViewport}
        onContentSizeChange={subNav.onContentSize}
        horizontal showsHorizontalScrollIndicator={false}
        style={{flexGrow:0}} contentContainerStyle={[styles.subNav,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {venueSubtabs[main].map(item=><Pressable key={item} accessibilityRole="tab"
          testID={"venue-subtab-"+main+"-"+item}
          accessibilityLabel={tr("sub."+main+"."+item)}
          onLayout={event=>subNav.cellLayout(item,event)}
          accessibilityState={{selected:sub[main]===item}}
          style={({pressed})=>[styles.subItem,sub[main]===item&&styles.subActive,
            pressed&&styles.subPressed]}
          onPress={()=>{
            setNavigation(current=>switchVenueSub(current,main,item as VenueDetailSubtabState[typeof main]));
            subNav.focus(item,true);
          }}>
          <AppText variant="body" weight="semibold" numberOfLines={2}
            style={{color:sub[main]===item?colors.surface:colors.text,textAlign:"center"}}>
            {tr("sub."+main+"."+item)}
          </AppText>
        </Pressable>)}
      </ScrollView>
    </View>

    {/* Prevent native ScrollView from clamping toward the top when the user
        chooses a much shorter tab (e.g. an empty filtered section). */}
    <View testID="venue-tab-content" style={{minHeight:viewportHeight,gap:spacing.md}}>
      {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
      {main==="media"?<VenueMediaContent venue={venue} sub={sub.media as VenueMediaSub}
        onReserve={reserve}/>:null}
      {main==="reserve"?<VenueReserveContent venue={venue} sub={sub.reserve as VenueReserveSub}
        startsAt={reserveStartsAt} promotionId={reservePromotionId} bookingDate={reserveDate}/>:null}
      {main==="competitions"?<VenueCompetitionsContent venue={venue}
        sub={sub.competitions as VenueCompetitionSub}/>:null}
      {main==="updates"?<VenueUpdatesContent venue={venue}
        sub={sub.updates as VenueUpdatesSub} onReserve={()=>reserve()}/>:null}
      {main==="about"?<VenueAboutContent venue={venue} sub={sub.about as VenueAboutSub}
        reviewBookingId={reviewBookingId}/>:null}
    </View>
  </Screen>;
}
const styles=StyleSheet.create({
  header:{backgroundColor:colors.surface,borderRadius:radius.lg,borderWidth:1,
    borderColor:colors.border,overflow:"hidden"},
  cover:{height:184,backgroundColor:"#173B7B"},
  coverFallback:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#1E3A8A"},
  identity:{alignItems:"center",paddingHorizontal:spacing.md,paddingTop:spacing.md,
    paddingBottom:spacing.md,gap:spacing.sm},
  location:{alignItems:"center",justifyContent:"center",gap:4,flexWrap:"wrap"},
  actions:{width:"100%",gap:spacing.sm},
  primaryAction:{flex:1,minWidth:0,paddingHorizontal:spacing.xs},
  secondaryActions:{gap:spacing.sm,width:"100%",justifyContent:"space-around",marginTop:spacing.xs},
  iconButton:{gap:spacing.xs,alignItems:"center",justifyContent:"center",minHeight:54,
    minWidth:74,paddingHorizontal:spacing.sm},
  navContainer:{borderBottomWidth:1,borderTopWidth:1,borderColor:colors.border,
    backgroundColor:colors.surface},
  navRow:{gap:spacing.xs,alignItems:"center",paddingHorizontal:spacing.xs},
  navItem:{minHeight:75,minWidth:96,paddingHorizontal:spacing.sm,paddingTop:spacing.sm,
    borderBottomWidth:3,borderBottomColor:"transparent",gap:5,alignItems:"center",
    justifyContent:"center"},
  navActive:{borderBottomColor:colors.primary,backgroundColor:colors.primarySoft,
    borderTopLeftRadius:radius.md,borderTopRightRadius:radius.md},
  // Horizontal ScrollView content must grow to fill its viewport: otherwise
  // all subtabs collapse at one edge when their labels are short (especially RTL).
  subNavFrame:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.md,marginTop:spacing.xs,overflow:"hidden"},
  subNav:{flexGrow:1,gap:spacing.xs,padding:spacing.xs,alignItems:"stretch"},
  subItem:{flex:1,minWidth:112,minHeight:48,paddingVertical:spacing.sm,
    paddingHorizontal:spacing.sm,justifyContent:"center",alignItems:"center",
    borderRadius:radius.sm,borderWidth:1,borderColor:colors.border,
    backgroundColor:colors.surfaceMuted},
  subActive:{borderColor:colors.primary,backgroundColor:colors.primary},
  subPressed:{opacity:0.8},
});