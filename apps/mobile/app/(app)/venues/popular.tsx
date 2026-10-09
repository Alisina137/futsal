import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { MostFollowedVenueDto } from "@leaguekick/contracts";
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
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function MostFollowedVenuesScreen(){
  const {t,isRTL}=useLocale();
  const [venues,setVenues]=useState<MostFollowedVenueDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [retry,setRetry]=useState(0);

  useFocusEffect(useCallback(()=>{
    let active=true;
    setLoading(true);setError(null);
    void marketingApi.mostFollowedVenues().then(result=>{
      if(active)setVenues(result.venues);
    }).catch(()=>{
      if(active)setError(t("booking.popularError"));
    }).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[retry,t]));

  return <Screen showHeader publicNav style={styles.page}>
    <View style={[styles.header,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("booking.backToVenues")}
        onPress={()=>router.navigate("/venues")} style={styles.back}>
        <Ionicons name={isRTL?"arrow-forward":"arrow-back"} size={22} color={colors.primary}/>
      </Pressable>
      <AppText weight="bold" variant="bodyLarge" style={{flex:1}}>{t("booking.mostFollowed")}</AppText>
    </View>

    {loading?<DataLoadingState variant="list" minHeight={360}/>:null}
    {!loading&&error?<Card style={styles.message}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary" onPress={()=>setRetry(n=>n+1)}/>
    </Card>:null}
    {!loading&&!error&&venues.length===0?<Card style={styles.message}>
      <AppText muted>{t("booking.popularEmpty")}</AppText>
    </Card>:null}
    {!loading&&!error?venues.map((venue,index)=><View key={venue.id}
      testID={`popular-venue-${venue.id}`} style={styles.result}>
      <View style={[styles.rankRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.rank}><AppText weight="bold" variant="caption" style={{color:colors.primary}}>
          #{index+1}
        </AppText></View>
        <Ionicons name="people-outline" color={colors.primary} size={16}/>
        <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
          {t("booking.followersCount",{count:venue.followerCount})}
        </AppText>
      </View>
      <VenueResultCard id={venue.id} name={venue.name}
        city={venue.city} province={venue.province}
        imageUrl={venue.imageUrl} onlineBookingEnabled={venue.onlineBookingEnabled}/>
    </View>):null}
  </Screen>;
}

const styles=StyleSheet.create({
  page:{paddingTop:spacing.md,gap:spacing.md},
  header:{gap:spacing.sm,alignItems:"center"},
  back:{width:44,height:44,borderRadius:22,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  result:{gap:spacing.xs},
  rankRow:{alignItems:"center",gap:spacing.xs},
  rank:{borderRadius:radius.sm,backgroundColor:colors.primarySoft,
    minWidth:34,minHeight:29,alignItems:"center",justifyContent:"center"},
  message:{padding:spacing.md,gap:spacing.md},
});
