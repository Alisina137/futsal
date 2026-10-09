import Ionicons from "@expo/vector-icons/Ionicons";
import { spacing, colors, radius } from "@leaguekick/design-tokens";
import type { FollowedVenueDto, PublicVenueDto, VenueSearchSuggestion } from "@leaguekick/contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { marketingApi, venueApi } from "../../../src/lib/api";
import { FollowedVenueTile } from "../../../src/components/venues/FollowedVenueTile";
import { VenueResultCard } from "../../../src/components/venues/VenueResultCard";
import { AppText } from "../../../src/components/ui/AppText";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { Button } from "../../../src/components/ui/Button";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

const MAX_VISIBLE_FOLLOWS=10;
const DEFAULT_PROVINCE="Kabul";

export default function VenuesScreen(){
  const {t,isRTL}=useLocale();
  const {session}=useAuth();
  const token=session?.accessToken;
  const [query,setQuery]=useState("");
  const [province,setProvince]=useState(DEFAULT_PROVINCE);
  const [provinceOptions,setProvinceOptions]=useState<string[]>([]);
  const [provincePickerOpen,setProvincePickerOpen]=useState(false);
  const [optionsError,setOptionsError]=useState(false);
  const [suggestions,setSuggestions]=useState<VenueSearchSuggestion[]>([]);
  const [suggestionsVisible,setSuggestionsVisible]=useState(false);
  const [venues,setVenues]=useState<PublicVenueDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [followed,setFollowed]=useState<FollowedVenueDto[]>([]);
  const [followsLoading,setFollowsLoading]=useState(true);
  const [followsError,setFollowsError]=useState<string|null>(null);
  const [followRefresh,setFollowRefresh]=useState(0);

  const load=useCallback(async(nextQuery:string,nextProvince:string)=>{
    setLoading(true);setError(null);
    try{
      setVenues((await venueApi.list({
        ...(nextQuery.trim()?{q:nextQuery.trim()}:{}),
        ...(nextProvince?{province:nextProvince}:{})
      })).venues);
    }catch{setError(t("booking.loadVenuesError"));}
    finally{setLoading(false);}
  },[t]);

  useEffect(()=>{void load("",DEFAULT_PROVINCE);},[load]);

  // Provinces are provided by subscribed, currently discoverable venue pages;
  // never maintain an outdated hard-coded Afghanistan province list.
  useFocusEffect(useCallback(()=>{
    let active=true;
    void venueApi.discovery().then(result=>{
      if(active){setProvinceOptions(result.provinces);setOptionsError(false);}
    }).catch(()=>{if(active)setOptionsError(true);});
    return ()=>{active=false;};
  },[]));

  // Debounced, server-backed suggestions. Cancel older requests on every edit
  // so that slower responses cannot overwrite suggestions for newer text.
  useEffect(()=>{
    if(!suggestionsVisible||!query.trim()){
      setSuggestions([]);
      return;
    }
    let active=true;
    const timer=setTimeout(()=>{
      void venueApi.discovery({q:query.trim(),...(province?{province}:{})})
        .then(result=>{if(active)setSuggestions(result.suggestions);})
        .catch(()=>{if(active)setSuggestions([]);});
    },260);
    return ()=>{active=false;clearTimeout(timer);};
  },[query,province,suggestionsVisible]);

  function applySearch(nextQuery=query,nextProvince=province){
    setSuggestionsVisible(false);
    setSuggestions([]);
    void load(nextQuery,nextProvince);
  }

  function selectSuggestion(suggestion:VenueSearchSuggestion){
    setQuery(suggestion.query);
    applySearch(suggestion.query,province);
  }

  function selectProvince(nextProvince:string){
    setProvincePickerOpen(false);
    setProvince(nextProvince);
    applySearch(query,nextProvince);
  }

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
      <View style={styles.selectField}>
        <AppText weight="medium">{t("booking.provinceFilter")}</AppText>
        <Pressable testID="venue-province-select" accessibilityRole="button"
          accessibilityLabel={t("booking.provinceFilter")}
          accessibilityHint={t("booking.chooseProvince")}
          accessibilityState={{expanded:provincePickerOpen}}
          onPress={()=>setProvincePickerOpen(true)}
          style={[styles.selectButton,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="location-outline" size={19} color={colors.primary}/>
          <AppText style={{flex:1}} weight="medium" numberOfLines={1}>
            {province||t("booking.allProvinces")}
          </AppText>
          <Ionicons name="chevron-down" size={19} color={colors.textMuted}/>
        </Pressable>
        {optionsError?<AppText variant="caption" style={{color:colors.danger}}>{t("booking.provinceOptionsError")}</AppText>:null}
      </View>


      <TextField
        testID="venue-name-location-search"
        label={t("booking.venueNameLocation")}
        placeholder={t("booking.searchVenuePlaceholder")}
        value={query}
        maxLength={120}
        autoCorrect={false}
        returnKeyType="search"
        onFocus={()=>setSuggestionsVisible(true)}
        onSubmitEditing={()=>applySearch()}
        onChangeText={text=>{setQuery(text);setSuggestionsVisible(true);setSuggestions([]);}}
      />

      {suggestionsVisible&&query.trim().length>0&&suggestions.length>0?
        <View testID="venue-search-suggestions" style={styles.suggestionsBox}>
          {suggestions.map((item,index)=><Pressable
            key={`${item.kind}-${item.query}-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}, ${item.detail}`}
            onPress={()=>selectSuggestion(item)}
            style={({pressed})=>[styles.suggestionRow,{flexDirection:isRTL?"row-reverse":"row"},pressed&&styles.pressed]}
          >
            <Ionicons name={item.kind==="VENUE"?"football-outline":"location-outline"}
              size={20} color={colors.primary}/>
            <View style={{flex:1,alignItems:isRTL?"flex-end":"flex-start",gap:2}}>
              <AppText weight="medium" numberOfLines={1}>{item.label}</AppText>
              <AppText variant="caption" muted numberOfLines={1}>{item.detail}</AppText>
            </View>
            <AppText variant="caption" muted>{t(item.kind==="VENUE"?"booking.suggestionVenue":"booking.suggestionLocation")}</AppText>
          </Pressable>)}
        </View>:null}


      <Button label={t("booking.search")} onPress={()=>applySearch()} loading={loading}/>
    </View>

    <Modal visible={provincePickerOpen} transparent animationType="fade"
      onRequestClose={()=>setProvincePickerOpen(false)}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} accessibilityRole="button"
          accessibilityLabel={t("common.cancel")} onPress={()=>setProvincePickerOpen(false)}/>
        <View style={styles.provincePanel}>
          <View style={[styles.pickerHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <AppText weight="bold" variant="bodyLarge" style={{flex:1}}>{t("booking.chooseProvince")}</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")}
              onPress={()=>setProvincePickerOpen(false)} style={styles.pickerClose}>
              <Ionicons name="close" size={22} color={colors.text}/>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {["",...provinceOptions].map(option=><Pressable key={option||"all"}
              testID={option?`venue-province-${option}`:"venue-province-all"}
              accessibilityRole="button"
              accessibilityState={{selected:province===option}}
              onPress={()=>selectProvince(option)}
              style={[styles.provinceOption,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <AppText weight={province===option?"bold":"regular"} style={{flex:1}}>
                {option||t("booking.allProvinces")}
              </AppText>
              {province===option?<Ionicons name="checkmark-circle" size={21} color={colors.primary}/>:null}
            </Pressable>)}
          </ScrollView>
        </View>
      </View>
    </Modal>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    {loading?<DataLoadingState variant="list" minHeight={370}/>:null}
    {!loading&&!error&&venues.length===0?<Card><AppText>{t("booking.noVenues")}</AppText></Card>:null}

    {!loading&&!error?venues.map(venue=><VenueResultCard
      key={venue.id}
      id={venue.id}
      name={venue.name}
      city={venue.city}
      province={venue.province}
      imageUrl={venue.pageCoverImageUrl??venue.pageProfileImageUrl}
      onlineBookingEnabled={venue.onlineBookingEnabled}
    />):null}
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
  suggestionsBox:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.md,overflow:"hidden"},
  suggestionRow:{alignItems:"center",gap:spacing.sm,minHeight:54,
    paddingHorizontal:spacing.md,paddingVertical:spacing.sm,
    borderBottomWidth:1,borderBottomColor:colors.border},
  selectField:{gap:spacing.sm},
  selectButton:{minHeight:51,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.md,backgroundColor:colors.surface,
    alignItems:"center",paddingHorizontal:spacing.md,gap:spacing.sm},
  modalRoot:{flex:1,justifyContent:"center",alignItems:"center",padding:spacing.md},
  modalBackdrop:{position:"absolute",top:0,bottom:0,left:0,right:0,
    backgroundColor:"rgba(0,0,0,.55)"},
  provincePanel:{backgroundColor:colors.surface,width:"100%",maxWidth:520,
    maxHeight:"75%",borderRadius:radius.lg,overflow:"hidden"},
  pickerHeader:{minHeight:58,paddingHorizontal:spacing.md,alignItems:"center",
    borderBottomWidth:1,borderBottomColor:colors.border},
  pickerClose:{height:44,width:44,alignItems:"center",justifyContent:"center"},
  provinceOption:{minHeight:49,paddingHorizontal:spacing.lg,paddingVertical:spacing.sm,
    alignItems:"center",borderBottomWidth:1,borderBottomColor:colors.border},
  pressed:{opacity:.8},
});
