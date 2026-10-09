import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { NearbyVenueDto } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { PermissionsAndroid, Platform, Pressable, StyleSheet, View } from "react-native";
import MapView from "react-native-maps";
import { venueApi } from "../../../src/lib/api";
import { NearbyVenuesMap } from "../../../src/components/venues/NearbyVenuesMap";
import { VenueResultCard } from "../../../src/components/venues/VenueResultCard";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { useLocale } from "../../../src/providers/LocaleProvider";

type Point={latitude:number;longitude:number};
type LocationState="asking"|"locating"|"ready"|"denied"|"timeout";

export default function NearbyVenuesScreen(){
  const {t,isRTL}=useLocale();
  const [retry,setRetry]=useState(0);
  const [locationState,setLocationState]=useState<LocationState>("asking");
  const [location,setLocation]=useState<Point|null>(null);
  const [venues,setVenues]=useState<NearbyVenueDto[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [mapFailed,setMapFailed]=useState(false);

  // Request a foreground location only after the user opens Venues Nearby.
  // react-native-maps is already installed; its location callback works in
  // Expo Go even on devices where native Google map tiles are unavailable.
  useEffect(()=>{
    let active=true;
    setLocation(null);setVenues([]);setSelectedId(null);setMapFailed(false);setError(null);
    setLocationState("asking");
    void (async()=>{
      try{
        if(Platform.OS==="android"){
          const fine=PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
          const coarse=PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
          const hasFine=await PermissionsAndroid.check(fine);
          const hasCoarse=await PermissionsAndroid.check(coarse);
          let granted=hasFine||hasCoarse;
          if(!granted){
            const answer=await PermissionsAndroid.request(fine,{
              title:t("booking.nearbyPermissionTitle"),
              message:t("booking.nearbyPermissionBody"),
              buttonPositive:"OK",
              buttonNegative:t("common.cancel"),
            });
            granted=answer===PermissionsAndroid.RESULTS.GRANTED
              ||await PermissionsAndroid.check(coarse);
            if(!granted){
              const approximate=await PermissionsAndroid.request(coarse);
              granted=approximate===PermissionsAndroid.RESULTS.GRANTED;
            }
          }
          if(!granted){if(active)setLocationState("denied");return;}
        }
        if(active)setLocationState("locating");
      }catch{if(active)setLocationState("denied");}
    })();
    return ()=>{active=false;};
  },[retry,t]);

  useEffect(()=>{
    if(locationState!=="locating")return;
    const timer=setTimeout(()=>setLocationState(current=>current==="locating"?"timeout":current),18000);
    return ()=>clearTimeout(timer);
  },[locationState]);

  useEffect(()=>{
    if(!location)return;
    let active=true;
    setLoading(true);setError(null);
    void venueApi.nearby(location.latitude,location.longitude).then(result=>{
      if(active){setVenues(result.venues);setSelectedId(null);}
    }).catch(()=>{
      if(active)setError(t("booking.nearbyError"));
    }).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[location,t]);

  function onDeviceLocation(point:Point){
    if(locationState!=="locating")return;
    if(!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude)
      ||Math.abs(point.latitude)>90||Math.abs(point.longitude)>180)return;
    setLocation(point);setLocationState("ready");
  }

  const selected=venues.find(venue=>venue.id===selectedId);
  function locationRetry(){setRetry(n=>n+1);}
  function resultsRetry(){
    if(!location)return;
    const point={...location};
    setLocation(null);
    setTimeout(()=>setLocation(point),0);
  }

  return <Screen showHeader publicNav style={styles.page}>
    <View style={[styles.header,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("booking.backToVenues")}
        onPress={()=>router.navigate("/venues")} style={styles.backButton}>
        <Ionicons name={isRTL?"arrow-forward":"arrow-back"} size={22} color={colors.primary}/>
      </Pressable>
      <View style={styles.headerCopy}>
        <AppText weight="bold" variant="bodyLarge">{t("booking.venuesNearby")}</AppText>
        <AppText variant="caption" muted>{t("booking.nearbySubtitle")}</AppText>
      </View>
    </View>

    {(locationState==="asking"||locationState==="locating")?
      <Card style={styles.notice}>
        <Ionicons name="navigate-circle-outline" size={30} color={colors.primary}/>
        <AppText muted>{t("booking.nearbyLocating")}</AppText>
      </Card>:null}

    {locationState==="locating"?<View pointerEvents="none" style={styles.locationProbe}>
      <MapView style={styles.nativeMap}
        showsUserLocation
        showsMyLocationButton={false}
        onUserLocationChange={event=>{
          const point=event.nativeEvent.coordinate;
          if(point)onDeviceLocation({latitude:point.latitude,longitude:point.longitude});
        }}/>
    </View>:null}

    {locationState==="denied"||locationState==="timeout"?<Card style={styles.notice}>
      <Ionicons name="location-outline" size={29} color={colors.primary}/>
      <AppText>{t(locationState==="denied"?"booking.nearbyPermissionDenied":"booking.nearbyTimeout")}</AppText>
      <Button label={t("common.retry")} onPress={locationRetry}/>
    </Card>:null}

    {location&&loading?<DataLoadingState variant="list" minHeight={300}/>:null}
    {location&&!loading&&error?<Card style={styles.notice}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} onPress={resultsRetry}/>
    </Card>:null}
    {location&&!loading&&!error&&venues.length===0?<Card style={styles.notice}>
      <AppText muted>{t("booking.nearbyEmpty")}</AppText>
      <Button label={t("common.retry")} onPress={resultsRetry} variant="secondary"/>
    </Card>:null}

    {location&&!loading&&!error&&venues.length>0?<>
      <View style={styles.mapFrame}>
        <NearbyVenuesMap
          position={location}
          venues={venues}
          onSelect={setSelectedId}
          onFailed={()=>setMapFailed(true)}
          onReady={()=>setMapFailed(false)}
        />
        {selected?<View testID="nearby-selected-venue" style={styles.selectedOverlay}>
          <VenueResultCard id={selected.id} name={selected.name}
            city={selected.city} province={selected.province} imageUrl={selected.imageUrl}
            onlineBookingEnabled={selected.onlineBookingEnabled}/>
        </View>:null}
      </View>
      {mapFailed?<AppText style={{color:colors.danger}}>{t("booking.nearbyMapUnavailable")}</AppText>:
        <AppText variant="caption" muted>{t("booking.nearbySelectPin")}</AppText>}
      {venues.map(venue=><View testID={`nearby-venue-${venue.id}`} key={venue.id} style={styles.venueRow}>
        <View style={[styles.distance,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="navigate-outline" color={colors.primary} size={17}/>
          <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
            {t("booking.nearbyDistance",{distance:venue.distanceKm.toFixed(1)})}
          </AppText>
        </View>
        <VenueResultCard id={venue.id} name={venue.name} city={venue.city} province={venue.province}
          imageUrl={venue.imageUrl} onlineBookingEnabled={venue.onlineBookingEnabled}/>
      </View>)}
    </>:null}
  </Screen>;
}

const styles=StyleSheet.create({
  page:{paddingTop:spacing.md,gap:spacing.md},
  header:{alignItems:"center",gap:spacing.sm},
  headerCopy:{flex:1,gap:3},
  backButton:{width:44,height:44,borderRadius:22,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  locationProbe:{width:2,height:2,overflow:"hidden",alignSelf:"flex-start"},
  nativeMap:{width:2,height:2},
  notice:{padding:spacing.lg,gap:spacing.md,alignItems:"center"},
  mapFrame:{position:"relative",borderRadius:radius.lg,overflow:"hidden",backgroundColor:colors.surfaceMuted},
  selectedOverlay:{position:"absolute",bottom:10,left:10,right:10,elevation:4},
  venueRow:{gap:spacing.xs},
  distance:{alignItems:"center",gap:spacing.xs},
});
