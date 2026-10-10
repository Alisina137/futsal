import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { NearbyVenueDto } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { PermissionsAndroid, Platform, Pressable, StyleSheet, View } from "react-native";
import { venueApi } from "../../../src/lib/api";
import { NearbyVenuesMap } from "../../../src/components/venues/NearbyVenuesMap";
import { NearbyDeviceLocation } from "../../../src/components/venues/NearbyDeviceLocation";
import { useAuth } from "../../../src/providers/AuthProvider";
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
  const {session}=useAuth();
  const settled=useRef(false);
  const defaultPoint=useMemo(()=>{
    const latitude=session?.user.defaultLatitude,longitude=session?.user.defaultLongitude;
    if(typeof latitude!=="number"||typeof longitude!=="number"||
      !Number.isFinite(latitude)||!Number.isFinite(longitude)||
      Math.abs(latitude)>90||Math.abs(longitude)>180)return null;
    return {latitude,longitude};
  },[session?.user.defaultLatitude,session?.user.defaultLongitude]);
  const [locationSource,setLocationSource]=useState<"device"|"default"|null>(null);
  const [retry,setRetry]=useState(0);
  const [locationState,setLocationState]=useState<LocationState>("asking");
  const [location,setLocation]=useState<Point|null>(null);
  const [venues,setVenues]=useState<NearbyVenueDto[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [mapFailed,setMapFailed]=useState(false);

  // The 10-second deadline includes permission wait AND device GPS fix.
  // A saved preference is only used after live position fails, never silently
  // mistaken for actual device location. Late callbacks cannot replace results.
  useEffect(()=>{
    let active=true;
    settled.current=false;
    setLocation(null);setLocationSource(null);setVenues([]);
    setSelectedId(null);setMapFailed(false);setError(null);setLocationState("asking");
    const fallback=(reason:"denied"|"timeout")=>{
      if(!active||settled.current)return;
      settled.current=true;
      if(defaultPoint){
        setLocationSource("default");
        setLocation(defaultPoint);
        setLocationState("ready");
      }else setLocationState(reason);
    };
    const timer=setTimeout(()=>fallback("timeout"),10_000);
    void (async()=>{
      try{
        if(Platform.OS==="android"){
          const fine=PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
          const coarse=PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
          let granted=await PermissionsAndroid.check(fine)||await PermissionsAndroid.check(coarse);
          if(!granted){
            const answer=await PermissionsAndroid.request(fine,{
              title:t("booking.nearbyPermissionTitle"),
              message:t("booking.nearbyPermissionBody"),
              buttonPositive:"OK",
              buttonNegative:t("common.cancel"),
            });
            granted=answer===PermissionsAndroid.RESULTS.GRANTED
              ||await PermissionsAndroid.check(coarse);
            if(!granted&&!settled.current){
              const approximate=await PermissionsAndroid.request(coarse);
              granted=approximate===PermissionsAndroid.RESULTS.GRANTED;
            }
          }
          if(!granted){fallback("denied");return;}
        }
        if(active&&!settled.current)setLocationState("locating");
      }catch{fallback("denied");}
    })();
    return ()=>{active=false;clearTimeout(timer);settled.current=true;};
  },[retry,t,defaultPoint]);

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
    if(settled.current)return;
    if(!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude)
      ||Math.abs(point.latitude)>90||Math.abs(point.longitude)>180)return;
    settled.current=true;
    setLocationSource("device");setLocation(point);setLocationState("ready");
  }
  function onDeviceError(){
    if(settled.current)return;
    settled.current=true;
    if(defaultPoint){
      setLocationSource("default");setLocation(defaultPoint);setLocationState("ready");
    }else setLocationState("denied");
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

    {locationState==="locating"?<NearbyDeviceLocation
      onLocation={onDeviceLocation} onError={onDeviceError}/>:null}
    {locationSource==="default"&&location?<Card testID="nearby-default-fallback" style={styles.notice}>
      <Ionicons name="location-outline" size={29} color={colors.primary}/>
      <AppText weight="semibold">{t("booking.nearbyDefaultUsed")}</AppText>
      <AppText variant="caption" muted style={{textAlign:"center"}}>
        {t("booking.nearbyDefaultExplanation")}
      </AppText>
      <Button label={t("booking.tryLiveLocation")} variant="secondary" onPress={locationRetry}/>
      <Button label={t("booking.editDefaultLocation")} variant="secondary"
        onPress={()=>router.push("/profile/account")}/>
    </Card>:null}

    {locationState==="denied"||locationState==="timeout"?<Card style={styles.notice}>
      <Ionicons name="location-outline" size={29} color={colors.primary}/>
      <AppText>{t(locationState==="denied"?"booking.nearbyPermissionDenied":"booking.nearbyTimeout")}</AppText>
      <Button label={t("common.retry")} onPress={locationRetry}/>
      {!defaultPoint?<Button label={t("booking.setDefaultLocation")} variant="secondary"
        onPress={()=>router.push("/profile/account")}/>:null}
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
  notice:{padding:spacing.lg,gap:spacing.md,alignItems:"center"},
  mapFrame:{position:"relative",borderRadius:radius.lg,overflow:"hidden",backgroundColor:colors.surfaceMuted},
  selectedOverlay:{position:"absolute",bottom:10,left:10,right:10,elevation:4},
  venueRow:{gap:spacing.xs},
  distance:{alignItems:"center",gap:spacing.xs},
});
