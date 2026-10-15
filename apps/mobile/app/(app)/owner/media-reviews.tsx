import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {VenueReviewSummary,VenueReviewSort} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useRef,useState} from "react";
import {Pressable,StyleSheet,View} from "react-native";
import {ownerApi,venueApi} from "../../../src/lib/api";
import {formatCompetitionDateTime} from "../../../src/lib/date-time";
import {AppText} from "../../../src/components/ui/AppText";
import {Button} from "../../../src/components/ui/Button";
import {Card} from "../../../src/components/ui/Card";
import {DataLoadingState} from "../../../src/components/ui/DataLoadingState";
import {Screen} from "../../../src/components/ui/Screen";
import {useAuth} from "../../../src/providers/AuthProvider";
import {useLocale} from "../../../src/providers/LocaleProvider";

const sorts:readonly VenueReviewSort[]=["recent","highest","lowest"];
export default function OwnerMediaReviewsScreen(){
  const {session}=useAuth();
  const token=session?.accessToken;
  const {t,isRTL,language}=useLocale();
  const [venueId,setVenueId]=useState<string|null>(null);
  const [data,setData]=useState<VenueReviewSummary|null>(null);
  const [loadedToken,setLoadedToken]=useState<string|null>(null);
  const [sort,setSort]=useState<VenueReviewSort>("recent");
  const [page,setPage]=useState(1);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const generation=useRef(0);
  const visible=loadedToken===token&&data?.venueId===venueId?data:null;

  const load=useCallback(async()=>{
    const request=++generation.current;
    if(!token){setData(null);setLoadedToken(null);setLoading(false);return;}
    setLoading(true);setError(null);
    try{
      // The venue ID must always come from the current owner's authorized
      // status, never from a URL parameter or another user's review page.
      const status=await ownerApi.getStatus(token);
      if(request!==generation.current)return;
      if(!status.venue){setVenueId(null);setData(null);setLoadedToken(token);return;}
      const id=status.venue.id;
      setVenueId(id);
      const summary=await venueApi.reviews(id,page,sort);
      if(request!==generation.current)return;
      if(summary.venueId!==id)throw new Error("VENUE_MISMATCH");
      setData(summary);setLoadedToken(token);
    }catch{
      if(request===generation.current)setError(t("owner.phase6.reviewsLoadError"));
    }finally{if(request===generation.current)setLoading(false);}
  },[token,page,sort,t]);

  useFocusEffect(useCallback(()=>{
    void load();return()=>{generation.current++;};
  },[load]));
  const changeSort=(value:VenueReviewSort)=>{
    if(value===sort)return;
    generation.current++;setData(null);setPage(1);setSort(value);
  };
  if(loading&&!visible)return <Screen embedded><DataLoadingState variant="list" minHeight={360}/></Screen>;
  return <Screen embedded refreshing={loading&&!!visible} onRefresh={()=>void load()}>
    <View testID="owner-phase6-reviews" style={styles.stack}>
      <AppText variant="title" weight="bold">{t("owner.dashboardSubnav.reviews")}</AppText>
      <AppText variant="caption" muted>{t("owner.phase6.reviewsReadOnly")}</AppText>
    </View>
    {error?<Card style={styles.stack}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button variant="secondary" label={t("common.retry")} onPress={()=>void load()}/>
    </Card>:null}
    {!venueId&&!loading&&!error?<Card>
      <AppText muted>{t("owner.setupRequiredBody")}</AppText>
      <Button label={t("owner.startSetup")} onPress={()=>router.push("/owner/onboarding")}/>
    </Card>:null}
    {visible?<Card style={styles.stack}>
      <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="star" color={colors.warning} size={24}/>
        <AppText variant="title" weight="bold">
          {new Intl.NumberFormat(language,{maximumFractionDigits:1}).format(visible.averageRating)} / 5
        </AppText>
        <AppText muted>{t("owner.phase6.reviewCount",{count:visible.reviewCount})}</AppText>
      </View>
      {[5,4,3,2,1].map(stars=><View key={stars}
        style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <AppText variant="caption" weight="semibold" style={{width:26}}>{stars} ★</AppText>
        <View style={styles.track}>
          <View style={[styles.fill,{width:`${visible.reviewCount>0
            ?100*(visible.ratingCounts[stars-1]??0)/visible.reviewCount:0}%`}]}/>
        </View>
        <AppText variant="caption" muted>{visible.ratingCounts[stars-1]??0}</AppText>
      </View>)}
    </Card>:null}
    <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row",flexWrap:"wrap"}]}>
      {sorts.map(key=><Pressable key={key} testID={`owner-phase6-review-sort-${key}`}
        accessibilityRole="button" accessibilityState={{selected:key===sort}}
        onPress={()=>changeSort(key)}
        style={[styles.chip,key===sort&&styles.selected]}>
        <AppText variant="caption" weight="semibold"
          style={key===sort?{color:colors.primary}:undefined}>
          {t(`owner.phase6.reviewSort.${key}` as never)}
        </AppText>
      </Pressable>)}
    </View>
    {visible?.reviews.length===0&&!loading?<Card>
      <AppText muted>{t("owner.phase6.noReviews")}</AppText>
    </Card>:null}
    {visible?.reviews.map(item=><Card key={item.id} style={styles.stack}>
      <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="star" size={17} color={colors.warning}/>
        <AppText weight="semibold">{item.rating}/5</AppText>
        <AppText variant="caption" muted style={{flex:1}}>
          {formatCompetitionDateTime(item.createdAt,language)}
        </AppText>
        <Ionicons name="checkmark-circle-outline" size={17} color={colors.success}/>
      </View>
      {item.body?<AppText>{item.body}</AppText>:null}
    </Card>)}
    {visible?<View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Button variant="secondary" style={{flex:1}} label={t("owner.phase6.previous")}
        disabled={page<=1||loading} onPress={()=>{setData(null);setPage(v=>Math.max(1,v-1));}}/>
      <AppText variant="caption" muted>{t("owner.phase6.reviewPage",{page})}</AppText>
      <Button variant="secondary" style={{flex:1}} label={t("owner.phase6.next")}
        disabled={!visible.hasMore||loading} onPress={()=>{setData(null);setPage(v=>v+1);}}/>
    </View>:null}
  </Screen>;
}
const styles=StyleSheet.create({
  stack:{gap:spacing.md},row:{alignItems:"center",gap:spacing.sm},
  track:{flex:1,height:9,borderRadius:radius.pill,backgroundColor:colors.surfaceMuted,
    overflow:"hidden"},fill:{height:9,backgroundColor:colors.primary},
  chip:{minHeight:44,justifyContent:"center",paddingHorizontal:spacing.md,
    borderWidth:1,borderColor:colors.border,borderRadius:radius.pill,
    backgroundColor:colors.surface},
  selected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
});
