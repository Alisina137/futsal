import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { FollowedVenueDto } from "@leaguekick/contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { marketingApi } from "../../../src/lib/api";
import { VenueResultCard } from "../../../src/components/venues/VenueResultCard";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function FollowedVenuesScreen(){
  const {t,isRTL}=useLocale();
  const {session}=useAuth();
  const token=session?.accessToken;
  const [venues,setVenues]=useState<FollowedVenueDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [refreshKey,setRefreshKey]=useState(0);

  useFocusEffect(useCallback(()=>{
    let active=true;
    if(!token){setVenues([]);setLoading(false);return ()=>{active=false;};}
    setLoading(true);setError(null);
    void marketingApi.followedVenues(token).then(({venues:next})=>{
      if(active)setVenues(next);
    }).catch(()=>{
      if(active)setError(t("booking.followedLoadError"));
    }).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[token,t,refreshKey]));

  return <Screen showHeader publicNav style={styles.page}>
    <View style={[styles.header,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("booking.backToVenues")}
        onPress={()=>router.navigate("/venues")} style={styles.backButton}>
        <Ionicons name={isRTL?"arrow-forward":"arrow-back"} size={23} color={colors.primary}/>
      </Pressable>
      <View style={{flex:1,alignItems:isRTL?"flex-end":"flex-start"}}>
        <AppText weight="bold" variant="bodyLarge">{t("booking.followedVenues")}</AppText>
        {!loading&&!error?<AppText variant="caption" muted>
          {t("booking.followedVenuesCount",{count:venues.length})}
        </AppText>:null}
      </View>
    </View>

    {loading?<DataLoadingState variant="list" minHeight={410}/>:null}
    {!loading&&error?<Card style={styles.alert}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary"
        onPress={()=>setRefreshKey(value=>value+1)}/>
    </Card>:null}
    {!loading&&!error&&venues.length===0?<Card style={styles.emptyCard}>
      <Ionicons name="heart-outline" size={35} color={colors.primary}/>
      <AppText weight="medium">{t("booking.followedVenuesEmpty")}</AppText>
      <Button label={t("booking.backToVenues")} onPress={()=>router.navigate("/venues")}/>
    </Card>:null}

    {!loading&&!error?venues.map(venue=><VenueResultCard
      key={venue.id}
      testID={`followed-venue-list-${venue.id}`}
      id={venue.id}
      name={venue.name}
      city={venue.city}
      province={venue.province}
      imageUrl={venue.imageUrl}
    />):null}
  </Screen>;
}

const styles=StyleSheet.create({
  page:{gap:spacing.md,paddingTop:spacing.md},
  header:{alignItems:"center",gap:spacing.sm},
  backButton:{width:44,height:44,borderRadius:22,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  emptyCard:{gap:spacing.md,alignItems:"center",padding:spacing.lg},
  alert:{gap:spacing.sm},
});
