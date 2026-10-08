import { spacing, colors } from "@leaguekick/design-tokens";
import type { PublicVenueDto } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { resolveMediaImageUrl, venueApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { Button } from "../../../src/components/ui/Button";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function VenuesScreen(){
  const {t}=useLocale();
  const [query,setQuery]=useState("");
  const [city,setCity]=useState("");
  const [venues,setVenues]=useState<PublicVenueDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true); setError(null);
    try{setVenues((await venueApi.list({...(query.trim()?{q:query.trim()}:{}),...(city.trim()?{city:city.trim()}:{})})).venues);}
    catch{setError(t("booking.loadVenuesError"));}
    finally{setLoading(false);}
  },[city,query,t]);

  useEffect(()=>{void load();},[]);

  if(loading)return <Screen showHeader publicNav><DataLoadingState variant="list" minHeight={460}/></Screen>;

  return <Screen showHeader publicNav>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("booking.venuesTitle")}</AppText>
      <AppText muted>{t("booking.venuesSubtitle")}</AppText>
    </View>
    <TextField label={t("media.venueSearch")} value={query} onChangeText={setQuery} hint={t("media.venueSearchHint")}/>
    <TextField label={t("booking.cityFilter")} value={city} onChangeText={setCity}/>
    <Button label={t("booking.search")} onPress={()=>void load()} loading={loading}/>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    {!loading&&venues.length===0?<Card><AppText>{t("booking.noVenues")}</AppText></Card>:null}
    {venues.map((venue)=><Pressable key={venue.id} onPress={()=>router.push({pathname:"/venues/[venueId]",params:{venueId:venue.id}})}>
      <Card>
        <View style={{flexDirection:"row",alignItems:"center",gap:spacing.sm}}>
          {resolveMediaImageUrl(venue.pageProfileImageUrl)
            ?<Image source={{uri:resolveMediaImageUrl(venue.pageProfileImageUrl)!}} style={{width:52,height:52,borderRadius:26}}/>
            :<View style={{width:52,height:52,borderRadius:26,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft}}>
              <AppText weight="bold" style={{color:colors.primary}}>{venue.name.trim().slice(0,2).toUpperCase()}</AppText>
            </View>}
          <View style={{flex:1,gap:2}}>
            <AppText variant="bodyLarge" weight="bold">{venue.name}</AppText>
            <AppText muted>{venue.city}, {venue.province}</AppText>
          </View>
        </View>
        {venue.pageBio?<AppText muted>{venue.pageBio}</AppText>:null}
        <AppText>{venue.address}</AppText>
        <AppText style={{color:colors.primary}} weight="semibold">{t("booking.viewAvailability")}</AppText>
      </Card>
    </Pressable>)}
  </Screen>;
}
