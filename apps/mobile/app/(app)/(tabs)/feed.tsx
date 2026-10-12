import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {FeedItemDto} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useMemo,useRef,useState} from "react";
import {Image,Pressable,StyleSheet,View} from "react-native";
import {marketingApi,resolveMediaImageUrl} from "../../../src/lib/api";
import {formatLocalDateTime,formatPostTimeAgo} from "../../../src/lib/date-time";
import {usePostTimeNow} from "../../../src/hooks/usePostTimeNow";
import {AppText} from "../../../src/components/ui/AppText";
import {Button} from "../../../src/components/ui/Button";
import {Card} from "../../../src/components/ui/Card";
import {DataLoadingState} from "../../../src/components/ui/DataLoadingState";
import {Screen} from "../../../src/components/ui/Screen";
import {useAuth} from "../../../src/providers/AuthProvider";
import {useLocale} from "../../../src/providers/LocaleProvider";

type PromotionItem=Extract<FeedItemDto,{type:"PROMOTION"}>;
type PostItem=Extract<FeedItemDto,{type:"POST"}>;
type T=ReturnType<typeof useLocale>["t"];
type Language=ReturnType<typeof useLocale>["language"];

function openVenue(venueId:string){
  router.push({pathname:"/venues/[venueId]",params:{venueId}});
}
function openFeedItem(item:FeedItemDto){
  if(item.type==="PROMOTION"){
    router.push({pathname:"/venues/[venueId]",params:{
      venueId:item.venueId,promotionId:item.promotion.id,
      startsAt:item.promotion.startsAt,
    }});
  }else{
    router.push({pathname:"/posts/[postId]",params:{postId:item.post.id}});
  }
}

/** Venue updates and limited-time offers are a distinct, venue-only feed;
 * the mixed teams/players social timeline remains on Home. */
export default function FeedScreen(){
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const token=session?.accessToken??"";
  const now=usePostTimeNow();
  const [followingOnly,setFollowingOnly]=useState(false);
  const [items,setItems]=useState<FeedItemDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState<string|null>(null);
  // A rapid All / Following switch must not let an older API response overwrite
  // the selected filter. Leaving the page invalidates in-flight requests.
  const requestId=useRef(0);

  const load=useCallback(async(refresh=false)=>{
    const id=++requestId.current;
    if(!token){
      setItems([]);setLoading(false);setRefreshing(false);
      return;
    }
    if(refresh)setRefreshing(true);
    else{setLoading(true);setItems([]);}
    setError(null);
    try{
      const response=await marketingApi.feed(token,followingOnly);
      if(requestId.current===id)setItems(response.items);
    }catch{
      if(requestId.current===id)setError(t("feed.loadError"));
    }finally{
      if(requestId.current===id){setLoading(false);setRefreshing(false);}
    }
  },[token,followingOnly,t]);

  useFocusEffect(useCallback(()=>{
    void load();
    return ()=>{requestId.current+=1;};
  },[load]));

  const counts=useMemo(()=>({
    offers:items.filter(item=>item.type==="PROMOTION").length,
    updates:items.filter(item=>item.type==="POST").length,
  }),[items]);

  return <Screen showHeader style={styles.page}
    refreshing={refreshing} onRefresh={()=>void load(true)}>
    <View style={styles.headerCard}>
      <View style={[styles.headingRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.heroIcon}>
          <Ionicons name="newspaper-outline" size={26} color={colors.primary}/>
        </View>
        <View style={styles.headingCopy}>
          <AppText variant="title" weight="bold">{t("feed.title")}</AppText>
          <AppText muted>{t("feed.subtitle")}</AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t("notifications.title")}
          onPress={()=>router.push("/notifications")} style={styles.headerAction}>
          <Ionicons name="notifications-outline" size={22} color={colors.primary}/>
        </Pressable>
      </View>
      <View testID="feed-filters" style={[styles.filterBar,
        {flexDirection:isRTL?"row-reverse":"row"}]}>
        <FeedFilter label={t("feed.all")} selected={!followingOnly}
          testID="feed-filter-all" onPress={()=>{if(followingOnly)setFollowingOnly(false);}}/>
        <FeedFilter label={t("feed.following")} selected={followingOnly}
          testID="feed-filter-following" onPress={()=>{if(!followingOnly)setFollowingOnly(true);}}/>
      </View>
      {!loading&&!error&&items.length>0?<View style={[styles.summaryRow,
        {flexDirection:isRTL?"row-reverse":"row"}]}>
        <SummaryCount icon="pricetag-outline" label={t("feed.offers")} count={counts.offers}/>
        <SummaryCount icon="document-text-outline" label={t("feed.updates")} count={counts.updates}/>
      </View>:null}
    </View>

    {error?<Card style={styles.feedbackCard} testID="feed-error-state">
      <Ionicons name="cloud-offline-outline" size={30} color={colors.danger}/>
      <AppText style={styles.feedbackText}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary" onPress={()=>void load()}/>
    </Card>:null}

    {loading?<DataLoadingState variant="list" minHeight={360}/>:null}

    {!loading&&!error&&items.length===0?<Card style={styles.feedbackCard}
      testID="feed-empty-state">
      <View style={styles.emptyIcon}>
        <Ionicons name={followingOnly?"heart-outline":"newspaper-outline"}
          size={34} color={colors.primary}/>
      </View>
      <AppText variant="bodyLarge" weight="bold">{t("feed.venueUpdates")}</AppText>
      <AppText style={styles.feedbackText} muted>
        {followingOnly?t("feed.followingEmpty"):t("feed.empty")}
      </AppText>
      <Button label={t("feed.browseVenues")} variant="secondary"
        icon={<Ionicons name="compass-outline" size={19} color={colors.primary}/>}
        onPress={()=>router.push("/venues")}/>
    </Card>:null}

    {!loading&&!error&&items.length>0?<View style={styles.feedList}
      testID="feed-item-list">
      <View style={[styles.listTitleRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <AppText variant="bodyLarge" weight="bold">{t("feed.venueUpdates")}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.retry")}
          style={styles.refreshButton} onPress={()=>void load(true)}>
          <Ionicons name="refresh-outline" size={21} color={colors.primary}/>
        </Pressable>
      </View>
      {items.map(item=>item.type==="PROMOTION"
        ?<PromotionFeedCard key={"promotion-"+item.id} item={item}
          language={language} now={now} t={t} isRTL={isRTL}/>
        :<PostFeedCard key={"post-"+item.id} item={item}
          language={language} now={now} t={t} isRTL={isRTL}/>)}
    </View>:null}
  </Screen>;
}

function FeedFilter({label,selected,onPress,testID}:{
  label:string;selected:boolean;onPress:()=>void;testID:string;
}){
  return <Pressable testID={testID} accessibilityRole="tab"
    accessibilityState={{selected}} accessibilityLabel={label}
    onPress={onPress} style={({pressed})=>[
      styles.filterButton,selected&&styles.filterSelected,pressed&&styles.pressed,
    ]}>
    <AppText weight="semibold" numberOfLines={1}
      style={{color:selected?colors.surface:colors.textMuted,textAlign:"center"}}>
      {label}
    </AppText>
  </Pressable>;
}

function SummaryCount({icon,label,count}:{
  icon:keyof typeof Ionicons.glyphMap;label:string;count:number;
}){
  return <View style={styles.summaryBadge}>
    <Ionicons name={icon} color={colors.primary} size={17}/>
    <AppText weight="bold" style={styles.summaryNumber} forceLtr>{count}</AppText>
    <AppText variant="caption" muted>{label}</AppText>
  </View>;
}

function FeedAuthor({venueId,venueName,time,type,isRTL,t}:{
  venueId:string;venueName:string;time:string;type:"PROMOTION"|"POST";
  isRTL:boolean;t:T;
}){
  return <View style={[styles.authorRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
    <Pressable accessibilityRole="button" accessibilityLabel={t("feed.viewVenue")+" "+venueName}
      onPress={()=>openVenue(venueId)} style={styles.authorAvatar}>
      <Ionicons name="football-outline" size={23} color={colors.primary}/>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={()=>openVenue(venueId)}
      accessibilityLabel={t("feed.viewVenue")+" "+venueName} style={styles.authorInfo}>
      <AppText variant="bodyLarge" weight="bold" numberOfLines={1}>{venueName}</AppText>
      <View style={[styles.authorMeta,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="time-outline" size={13} color={colors.textMuted}/>
        <AppText variant="caption" muted>{time}</AppText>
      </View>
    </Pressable>
    <View style={[styles.typeBadge,type==="PROMOTION"&&styles.promotionBadge]}>
      <Ionicons name={type==="PROMOTION"?"pricetag-outline":"megaphone-outline"}
        size={13} color={type==="PROMOTION"?colors.success:colors.primary}/>
      <AppText variant="caption" weight="semibold"
        style={{color:type==="PROMOTION"?colors.success:colors.primary}}>
        {t(type==="PROMOTION"?"feed.promotedSlot":"feed.postTitle")}
      </AppText>
    </View>
  </View>;
}

function PromotionFeedCard({item,language,now,t,isRTL}:{
  item:PromotionItem;language:Language;now:number;t:T;isRTL:boolean;
}){
  const p=item.promotion;
  const created=formatPostTimeAgo(item.createdAt,language,now);
  const when=formatLocalDateTime(p.startsAt,language);
  return <Card testID={"feed-promotion-"+item.id} style={styles.feedCard}>
    <FeedAuthor venueId={item.venueId} venueName={item.venueName}
      time={created} type="PROMOTION" isRTL={isRTL} t={t}/>
    <View style={styles.cardDivider}/>
    <AppText variant="bodyLarge" weight="bold">{p.title}</AppText>
    {p.note?<AppText style={styles.bodyText}>{p.note}</AppText>:null}
    <View style={[styles.slotDate,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.slotDateIcon}>
        <Ionicons name="calendar-outline" size={19} color={colors.primary}/>
      </View>
      <View style={styles.slotDateCopy}>
        <AppText variant="caption" muted>{t("feed.slotTime")}</AppText>
        <AppText weight="semibold">{when}</AppText>
      </View>
    </View>
    <View style={[styles.pricePanel,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.priceCopy}>
        <AppText variant="bodyLarge" weight="bold" forceLtr
          style={styles.salePrice}>{p.discountedPriceAfn.toLocaleString("en-US")} AFN</AppText>
        <AppText variant="caption" muted forceLtr
          style={styles.oldPrice}>{p.originalPriceAfn.toLocaleString("en-US")} AFN</AppText>
      </View>
      <View style={styles.savingPill}>
        <AppText weight="bold" style={styles.savingText}>
          {t("feed.savePercent",{percent:p.discountPercent})}
        </AppText>
      </View>
    </View>
    <View style={[styles.actionRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Button style={styles.actionButton} label={t("feed.bookPromotion")}
        icon={<Ionicons name="calendar-outline" color={colors.surface} size={18}/>}
        onPress={()=>openFeedItem(item)}/>
      <Button style={styles.actionButton} variant="secondary"
        label={t("feed.viewVenue")}
        onPress={()=>openVenue(item.venueId)}/>
    </View>
  </Card>;
}

function PostFeedCard({item,language,now,t,isRTL}:{
  item:PostItem;language:Language;now:number;t:T;isRTL:boolean;
}){
  const post=item.post;
  const image=resolveMediaImageUrl(post.imageUrl);
  const published=formatPostTimeAgo(post.publishedAt,language,now);
  return <Card testID={"feed-post-"+item.id} style={styles.feedCard}>
    <FeedAuthor venueId={item.venueId} venueName={item.venueName}
      time={published} type="POST" isRTL={isRTL} t={t}/>
    <View style={[styles.postTypeRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.postTypeBadge}>
        <AppText variant="caption" weight="semibold" style={styles.postTypeText}>
          {t(("media.type."+post.postType) as never)}
        </AppText>
      </View>
    </View>
    {post.body?<AppText style={styles.bodyText} numberOfLines={6}>{post.body}</AppText>:null}
    {image?<Pressable accessibilityRole="button" accessibilityLabel={t("feed.openPost")}
      onPress={()=>openFeedItem(item)} style={styles.postImageFrame}>
      <Image source={{uri:image}} style={styles.postImage} resizeMode="cover"/>
    </Pressable>:null}
    <View style={styles.cardDivider}/>
    <View style={[styles.actionRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Button style={styles.actionButton} label={t("feed.openPost")}
        icon={<Ionicons name="document-text-outline" color={colors.surface} size={18}/>}
        onPress={()=>openFeedItem(item)}/>
      {post.socialPostId?<Button style={styles.actionButton} variant="secondary"
        label={t("social.comment")}
        icon={<Ionicons name="chatbubble-outline" size={18} color={colors.primary}/>}
        onPress={()=>router.push({pathname:"/posts/[postId]/comments",
          params:{postId:post.socialPostId!}})}/>:<Button
          style={styles.actionButton} variant="secondary" label={t("feed.viewVenue")}
          onPress={()=>openVenue(item.venueId)}/>}
    </View>
  </Card>;
}

const styles=StyleSheet.create({
  page:{gap:spacing.md,paddingTop:spacing.md},
  headerCard:{backgroundColor:colors.surface,borderColor:colors.border,borderWidth:1,
    borderRadius:radius.lg,padding:spacing.md,gap:spacing.md},
  headingRow:{alignItems:"center",gap:spacing.sm},
  headingCopy:{flex:1,minWidth:0,gap:spacing.xs},
  heroIcon:{width:50,height:50,borderRadius:radius.md,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  headerAction:{width:44,height:44,borderRadius:radius.md,
    alignItems:"center",justifyContent:"center",backgroundColor:colors.surfaceMuted},
  filterBar:{borderRadius:radius.md,borderWidth:1,borderColor:colors.border,
    backgroundColor:colors.surfaceMuted,padding:4,gap:4},
  filterButton:{minWidth:0,flex:1,minHeight:47,alignItems:"center",justifyContent:"center",
    paddingHorizontal:spacing.sm,borderRadius:radius.sm},
  filterSelected:{backgroundColor:colors.primary},
  summaryRow:{gap:spacing.sm,flexWrap:"wrap"},
  summaryBadge:{flexDirection:"row",gap:spacing.xs,alignItems:"center",
    backgroundColor:colors.primarySoft,borderRadius:radius.pill,
    paddingHorizontal:spacing.md,paddingVertical:spacing.sm},
  summaryNumber:{color:colors.primary},
  feedList:{gap:spacing.md},
  listTitleRow:{alignItems:"center",justifyContent:"space-between",
    paddingHorizontal:spacing.xs,gap:spacing.sm},
  refreshButton:{width:44,height:44,borderRadius:radius.md,
    backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"},
  feedCard:{gap:spacing.md,padding:spacing.md,overflow:"hidden"},
  authorRow:{alignItems:"center",gap:spacing.sm},
  authorAvatar:{width:48,height:48,borderRadius:24,backgroundColor:colors.primarySoft,
    borderWidth:1,borderColor:"#D6E4FC",alignItems:"center",justifyContent:"center"},
  authorInfo:{flex:1,minWidth:0,gap:3},
  authorMeta:{alignItems:"center",gap:4},
  typeBadge:{flexShrink:0,maxWidth:118,flexDirection:"row",gap:3,
    alignItems:"center",justifyContent:"center",paddingHorizontal:spacing.sm,
    paddingVertical:spacing.xs,borderRadius:radius.pill,backgroundColor:colors.primarySoft},
  promotionBadge:{backgroundColor:"#EAF8EF"},
  cardDivider:{height:1,backgroundColor:colors.border},
  bodyText:{lineHeight:23,color:colors.text},
  slotDate:{padding:spacing.sm,gap:spacing.sm,alignItems:"center",
    backgroundColor:"#F4F7FD",borderRadius:radius.md},
  slotDateIcon:{width:38,height:38,borderRadius:radius.md,backgroundColor:colors.surface,
    justifyContent:"center",alignItems:"center"},
  slotDateCopy:{flex:1,minWidth:0,gap:3},
  pricePanel:{padding:spacing.md,gap:spacing.sm,alignItems:"center",
    justifyContent:"space-between",flexWrap:"wrap",
    borderRadius:radius.md,backgroundColor:"#EDFAF2",borderWidth:1,borderColor:"#B9ECCB"},
  priceCopy:{gap:2},
  salePrice:{color:"#166534"},
  oldPrice:{textDecorationLine:"line-through"},
  savingPill:{paddingHorizontal:spacing.md,paddingVertical:spacing.sm,
    backgroundColor:"#CFF4DB",borderRadius:radius.pill},
  savingText:{color:"#166534"},
  actionRow:{gap:spacing.sm,flexWrap:"wrap",alignItems:"stretch"},
  actionButton:{flexGrow:1,flexBasis:180,minWidth:140,minHeight:50,
    paddingHorizontal:spacing.sm},
  postTypeRow:{alignItems:"flex-start"},
  postTypeBadge:{backgroundColor:colors.surfaceMuted,borderRadius:radius.sm,
    paddingHorizontal:spacing.sm,paddingVertical:spacing.xs},
  postTypeText:{color:colors.textMuted},
  postImageFrame:{width:"100%",borderRadius:radius.md,overflow:"hidden",
    backgroundColor:colors.surfaceMuted},
  postImage:{width:"100%",height:220},
  feedbackCard:{alignItems:"center",gap:spacing.md,paddingVertical:spacing.lg},
  feedbackText:{textAlign:"center"},
  emptyIcon:{width:72,height:72,borderRadius:36,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  pressed:{opacity:0.75},
});
