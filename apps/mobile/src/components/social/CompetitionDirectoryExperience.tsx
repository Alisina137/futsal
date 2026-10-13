import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {CompetitionListItemDto,SocialDirectoryDiscoveryResponse} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useMemo,useState} from "react";
import {Pressable,ScrollView,StyleSheet,View,useWindowDimensions} from "react-native";
import {competitionApi,marketingApi} from "../../lib/api";
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
type Sort="recommended"|"starting"|"popular";
const empty:SocialDirectoryDiscoveryResponse={entityType:"COMPETITION",counts:[],followedIds:[]};
const open=(id:string)=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId:id}});
const action=(item:CompetitionListItemDto,t:(key:any)=>string,canRegister:boolean)=>{
  if(item.status==="REGISTRATION_OPEN"&&canRegister)return {
    label:t("competition.register"),to:()=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId:item.id,tab:"TEAMS",focusRegistration:"1"}})};
  if(item.status==="REGISTRATION_OPEN")return{
    label:t("competition.phase1.viewRegistration"),to:()=>open(item.id)};
  if(item.status==="IN_PROGRESS")return {
    label:t("competition.standings"),to:()=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId:item.id,tab:"STANDINGS"}})};
  if(item.status==="COMPLETED")return {
    label:t("competition.phase1.results"),to:()=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId:item.id,tab:"RESULTS"}})};
  if(item.status==="SCHEDULED")return {
    label:t("competition.phase1.fixtures"),to:()=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId:item.id,tab:"MATCHES"}})};
  return {label:t("competition.viewCompetition"),to:()=>open(item.id)};
};
const MAX_FOLLOWED=10;
const INITIAL_VISIBLE=12;

export function CompetitionDirectoryExperience({mode}:{mode:Mode}){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const {width}=useWindowDimensions();
  const twoColumns=width>=720;
  const canRegister=Boolean(session?.user.roles.includes("TEAM_MANAGER"));
  const [items,setItems]=useState<CompetitionListItemDto[]>([]);
  const [meta,setMeta]=useState(empty);
  const [followedVenueIds,setFollowedVenueIds]=useState<string[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [retry,setRetry]=useState(0);
  const [query,setQuery]=useState("");
  const [search,setSearch]=useState("");
  const [suggestionsOpen,setSuggestionsOpen]=useState(false);
  const [status,setStatus]=useState("");
  const [sort,setSort]=useState<Sort>("recommended");
  const [visibleCount,setVisibleCount]=useState(INITIAL_VISIBLE);

  useFocusEffect(useCallback(()=>{
    let active=true;
    setError(null);setLoading(true);
    const token=session?.accessToken;
    void Promise.all([
      mode==="mine"
        ?token?competitionApi.mine(token):Promise.resolve({competitions:[] as CompetitionListItemDto[]})
        :competitionApi.list(),
      token?marketingApi.socialDirectoryDiscovery(token,"COMPETITION"):Promise.resolve(empty),
      token?marketingApi.followedVenues(token):Promise.resolve({venues:[]}),
    ]).then(([result,discovery,follows])=>{
      if(active){
        setItems(result.competitions);setMeta(discovery);
        setFollowedVenueIds(follows.venues.map(venue=>venue.id));
      }
    }).catch(()=>{if(active)setError(t("competition.loadError"));})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[session?.accessToken,mode,retry,t]));

  const byId=useMemo(()=>new Map(items.map(item=>[item.id,item])),[items]);
  const counts=useMemo(()=>new Map(meta.counts.map(x=>[x.id,x.count])),[meta.counts]);
  // Followed rail may contain only currently published competitions.
  const followed=meta.followedIds.map(id=>byId.get(id))
    .filter((x):x is CompetitionListItemDto=>Boolean(x));
  const statusOptions=[...new Set(items.map(x=>x.status))].sort();
  const results=useMemo(()=>{
    let result=mode==="popular"
      ?[...items].sort((a,b)=>(counts.get(b.id)??0)-(counts.get(a.id)??0)
        ||a.name.localeCompare(b.name))
      :mode==="following"?followed
      :mode==="ongoing"?items.filter(x=>x.status==="IN_PROGRESS"&&followedVenueIds.includes(x.venueId))
        .sort((a,b)=>(b.startsAt??"").localeCompare(a.startsAt??"")||a.name.localeCompare(b.name)).slice(0,10)
      :mode==="registration"?items.filter(x=>x.status==="REGISTRATION_OPEN")
      :mode==="live"?items.filter(x=>x.status==="IN_PROGRESS")
      :items;
    if(mode==="directory")result=result.filter(x=>(!status||x.status===status)
      &&(!search||x.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
    if(mode==="directory"){
      if(sort==="popular")result=[...result].sort((a,b)=>(counts.get(b.id)??0)-(counts.get(a.id)??0)
        ||a.name.localeCompare(b.name));
      if(sort==="starting")result=[...result].sort((a,b)=>
        (a.startsAt??"9999").localeCompare(b.startsAt??"9999")||a.name.localeCompare(b.name));
    }
    return result;
  },[items,mode,counts,followedVenueIds,meta.followedIds,status,search,sort]);
  const suggestions=query.trim()?items.filter(x=>(!status||x.status===status)
    &&x.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0,8):[];
  const applyStatus=(value:string)=>{setStatus(value);setVisibleCount(INITIAL_VISIBLE);};
  function submit(value=query){setSearch(value.trim());setSuggestionsOpen(false);setVisibleCount(INITIAL_VISIBLE);}
  function reset(){
    setQuery("");setSearch("");setStatus("");setSort("recommended");
    setSuggestionsOpen(false);setVisibleCount(INITIAL_VISIBLE);
  }
  const filtersActive=Boolean(search||status||sort!=="recommended");
  const resultCount=results.length;
  const visible=results.slice(0,mode==="ongoing"?10:visibleCount);
  function render(item:CompetitionListItemDto,index:number){
    const next=action(item,t,canRegister);
    return <View key={item.id} style={[styles.result,twoColumns&&styles.gridItem]}>
      {mode==="popular"?<AppText variant="caption" weight="semibold" style={styles.accent}>
        #{index+1} · {t("social.followers",{count:counts.get(item.id)??0})}
      </AppText>:null}
      <CompetitionDirectoryCard competition={item}
        detailsLabel={t("competition.viewCompetition")}
        actionLabel={next.label} onDetails={()=>open(item.id)} onAction={next.to}/>
    </View>;
  }
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
  return <Screen showHeader publicNav style={styles.page}>
    {mode!=="directory"?<View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("competition.backToCompetitions")}
        onPress={()=>router.navigate("/competitions")} style={styles.back}>
        <Ionicons name={isRTL?"arrow-forward":"arrow-back"} size={21} color={colors.primary}/>
      </Pressable>
      <AppText weight="bold" variant="bodyLarge" style={{flex:1}}>{title}</AppText>
    </View>:null}
    {mode==="directory"?<>
      <View testID="competitions-followed-strip" style={styles.panel}>
        <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.titleCopy}>
            <AppText variant="bodyLarge" weight="bold">{t("competition.followedCompetitions")}</AppText>
            <AppText variant="caption" muted>{t("competition.phase1.followedSubtitle")}</AppText>
          </View>
          {followed.length>0?<Pressable accessibilityRole="button"
            testID="competitions-followed-all" onPress={()=>router.push("/competitions/following")}
            style={styles.headerAction}>
            <AppText variant="caption" weight="semibold" style={styles.accent}>
              {t("competition.phase1.viewAll")}
            </AppText>
            <Ionicons name={isRTL?"arrow-back":"arrow-forward"} size={17} color={colors.primary}/>
          </Pressable>:null}
        </View>
        {loading?<DataLoadingState variant="list" minHeight={120}/>:followed.length===0?
          <AppText muted variant="caption">{t("competition.followedEmpty")}</AppText>:
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
            {followed.length>MAX_FOLLOWED?<Pressable testID="competitions-followed-more"
              accessibilityRole="button" onPress={()=>router.push("/competitions/following")} style={styles.more}>
              <Ionicons name={isRTL?"arrow-back":"arrow-forward"} size={24} color={colors.primary}/>
              <AppText variant="caption" weight="semibold">{t("competition.phase1.viewAll")}</AppText>
              <AppText variant="caption" muted>+{followed.length-MAX_FOLLOWED}</AppText>
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
        <Pressable testID="competitions-most-followed-button" accessibilityRole="button"
          onPress={()=>router.push("/competitions/popular")} style={styles.hiddenShortcut}>
          <AppText>{t("competition.mostFollowed")}</AppText>
        </Pressable>
      </View>
      <View testID="competitions-search-panel" style={styles.filters}>
        <View style={styles.titleCopy}>
          <AppText variant="bodyLarge" weight="bold">{t("competition.phase1.find")}</AppText>
          <AppText variant="caption" muted>{t("competition.phase1.findSubtitle")}</AppText>
        </View>
        <DirectoryFilterSelect testID="competition-status-select" label={t("competition.filterStatus")}
          value={status} allLabel={t("competition.allStatuses")}
          options={statusOptions.map(option=>({value:option,label:t(`competition.status.${option}` as never)}))}
          onSelect={applyStatus}/>
        <TextField testID="competition-name-search" label={t("competition.searchName")}
          placeholder={t("competition.searchPlaceholder")} value={query} maxLength={120}
          autoCorrect={false} returnKeyType="search" onFocus={()=>setSuggestionsOpen(true)}
          onChangeText={text=>{setQuery(text);setSuggestionsOpen(true);}}
          onSubmitEditing={()=>submit()}/>
        {suggestionsOpen&&suggestions.length>0?<View style={styles.suggestions}>
          {suggestions.map(item=><Pressable key={item.id} accessibilityRole="button"
            onPress={()=>{setQuery(item.name);submit(item.name);}}
            style={styles.suggestion}>
            <AppText weight="medium" numberOfLines={1}>{item.name}</AppText>
            <AppText variant="caption" muted numberOfLines={1}>{item.venueName}</AppText>
          </Pressable>)}
        </View>:null}
        <Button label={t("competition.search")} onPress={()=>submit()} loading={loading}/>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.sortRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          {(["recommended","starting","popular"] as const).map(option=>
            <Pressable key={option} testID={`competition-sort-${option}`}
              accessibilityRole="tab" accessibilityState={{selected:sort===option}}
              onPress={()=>{setSort(option);setVisibleCount(INITIAL_VISIBLE);}}
              style={[styles.sortChip,sort===option&&styles.sortActive]}>
              <AppText variant="caption" weight="semibold"
                style={{color:sort===option?"#FFFFFF":colors.primary}}>
                {t(`competition.phase1.sort.${option}` as never)}
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
            {t("competition.phase1.resultsCount",{count:resultCount})}
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
      {!loading&&!error&&resultCount===0?<Card style={styles.message}>
        <Ionicons name="trophy-outline" size={30} color={colors.primary}/>
        <AppText style={{textAlign:"center"}}>{mode==="ongoing"?
          t("competition.noOngoingFollowed"):mode==="mine"&&!session?
          t("competition.phase1.signIn"):t("competition.noMatches")}</AppText>
        {mode==="directory"&&filtersActive?<Button
          label={t("competition.phase1.clearFilters")} variant="secondary" onPress={reset}/>:null}
      </Card>:null}
      {!loading&&!error?<View testID="competitions-results-grid" style={[styles.grid,
        {flexDirection:isRTL?"row-reverse":"row"}]}>{visible.map(render)}</View>:null}
      {!loading&&!error&&resultCount>visible.length?<Button
        testID="competitions-show-more" variant="secondary"
        label={t("competition.phase1.showMore")}
        onPress={()=>setVisibleCount(n=>n+INITIAL_VISIBLE)}/>:null}
    </View>
  </Screen>;
}
const styles=StyleSheet.create({
  page:{paddingTop:spacing.sm,gap:spacing.md},
  row:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  heading:{alignItems:"center",justifyContent:"space-between",gap:spacing.sm},
  titleCopy:{flex:1,minWidth:0,gap:3},
  panel:{gap:spacing.sm,backgroundColor:colors.surface,borderRadius:radius.lg,padding:spacing.md,
    borderWidth:1,borderColor:colors.border},
  headerAction:{flexDirection:"row",alignItems:"center",minHeight:44,gap:spacing.xs},
  accent:{color:colors.primary,flexShrink:1},
  quickSection:{gap:spacing.sm},
  quickGrid:{flexWrap:"wrap",gap:spacing.sm},
  shortcut:{width:"48.5%",minHeight:64,borderRadius:radius.md,
    backgroundColor:colors.primarySoft,borderWidth:1,borderColor:colors.border,
    padding:spacing.sm,flexDirection:"row",alignItems:"center",gap:spacing.xs},
  followedVenues:{minHeight:44,flexDirection:"row",alignItems:"center",gap:spacing.sm,
    paddingHorizontal:spacing.sm},
  hiddenShortcut:{display:"none"},
  filters:{gap:spacing.sm},
  suggestions:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,overflow:"hidden"},
  suggestion:{minHeight:48,justifyContent:"center",paddingHorizontal:spacing.md,
    borderBottomWidth:1,borderBottomColor:colors.border},
  sortRow:{gap:spacing.sm,paddingVertical:2},
  sortChip:{borderWidth:1,borderColor:colors.primary,borderRadius:radius.pill,
    paddingHorizontal:spacing.md,minHeight:42,alignItems:"center",justifyContent:"center",
    backgroundColor:colors.surface},
  sortActive:{backgroundColor:colors.primary},
  resultsSection:{gap:spacing.md},
  grid:{flexWrap:"wrap",alignItems:"stretch",gap:spacing.sm},
  gridItem:{width:"48.5%"},
  result:{width:"100%",gap:spacing.xs},
  message:{alignItems:"center",justifyContent:"center",gap:spacing.md,paddingVertical:spacing.xxl},
  refresh:{width:44,height:44,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft,
    borderRadius:radius.md},
  back:{width:44,height:44,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft,borderRadius:22},
  more:{width:148,minHeight:208,backgroundColor:colors.primarySoft,alignItems:"center",
    justifyContent:"center",borderRadius:radius.md,gap:spacing.sm},
  pressed:{opacity:.7},
});
