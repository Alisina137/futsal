import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {CompetitionDiscoveryItem,CompetitionDiscoveryQuery,CompetitionDiscoveryResponse} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useEffect,useRef,useState} from "react";
import {Pressable,ScrollView,StyleSheet,View,useWindowDimensions} from "react-native";
import {competitionApi} from "../../lib/api";
import {useAuth} from "../../providers/AuthProvider";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";
import {Screen} from "../ui/Screen";
import {TextField} from "../ui/TextField";
import {CompetitionDirectoryCard} from "./CompetitionDirectoryCard";
import {SocialFollowedTile} from "./SocialFollowedTile";
import {DirectoryFilterSelect} from "./DirectoryFilterSelect";

type Mode="directory"|"following"|"popular"|"ongoing"|"registration"|"live"|"mine";
type Scope=CompetitionDiscoveryQuery["scope"];
const MAX_FOLLOWED=10;
const defaults:CompetitionDiscoveryQuery={
  q:"",province:"",city:"",fee:"any",sort:"recommended",scope:"all",page:1,limit:12,
};
const scopes:Record<Mode,Scope>={
  directory:"all",following:"following",popular:"popular",
  ongoing:"ongoingFollowedVenues",registration:"registration",live:"ongoing",mine:"mine",
};
const emptyFacets:CompetitionDiscoveryResponse["facets"]={provinces:[],cities:[]};
const open=(id:string)=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId:id}});
const action=(item:CompetitionDiscoveryItem,t:(key:any)=>string,canRegister:boolean)=>{
  if(item.status==="REGISTRATION_OPEN"&&canRegister)return{
    label:t("competition.register"),to:()=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId:item.id,tab:"TEAMS",focusRegistration:"1"}})};
  if(item.status==="REGISTRATION_OPEN")return{label:t("competition.phase1.viewRegistration"),to:()=>open(item.id)};
  if(item.status==="IN_PROGRESS")return{
    label:t("competition.standings"),to:()=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId:item.id,tab:"STANDINGS"}})};
  if(item.status==="COMPLETED")return{
    label:t("competition.phase1.results"),to:()=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId:item.id,tab:"RESULTS"}})};
  if(item.status==="SCHEDULED")return{
    label:t("competition.phase1.fixtures"),to:()=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId:item.id,tab:"MATCHES"}})};
  return {label:t("competition.viewCompetition"),to:()=>open(item.id)};
};
const isoDay=/^\d{4}-\d{2}-\d{2}$/;
function validDay(value:string){
  if(!isoDay.test(value))return false;
  const d=new Date(value+"T12:00:00Z");
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}

export function CompetitionDirectoryExperience({mode}:{mode:Mode}){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const {width}=useWindowDimensions();
  const twoColumns=width>=720;
  const token=session?.accessToken;
  const canRegister=Boolean(session?.user.roles.includes("TEAM_MANAGER"));
  const modeScope=scopes[mode];
  const [items,setItems]=useState<CompetitionDiscoveryItem[]>([]);
  const [followed,setFollowed]=useState<CompetitionDiscoveryItem[]>([]);
  const [followedTotal,setFollowedTotal]=useState(0);
  const [facets,setFacets]=useState(emptyFacets);
  const [total,setTotal]=useState(0);
  const [hasMore,setHasMore]=useState(false);
  const [currentPage,setCurrentPage]=useState(1);
  const [loading,setLoading]=useState(true);
  const [loadingMore,setLoadingMore]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [retry,setRetry]=useState(0);
  const [query,setQuery]=useState("");
  const [suggestions,setSuggestions]=useState<CompetitionDiscoveryItem[]>([]);
  const [suggestionsOpen,setSuggestionsOpen]=useState(false);
  const [province,setProvince]=useState("");
  const [city,setCity]=useState("");
  const [status,setStatus]=useState<CompetitionDiscoveryQuery["status"]| "">("");
  const [format,setFormat]=useState<CompetitionDiscoveryQuery["format"]| "">("");
  const [fee,setFee]=useState<CompetitionDiscoveryQuery["fee"]>("any");
  const [sort,setSort]=useState<CompetitionDiscoveryQuery["sort"]>("recommended");
  const [minFee,setMinFee]=useState("");
  const [maxFee,setMaxFee]=useState("");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [advanced,setAdvanced]=useState(false);
  const [filterError,setFilterError]=useState<string|null>(null);
  const applied=useRef<CompetitionDiscoveryQuery>({...defaults});
  const requestId=useRef(0);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const followedRequestId=useRef(0);
  const followPage={...defaults,scope:"following" as const,limit:11};
  const privateScope=["following","mine","ongoingFollowedVenues"].includes(modeScope);
  const mainToken=privateScope?token:undefined;

  function clearTimer(){
    if(timer.current){clearTimeout(timer.current);timer.current=null;}
  }
  const load=useCallback(async(filters:CompetitionDiscoveryQuery,page=1,append=false)=>{
    const id=++requestId.current;
    if(append)setLoadingMore(true);
    else{setLoading(true);setError(null);}
    if(privateScope&&!token){
      if(requestId.current===id){
        setItems([]);setTotal(0);setHasMore(false);setLoading(false);setLoadingMore(false);
      }
      return;
    }
    try{
      const result=await competitionApi.discover({...filters,scope:modeScope,page},mainToken);
      if(requestId.current!==id)return;
      setItems(previous=>append?[...previous.filter(x=>!result.competitions.some(y=>y.id===x.id)),
        ...result.competitions]:result.competitions);
      setTotal(result.total);setCurrentPage(page);setHasMore(result.hasMore);
      setFacets(result.facets);
    }catch{
      if(requestId.current===id)setError(t("competition.loadError"));
    }finally{
      if(requestId.current===id){setLoading(false);setLoadingMore(false);}
    }
  },[mainToken,modeScope,privateScope,token,t]);

  const loadFollowed=useCallback(async()=>{
    const id=++followedRequestId.current;
    if(!token){setFollowed([]);setFollowedTotal(0);return;}
    try{
      const result=await competitionApi.discover(followPage,token);
      if(id!==followedRequestId.current)return;
      setFollowed(result.competitions);setFollowedTotal(result.total);
    }catch{
      if(id===followedRequestId.current){setFollowed([]);setFollowedTotal(0);}
    }
  },[token]);

  useFocusEffect(useCallback(()=>{
    void load(applied.current,1);
    if(mode==="directory")void loadFollowed();
    return()=>{clearTimer();++requestId.current;++followedRequestId.current;};
  },[load,loadFollowed,mode,retry]));

  useEffect(()=>()=>{clearTimer();++requestId.current;++followedRequestId.current;},[]);

  // Suggestions are a separate 300ms server query. Out-of-date answers are ignored.
  useEffect(()=>{
    if(mode!=="directory"||!suggestionsOpen||!query.trim()){
      setSuggestions([]);return;
    }
    let active=true;
    const work=setTimeout(()=>{
      void competitionApi.discover({...applied.current,q:query.trim(),page:1,limit:8,scope:"all"})
        .then(result=>{if(active)setSuggestions(result.competitions);})
        .catch(()=>{if(active)setSuggestions([]);});
    },300);
    return()=>{active=false;clearTimeout(work);};
  },[mode,query,suggestionsOpen,province,city,status,format,fee]);

  function apply(next:CompetitionDiscoveryQuery){
    clearTimer();setSuggestionsOpen(false);setSuggestions([]);
    applied.current={...next,scope:"all",page:1};
    setFilterError(null);
    void load(applied.current,1);
  }
  function submit(value=query){apply({...applied.current,q:value.trim()});}
  function typing(value:string){
    setQuery(value);setSuggestionsOpen(true);setSuggestions([]);
    clearTimer();
    // Typing must invalidate an older response even before the debounce fires.
    ++requestId.current;setLoading(false);setLoadingMore(false);setError(null);
    timer.current=setTimeout(()=>{timer.current=null;submit(value);},2000);
  }
  function pickProvince(value:string){
    setProvince(value);setCity("");
    apply({...applied.current,province:value,city:"",q:query.trim()});
  }
  function pickCity(value:string){
    setCity(value);apply({...applied.current,city:value,q:query.trim()});
  }
  function pickStatus(value:string){
    setStatus(value as typeof status);
    apply({...applied.current,status:value?value as CompetitionDiscoveryQuery["status"]:undefined,q:query.trim()});
  }
  function pickFormat(value:string){
    setFormat(value as typeof format);
    apply({...applied.current,format:value?value as CompetitionDiscoveryQuery["format"]:undefined,q:query.trim()});
  }
  function pickFee(value:string){
    const next=value as CompetitionDiscoveryQuery["fee"];setFee(next);
    apply({...applied.current,fee:next,q:query.trim()});
  }
  function pickSort(value:CompetitionDiscoveryQuery["sort"]){
    setSort(value);apply({...applied.current,sort:value,q:query.trim()});
  }
  function applyAdvanced(){
    const min=minFee.trim(),max=maxFee.trim(),start=from.trim(),end=to.trim();
    const numeric=(value:string)=>/^\d+$/.test(value)&&Number(value)<=10_000_000;
    if((min&&!numeric(min))||(max&&!numeric(max))||
      (min&&max&&Number(min)>Number(max))||
      (start&&!validDay(start))||(end&&!validDay(end))||(start&&end&&start>end)){
      setFilterError(t("competition.phase2.invalidFilters"));return;
    }
    apply({...applied.current,q:query.trim(),
      minFee:min?Number(min):undefined,maxFee:max?Number(max):undefined,
      from:start||undefined,to:end||undefined});
  }
  function clearFilters(){
    setQuery("");setProvince("");setCity("");setStatus("");setFormat("");setFee("any");
    setSort("recommended");setMinFee("");setMaxFee("");setFrom("");setTo("");
    setFilterError(null);apply({...defaults});
  }
  const filtersActive=Boolean(applied.current.q||applied.current.province||applied.current.city||
    applied.current.status||applied.current.format||applied.current.fee!=="any"||
    applied.current.from||applied.current.to||applied.current.minFee!==undefined||
    applied.current.maxFee!==undefined||applied.current.sort!=="recommended");

  const title=mode==="popular"?t("competition.mostFollowed")
    :mode==="ongoing"?t("competition.ongoingFollowedVenues")
    :mode==="following"?t("competition.followedCompetitions")
    :mode==="registration"?t("competition.phase1.registrationOpen")
    :mode==="live"?t("competition.phase1.ongoing")
    :mode==="mine"?t("competition.phase1.myCompetitions"):t("competition.title");
  const shortcuts=[
    {id:"registration",label:t("competition.phase1.registrationOpen"),icon:"person-add-outline" as const,
      to:"/competitions/registration" as const},
    {id:"live",label:t("competition.phase1.ongoing"),icon:"play-circle-outline" as const,
      to:"/competitions/live" as const},
    {id:"popular",label:t("competition.mostFollowed"),icon:"trending-up-outline" as const,
      to:"/competitions/popular" as const},
    {id:"mine",label:t("competition.phase1.myCompetitions"),icon:"trophy-outline" as const,
      to:"/competitions/my" as const},
  ];
  function render(item:CompetitionDiscoveryItem,index:number){
    const next=action(item,t,canRegister);
    return <View key={item.id} style={[styles.result,twoColumns&&styles.gridItem]}>
      {mode==="popular"?<AppText variant="caption" weight="semibold" style={styles.accent}>
        #{(currentPage-1)*applied.current.limit+index+1} · {t("social.followers",{count:item.followerCount})}
      </AppText>:null}
      <CompetitionDirectoryCard competition={item}
        detailsLabel={t("competition.viewCompetition")}
        actionLabel={next.label} onDetails={()=>open(item.id)} onAction={next.to}/>
    </View>;
  }
  return <Screen showHeader publicNav style={styles.page}>
    {mode!=="directory"?<View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("competition.backToCompetitions")}
        onPress={()=>router.navigate("/competitions")} style={styles.back}>
        <Ionicons name={isRTL?"arrow-forward":"arrow-back"} size={21} color={colors.primary}/>
      </Pressable>
      <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>{title}</AppText>
    </View>:null}
    {mode==="directory"?<>
      <View testID="competitions-followed-strip" style={styles.panel}>
        <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.titleCopy}>
            <AppText variant="bodyLarge" weight="bold">{t("competition.followedCompetitions")}</AppText>
            <AppText variant="caption" muted>{t("competition.phase1.followedSubtitle")}</AppText>
          </View>
          {followedTotal>0?<Pressable accessibilityRole="button"
            testID="competitions-followed-all" onPress={()=>router.push("/competitions/following")}
            style={styles.headerAction}>
            <AppText variant="caption" weight="semibold" style={styles.accent}>
              {t("competition.phase1.viewAll")}
            </AppText>
            <Ionicons name={isRTL?"arrow-back":"arrow-forward"} size={17} color={colors.primary}/>
          </Pressable>:null}
        </View>
        {loading&&followed.length===0?<DataLoadingState variant="list" minHeight={120}/>:
        followedTotal===0?<AppText muted variant="caption">{t("competition.followedEmpty")}</AppText>:
          <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="competitions-followed-carousel"
            contentContainerStyle={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
            {followed.slice(0,10).map(item=>{
              const next=action(item,t,canRegister);
              return <SocialFollowedTile key={item.id} id={item.id} name={item.name}
                imageUrl={item.coverImageUrl??null}
                memberCountLabel={t(`competition.status.${item.status}` as never)}
                kind="COMPETITION" detailsLabel={t("competition.viewCompetition")}
                actionLabel={next.label} onDetails={()=>open(item.id)} onAction={next.to}/>;
            })}
            {followedTotal>MAX_FOLLOWED?<Pressable testID="competitions-followed-more"
              accessibilityRole="button" onPress={()=>router.push("/competitions/following")} style={styles.more}>
              <Ionicons name={isRTL?"arrow-back":"arrow-forward"} size={24} color={colors.primary}/>
              <AppText variant="caption" weight="semibold">{t("competition.phase1.viewAll")}</AppText>
              <AppText variant="caption" muted>+{followedTotal-MAX_FOLLOWED}</AppText>
            </Pressable>:null}
          </ScrollView>}
      </View>
      <View testID="competitions-quick-access" style={styles.quickSection}>
        <View style={styles.titleCopy}>
          <AppText variant="bodyLarge" weight="bold">{t("competition.phase1.quickAccess")}</AppText>
          <AppText variant="caption" muted>{t("competition.phase1.quickSubtitle")}</AppText>
        </View>
        <View style={[styles.quickGrid,{flexDirection:isRTL?"row-reverse":"row"}]}>
          {shortcuts.map(item=><Pressable key={item.id}
            testID={`competitions-quick-${item.id}`}
            accessibilityRole="button" onPress={()=>router.push(item.to)}
            style={({pressed})=>[styles.shortcut,pressed&&styles.pressed]}>
            <Ionicons name={item.icon} size={21} color={colors.primary}/>
            <AppText variant="caption" weight="semibold" numberOfLines={2}
              style={[styles.accent,{flex:1,textAlign:isRTL?"right":"left"}]}>{item.label}</AppText>
            <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={15} color={colors.primary}/>
          </Pressable>)}
        </View>
        <Pressable testID="competitions-ongoing-followed-button" accessibilityRole="button"
          onPress={()=>router.push("/competitions/ongoing")} style={styles.followedVenues}>
          <Ionicons name="location-outline" size={17} color={colors.primary}/>
          <AppText variant="caption" weight="semibold" style={styles.accent}>
            {t("competition.ongoingFollowedVenues")}
          </AppText>
        </Pressable>
      </View>
      <View testID="competitions-search-panel" style={styles.filters}>
        <View style={styles.titleCopy}>
          <AppText variant="bodyLarge" weight="bold">{t("competition.phase1.find")}</AppText>
          <AppText variant="caption" muted>{t("competition.phase2.searchSubtitle")}</AppText>
        </View>
        <TextField testID="competition-name-search" label={t("competition.phase2.searchLabel")}
          placeholder={t("competition.phase2.searchPlaceholder")} value={query} maxLength={120}
          autoCorrect={false} returnKeyType="search" onFocus={()=>setSuggestionsOpen(true)}
          onChangeText={typing} onSubmitEditing={()=>submit()}/>
        {suggestionsOpen&&suggestions.length>0?<View style={styles.suggestions}>
          {suggestions.map(item=><Pressable key={item.id} accessibilityRole="button"
            onPress={()=>{setQuery(item.name);submit(item.name);}} style={styles.suggestion}>
            <AppText weight="medium" numberOfLines={1}>{item.name}</AppText>
            <AppText variant="caption" muted numberOfLines={1}>{item.venueName} · {item.city}</AppText>
          </Pressable>)}
        </View>:null}
        <DirectoryFilterSelect testID="competition-province-select"
          label={t("competition.phase2.province")} value={province}
          allLabel={t("competition.phase2.allProvinces")}
          options={facets.provinces.map(value=>({value,label:value}))} onSelect={pickProvince}/>
        <DirectoryFilterSelect testID="competition-city-select"
          label={t("competition.phase2.city")} value={city}
          allLabel={t("competition.phase2.allCities")}
          options={facets.cities.map(value=>({value,label:value}))} onSelect={pickCity}/>
        <DirectoryFilterSelect testID="competition-status-select"
          label={t("competition.filterStatus")} value={status}
          allLabel={t("competition.allStatuses")}
          options={(["REGISTRATION_OPEN","REGISTRATION_CLOSED","SCHEDULED","IN_PROGRESS","COMPLETED","ARCHIVED"] as const)
            .map(value=>({value,label:t(`competition.status.${value}` as never)}))} onSelect={pickStatus}/>
        <DirectoryFilterSelect testID="competition-format-select"
          label={t("competition.format")} value={format}
          allLabel={t("competition.phase2.allFormats")}
          options={(["LEAGUE","KNOCKOUT","GROUP_KNOCKOUT"] as const)
            .map(value=>({value,label:t(`competition.format.${value}` as never)}))} onSelect={pickFormat}/>
        <DirectoryFilterSelect testID="competition-fee-select"
          label={t("competition.registrationFee")} value={fee}
          allLabel={t("competition.phase2.anyFee")}
          options={["free","paid"].map(value=>({value,label:t(`competition.phase2.fee.${value}` as never)}))}
          onSelect={pickFee}/>
        <Pressable accessibilityRole="button" testID="competitions-advanced-filters"
          onPress={()=>setAdvanced(x=>!x)}
          style={[styles.advancedToggle,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="options-outline" size={19} color={colors.primary}/>
          <AppText weight="semibold" style={styles.accent}>{t("competition.phase2.advanced")}</AppText>
          <Ionicons name={advanced?"chevron-up":"chevron-down"} size={17} color={colors.primary}/>
        </Pressable>
        {advanced?<View style={styles.advanced}>
          <TextField testID="competition-min-fee" label={t("competition.phase2.minimumFee")}
            placeholder="0" keyboardType="numeric" value={minFee} onChangeText={setMinFee}/>
          <TextField testID="competition-max-fee" label={t("competition.phase2.maximumFee")}
            placeholder="10000" keyboardType="numeric" value={maxFee} onChangeText={setMaxFee}/>
          <TextField testID="competition-start-from" label={t("competition.phase2.startsFrom")}
            placeholder="YYYY-MM-DD" value={from} onChangeText={setFrom} maxLength={10}/>
          <TextField testID="competition-start-to" label={t("competition.phase2.startsTo")}
            placeholder="YYYY-MM-DD" value={to} onChangeText={setTo} maxLength={10}/>
          {filterError?<AppText style={{color:colors.danger}}>{filterError}</AppText>:null}
          <Button label={t("competition.phase2.applyAdvanced")} onPress={applyAdvanced}/>
        </View>:null}
        <Button label={t("competition.search")} onPress={()=>submit()} loading={loading}/>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.sortRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          {(["recommended","starting","popular","newest","closing","feeLow"] as const).map(option=>
            <Pressable key={option} testID={`competition-sort-${option}`}
              accessibilityRole="tab" accessibilityState={{selected:sort===option}}
              onPress={()=>pickSort(option)}
              style={[styles.sortChip,sort===option&&styles.sortActive]}>
              <AppText variant="caption" weight="semibold"
                style={{color:sort===option?"#FFFFFF":colors.primary}}>
                {t(`competition.phase2.sort.${option}` as never)}
              </AppText>
            </Pressable>)}
        </ScrollView>
      </View>
    </>:null}
    <View testID="competitions-results-section" style={styles.resultsSection}>
      <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.titleCopy}>
          <AppText variant="bodyLarge" weight="bold">
            {mode==="directory"?t("competition.phase1.explore"):title}
          </AppText>
          {!loading&&!error?<AppText variant="caption" muted>
            {t("competition.phase1.resultsCount",{count:total})}
          </AppText>:null}
        </View>
        <Pressable testID="competitions-refresh-results" accessibilityRole="button"
          accessibilityLabel={t("competition.phase1.refresh")} disabled={loading}
          onPress={()=>setRetry(n=>n+1)} style={styles.refresh}>
          <Ionicons name="refresh-outline" size={20} color={colors.primary}/>
        </Pressable>
      </View>
      {loading?<DataLoadingState variant="list" minHeight={350}/>:null}
      {error?<Card style={styles.message}>
        <Ionicons name="alert-circle-outline" size={28} color={colors.danger}/>
        <AppText style={{color:colors.danger,textAlign:"center"}}>{error}</AppText>
        <Button label={t("common.retry")} variant="secondary" onPress={()=>setRetry(n=>n+1)}/>
      </Card>:null}
      {!loading&&!error&&total===0?<Card style={styles.message}>
        <Ionicons name="trophy-outline" size={30} color={colors.primary}/>
        <AppText style={{textAlign:"center"}}>{mode==="ongoing"?
          t("competition.noOngoingFollowed"):privateScope&&!token?
          t("competition.phase1.signIn"):t("competition.noMatches")}</AppText>
        {mode==="directory"&&filtersActive?<Button
          label={t("competition.phase1.clearFilters")} variant="secondary" onPress={clearFilters}/>:null}
      </Card>:null}
      {!loading&&!error?<View testID="competitions-results-grid"
        style={[styles.grid,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {items.map(render)}
      </View>:null}
      {!loading&&!error&&hasMore?<View testID="competitions-show-more">
        <Button variant="secondary" label={t("competition.phase1.showMore")}
          loading={loadingMore} disabled={loadingMore}
          onPress={()=>void load(applied.current,currentPage+1,true)}/>
      </View>:null}
    </View>
  </Screen>;
}
const styles=StyleSheet.create({
  page:{paddingTop:spacing.sm,gap:spacing.md},
  row:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  heading:{alignItems:"center",justifyContent:"space-between",gap:spacing.sm},
  titleCopy:{flex:1,minWidth:0,gap:3},
  panel:{gap:spacing.sm,backgroundColor:colors.surface,borderRadius:radius.lg,
    padding:spacing.md,borderWidth:1,borderColor:colors.border},
  headerAction:{flexDirection:"row",alignItems:"center",minHeight:44,gap:spacing.xs},
  accent:{color:colors.primary,flexShrink:1},
  quickSection:{gap:spacing.sm},
  quickGrid:{flexWrap:"wrap",gap:spacing.sm},
  shortcut:{width:"48.5%",minHeight:64,borderRadius:radius.md,
    backgroundColor:colors.primarySoft,borderWidth:1,borderColor:colors.border,
    padding:spacing.sm,flexDirection:"row",alignItems:"center",gap:spacing.xs},
  followedVenues:{minHeight:44,flexDirection:"row",alignItems:"center",gap:spacing.sm,paddingHorizontal:spacing.sm},
  filters:{gap:spacing.sm},
  suggestions:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,overflow:"hidden"},
  suggestion:{minHeight:48,justifyContent:"center",paddingHorizontal:spacing.md,
    borderBottomWidth:1,borderBottomColor:colors.border},
  sortRow:{gap:spacing.sm,paddingVertical:2},
  sortChip:{borderWidth:1,borderColor:colors.primary,borderRadius:radius.pill,
    paddingHorizontal:spacing.md,minHeight:42,alignItems:"center",justifyContent:"center",
    backgroundColor:colors.surface},
  sortActive:{backgroundColor:colors.primary},
  advancedToggle:{alignItems:"center",gap:spacing.sm,minHeight:44,paddingHorizontal:spacing.sm},
  advanced:{gap:spacing.sm},
  resultsSection:{gap:spacing.md},
  grid:{flexWrap:"wrap",alignItems:"stretch",gap:spacing.sm},
  gridItem:{width:"48.5%"},
  result:{width:"100%",gap:spacing.xs},
  message:{alignItems:"center",justifyContent:"center",gap:spacing.md,paddingVertical:spacing.xxl},
  refresh:{width:44,height:44,alignItems:"center",justifyContent:"center",
    backgroundColor:colors.primarySoft,borderRadius:radius.md},
  back:{width:44,height:44,alignItems:"center",justifyContent:"center",
    backgroundColor:colors.primarySoft,borderRadius:22},
  more:{width:148,minHeight:208,backgroundColor:colors.primarySoft,alignItems:"center",
    justifyContent:"center",borderRadius:radius.md,gap:spacing.sm},
  pressed:{opacity:.7},
});
