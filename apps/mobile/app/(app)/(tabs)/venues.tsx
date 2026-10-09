import Ionicons from "@expo/vector-icons/Ionicons";
import { spacing, colors, radius } from "@leaguekick/design-tokens";
import type { FollowedVenueDto, PublicVenueDto } from "@leaguekick/contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { marketingApi, resolveMediaImageUrl, venueApi } from "../../../src/lib/api";
import { FollowedVenueTile } from "../../../src/components/venues/FollowedVenueTile";
import { AppText } from "../../../src/components/ui/AppText";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { Button } from "../../../src/components/ui/Button";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

const MAX_VISIBLE_FOLLOWS=10;

export default function VenuesScreen(){
  const {t,isRTL}=useLocale();
  const {session}=useAuth();
  const token=session?.accessToken;
  const [query,setQuery]=useState("");
  const [city,setCity]=useState("");
  const [venues,setVenues]=useState<PublicVenueDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [followed,setFollowed]=useState<FollowedVenueDto[]>([]);
  const [followsLoading,setFollowsLoading]=useState(true);
  const [followsError,setFollowsError]=useState<string|null>(null);
  const [followRefresh,setFollowRefresh]=useState(0);

  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try{
      setVenues((await venueApi.list({
        ...(query.trim()?{q:query.trim()}:{}),
        ...(city.trim()?{city:city.trim()}:{})
      })).venues);
    }catch{setError(t("booking.loadVenuesError"));}
    finally{setLoading(false);}
  },[city,query,t]);

  useEffect(()=>{void load();},[]);

  // Refetch on return from any venue profile. Following/unfollowing immediately
  // updates this rail without relying on stale publicly cached venue lists.
  useFocusEffect(useCallback(()=>{
    let active=true;
    if(!token){setFollowed([]);setFollowsLoading(false);return ()=>{active=false;};}
    setFollowsLoading(true);setFollowsError(null);
    void marketingApi.followedVenues(token).then(({venues:next})=>{
      if(active)setFollowed(next);
    }).catch(()=>{
      if(active)setFollowsError(t("booking.followedLoadError"));
    }).finally(()=>{
      if(active)setFollowsLoading(false);
    });
    return ()=>{active=false;};
  },[token,t,followRefresh]));

  const preview=followed.slice(0,MAX_VISIBLE_FOLLOWS);
  const additionalCount=followed.length-MAX_VISIBLE_FOLLOWS;

  return <Screen showHeader publicNav style={styles.page}>
    <View testID="venue-followed-strip" style={styles.followedSection}>
      <View style={[styles.followedHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="heart-circle-outline" size={21} color={colors.primary}/>
        <AppText weight="bold" style={{flex:1}}>{t("booking.followedVenues")}</AppText>
      </View>

      {followsLoading?<DataLoadingState variant="list" minHeight={120}/>:null}
      {!followsLoading&&followsError?<View style={styles.inlineError}>
        <AppText variant="caption" style={{color:colors.danger,flex:1}}>{followsError}</AppText>
        <Pressable accessibilityRole="button" onPress={()=>setFollowRefresh(value=>value+1)}
          accessibilityLabel={t("common.retry")} style={styles.inlineRetry}>
          <Ionicons name="refresh" size={20} color={colors.primary}/>
          <AppText weight="semibold" variant="caption" style={{color:colors.primary}}>{t("common.retry")}</AppText>
        </Pressable>
      </View>:null}

      {!followsLoading&&!followsError&&followed.length===0?
        <AppText muted variant="caption" style={styles.emptyFollowed}>{t("booking.followedVenuesEmpty")}</AppText>:null}

      {!followsLoading&&followed.length>0?<ScrollView
        testID="venue-followed-carousel"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.followedRow,{flexDirection:isRTL?"row-reverse":"row"}]}
      >
        {preview.map(venue=><FollowedVenueTile key={venue.id} venue={venue}/>)}
        {additionalCount>0?<Pressable
          testID="venue-followed-show-more"
          accessibilityRole="button"
          accessibilityLabel={t("booking.followedShowMore")}
          onPress={()=>router.push("/venues/following")}
          style={({pressed})=>[styles.showMore,pressed&&styles.pressed]}
        >
          <View style={styles.showMoreIcon}><Ionicons name={isRTL?"arrow-back":"arrow-forward"} size={26} color={colors.primary}/></View>
          <AppText weight="semibold" variant="caption" numberOfLines={2} style={styles.showMoreLabel}>
            {t("booking.followedShowMore")}
          </AppText>
          <AppText variant="caption" muted>+{additionalCount}</AppText>
        </Pressable>:null}
      </ScrollView>:null}
    </View>

    <View style={styles.searchSection}>
      <TextField label={t("media.venueSearch")} value={query} onChangeText={setQuery} hint={t("media.venueSearchHint")}/>
      <TextField label={t("booking.cityFilter")} value={city} onChangeText={setCity}/>
      <Button label={t("booking.search")} onPress={()=>void load()} loading={loading}/>
    </View>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    {loading?<DataLoadingState variant="list" minHeight={370}/>:null}
    {!loading&&!error&&venues.length===0?<Card><AppText>{t("booking.noVenues")}</AppText></Card>:null}

    {!loading?venues.map(venue=><Pressable key={venue.id} accessibilityRole="button"
      accessibilityLabel={venue.name} onPress={()=>router.push({pathname:"/venues/[venueId]",params:{venueId:venue.id}})}>
      <Card>
        <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
          {resolveMediaImageUrl(venue.pageProfileImageUrl)
            ?<Image source={{uri:resolveMediaImageUrl(venue.pageProfileImageUrl)!}} style={styles.listLogo}/>
            :<View style={[styles.listLogo,styles.logoFallback]}>
              <Ionicons name="football-outline" size={27} color={colors.primary}/>
            </View>}
          <View style={{flex:1,gap:2,alignItems:isRTL?"flex-end":"flex-start"}}>
            <AppText variant="bodyLarge" weight="bold">{venue.name}</AppText>
            <AppText muted>{venue.city}, {venue.province}</AppText>
          </View>
        </View>
        {venue.pageBio?<AppText muted>{venue.pageBio}</AppText>:null}
        <AppText>{venue.address}</AppText>
        <AppText style={{color:colors.primary}} weight="semibold">{t("booking.viewAvailability")}</AppText>
      </Card>
    </Pressable>):null}
  </Screen>;
}

const styles=StyleSheet.create({
  page:{paddingTop:spacing.sm,gap:spacing.md},
  followedSection:{gap:spacing.sm,backgroundColor:colors.surface,borderRadius:radius.lg,
    paddingVertical:spacing.md,paddingHorizontal:spacing.sm,borderWidth:1,borderColor:colors.border},
  followedHeading:{alignItems:"center",gap:spacing.xs,paddingHorizontal:spacing.sm},
  followedRow:{gap:spacing.sm,paddingHorizontal:spacing.xs,paddingVertical:spacing.xs,alignItems:"stretch"},
  emptyFollowed:{paddingHorizontal:spacing.sm,paddingVertical:spacing.md},
  showMore:{width:104,minHeight:112,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,
    backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center",
    paddingVertical:spacing.sm,paddingHorizontal:spacing.xs,gap:spacing.xs},
  showMoreIcon:{width:54,height:54,borderRadius:27,backgroundColor:colors.surface,alignItems:"center",justifyContent:"center"},
  showMoreLabel:{textAlign:"center",color:colors.primary,width:"100%"},
  inlineError:{flexDirection:"row",alignItems:"center",gap:spacing.sm,paddingHorizontal:spacing.sm},
  inlineRetry:{flexDirection:"row",gap:spacing.xs,alignItems:"center",minHeight:44},
  searchSection:{gap:spacing.sm},
  listLogo:{width:52,height:52,borderRadius:26},
  logoFallback:{alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  pressed:{opacity:.8},
});
