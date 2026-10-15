import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import {useEffect,useRef,useState} from "react";
import {Pressable,StyleSheet,View} from "react-native";
import {venueApi} from "../../lib/api";
import {venueHeroHasRating,venueHeroReviewFacts,
  type VenueHeroReviewFacts} from "../../lib/venue-hero-reviews";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";

/** Compact, tappable verified-rating badge under the venue title.
 * The API is authoritative; prior venue responses never appear in a new hero. */
export function VenueHeroReviewBadge({venueId,onOpenReviews}:{
  venueId:string;onOpenReviews:()=>void;
}){
  const {t,isRTL}=useLocale();
  const [facts,setFacts]=useState<VenueHeroReviewFacts|null>(null);
  const [loadedVenueId,setLoadedVenueId]=useState<string|null>(null);
  const requestSequence=useRef(0);
  useEffect(()=>{
    const request=++requestSequence.current;
    setFacts(null);setLoadedVenueId(null);
    void venueApi.reviews(venueId).then(result=>{
      if(request!==requestSequence.current)return;
      const safe=venueHeroReviewFacts(result,venueId);
      if(!safe)return;
      setFacts(safe);setLoadedVenueId(venueId);
    }).catch(()=>{/* Keep the reviews shortcut without showing a fabricated rating. */});
    return()=>{requestSequence.current+=1;};
  },[venueId]);

  const safe=loadedVenueId===venueId?venueHeroReviewFacts(facts,venueId):null;
  const rated=venueHeroHasRating(safe);
  const heading=rated
    ?safe!.averageRating.toFixed(1)+" / 5"
    :loadedVenueId===venueId?t("vd2.ratingNotAvailable"):t("vd2.customerReviews");
  const reviewCount=rated?t("booking.community.reviewsCount",{count:safe!.reviewCount}):null;

  return <Pressable testID="venue-hero-reviews"
    accessibilityRole="button"
    accessibilityLabel={heading+(reviewCount?" · "+reviewCount:"")}
    accessibilityHint={t("vd2.customerReviews")}
    onPress={onOpenReviews}
    style={({pressed})=>[styles.badge,pressed&&styles.pressed,
      {flexDirection:isRTL?"row-reverse":"row"}]}>
    <Ionicons name={rated?"star":"star-outline"} size={21} color="#B7791F"/>
    <View style={styles.text}>
      <AppText weight="bold" variant="body" style={styles.rating}>{heading}</AppText>
      {reviewCount?<AppText variant="caption" muted numberOfLines={1}>
        {reviewCount}
      </AppText>:null}
    </View>
    <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={17} color={colors.primary}/>
  </Pressable>;
}
const styles=StyleSheet.create({
  badge:{maxWidth:"100%",minHeight:52,alignSelf:"center",
    alignItems:"center",gap:spacing.sm,
    paddingHorizontal:spacing.md,paddingVertical:spacing.xs,
    backgroundColor:"#FFF8E9",borderWidth:1,borderColor:"#F3D5A5",borderRadius:radius.lg},
  text:{gap:1,alignItems:"center",flexShrink:1},
  rating:{color:colors.text,textAlign:"center"},
  pressed:{opacity:0.8},
});
