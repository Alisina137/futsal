import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {TeamDiscoveryItem,TeamDiscoveryQuery,TeamDiscoveryResponse} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useEffect,useRef,useState} from "react";
import {Pressable,ScrollView,StyleSheet,View,useWindowDimensions} from "react-native";
import {teamApi} from "../../lib/api";
import {useAuth} from "../../providers/AuthProvider";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";
import {Screen} from "../ui/Screen";
import {TextField} from "../ui/TextField";
import {SocialDirectoryCard} from "./SocialDirectoryCard";
import {SocialFollowedTile} from "./SocialFollowedTile";
import {DirectoryFilterSelect} from "./DirectoryFilterSelect";

type Mode="directory"|"popular"|"following"|"mine";
const emptyFacets:TeamDiscoveryResponse["facets"]={provinces:[],cities:[],districts:[]};
const defaults:TeamDiscoveryQuery={
  q:"",province:"",city:"",district:"",sort:"recommended",scope:"all",page:1,limit:20,
};
const open=(id:string)=>router.push({pathname:"/teams/[teamId]",params:{teamId:id}});

export function TeamDirectoryExperience({mode}:{mode:Mode}){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const {width:windowWidth}=useWindowDimensions();
  const twoColumns=windowWidth>=720;
  const token=session?.accessToken;
  const [teams,setTeams]=useState<TeamDiscoveryItem[]>([]);
  const [followed,setFollowed]=useState<TeamDiscoveryItem[]>([]);
  const [followedTotal,setFollowedTotal]=useState(0);
  const [facets,setFacets]=useState(emptyFacets);
  const [total,setTotal]=useState(0);
  const [hasMore,setHasMore]=useState(false);
  const [currentPage,setCurrentPage]=useState(1);
  const [loading,setLoading]=useState(true);
  const [loadingMore,setLoadingMore]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [retry,setRetry]=useState(0);
  const [joiningId,setJoiningId]=useState<string|null>(null);
  const [province,setProvince]=useState("");
  const [city,setCity]=useState("");
  const [district,setDistrict]=useState("");
  const [sort,setSort]=useState<TeamDiscoveryQuery["sort"]>("recommended");
  const [query,setQuery]=useState("");
  const [search,setSearch]=useState("");
  const [suggestions,setSuggestions]=useState<TeamDiscoveryItem[]>([]);
  const [suggestionsOpen,setSuggestionsOpen]=useState(false);
  const applied=useRef<TeamDiscoveryQuery>({...defaults});
  const requestId=useRef(0);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const modeScope=mode==="popular"?"popular":mode==="following"?"following":
    mode==="mine"?"mine":"all";
  function clearTimer(){
    if(timer.current!==null){clearTimeout(timer.current);timer.current=null;}
  }

  const load=useCallback(async(filters:TeamDiscoveryQuery,page=1,append=false)=>{
    if(!token){setLoading(false);setTeams([]);return;}
    const id=++requestId.current;
    if(append)setLoadingMore(true);
    else{setLoading(true);setError(null);}
    try{
      const result=await teamApi.discover(token,{...filters,scope:modeScope,page});
      if(requestId.current!==id)return;
      setTeams(previous=>append?[...previous.filter(team=>
        !result.teams.some(next=>next.id===team.id)),...result.teams]:result.teams);
      setTotal(result.total);setHasMore(result.hasMore);setCurrentPage(page);
      setFacets(result.facets);
    }catch{
      if(requestId.current===id)setError(t("teams.directoryLoadError"));
    }finally{
      if(requestId.current===id){setLoading(false);setLoadingMore(false);}
    }
  },[token,modeScope,t]);

  const loadFollowed=useCallback(async()=>{
    if(!token){setFollowed([]);setFollowedTotal(0);return;}
    try{
      const response=await teamApi.discover(token,{...defaults,scope:"following",limit:11});
      setFollowed(response.teams);setFollowedTotal(response.total);
    }catch{
      // Keep the directory usable even if the followed-teams rail fails.
      setFollowed([]);setFollowedTotal(0);
    }
  },[token]);

  useFocusEffect(useCallback(()=>{
    const activeFilters=applied.current;
    void load(activeFilters,1);
    if(mode==="directory")void loadFollowed();
    return()=>{clearTimer();++requestId.current;};
  },[load,loadFollowed,mode,retry]));

  useEffect(()=>()=>{
    clearTimer();
    ++requestId.current;
  },[]);

  // Suggestions are also server filtered; their 300 ms debounce is separate
  // from the 2-second results debounce and stale suggestions are ignored.
  useEffect(()=>{
    if(mode!=="directory"||!token||!suggestionsOpen||!query.trim()){
      setSuggestions([]);return;
    }
    let active=true;
    const work=setTimeout(()=>{
      const filters={...applied.current,q:query.trim(),page:1,limit:8,scope:"all" as const};
      void teamApi.discover(token,filters).then(response=>{
        if(active)setSuggestions(response.teams);
      }).catch(()=>{if(active)setSuggestions([]);});
    },300);
    return()=>{active=false;clearTimeout(work);};
  },[mode,token,query,province,city,district,suggestionsOpen]);

  function apply(next:TeamDiscoveryQuery){
    clearTimer();setSuggestionsOpen(false);setSuggestions([]);
    applied.current={...next,scope:"all",page:1};
    setSearch(next.q);
    void load(applied.current,1);
  }
  function submit(value=query){
    apply({...applied.current,q:value.trim()});
  }
  function typing(text:string){
    setQuery(text);setSuggestionsOpen(true);setSuggestions([]);
    clearTimer();
    // Old results cannot overwrite a newer input while the debounce runs.
    ++requestId.current;setLoading(false);setError(null);
    timer.current=setTimeout(()=>{
      timer.current=null;submit(text);
    },2000);
  }
  function provinceSelected(value:string){
    setProvince(value);setCity("");setDistrict("");
    apply({...applied.current,province:value,city:"",district:"",q:query.trim()});
  }
  function citySelected(value:string){
    setCity(value);setDistrict("");
    apply({...applied.current,city:value,district:"",q:query.trim()});
  }
  function districtSelected(value:string){
    setDistrict(value);
    apply({...applied.current,district:value,q:query.trim()});
  }
  function sortSelected(value:TeamDiscoveryQuery["sort"]){
    setSort(value);
    apply({...applied.current,sort:value,q:query.trim()});
  }
  function clearFilters(){
    setProvince("");setCity("");setDistrict("");setSort("recommended");setQuery("");
    apply({...defaults});
  }
  async function join(id:string){
    if(!token||joiningId)return;
    setJoiningId(id);setError(null);
    try{
      await teamApi.requestJoin(token,id);
      setTeams(list=>list.map(x=>x.id===id?{...x,joinRequestStatus:"PENDING"}:x));
      setFollowed(list=>list.map(x=>x.id===id?{...x,joinRequestStatus:"PENDING"}:x));
    }catch{setError(t("teams.joinRequestError"));}
    finally{setJoiningId(null);}
  }
  function action(team:TeamDiscoveryItem){
    return team.myMembershipRole?{
      label:t("teams.alreadyMemberSelf"),disabled:true,
      status:t(`teams.role.${team.myMembershipRole}` as never),
      tone:"success" as const,
    }:team.joinRequestStatus==="PENDING"?{
      label:t("teams.joinRequestPending"),disabled:true,
      status:t("teams.joinRequestPending"),tone:"warning" as const,
    }:!team.allowJoinRequests?{
      label:t("teams.invitationOnly"),disabled:true,
      status:t("teams.invitationOnly"),tone:"muted" as const,
    }:{
      label:t("teams.requestToJoin"),disabled:false,
      status:null,tone:"muted" as const,
    };
  }
  function render(team:TeamDiscoveryItem,index:number){
    const a=action(team);
    return <View key={team.id} style={[styles.item,twoColumns&&styles.itemGrid]}>
      {mode==="popular"?<AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
        #{(currentPage-1)*applied.current.limit+index+1} · {t("social.followers",{count:team.followerCount})}
      </AppText>:null}
      <SocialDirectoryCard id={team.id} name={team.name} kind="TEAM" imageUrl={team.logoUrl}
        detail={[team.city,team.district,team.province].filter(Boolean).join(" · ")}
        badge={t("teams.members",{count:team.rosterCount})}
        statusLabel={a.status??""} statusTone={a.tone}
        detailsLabel={t("teams.viewTeam")} actionLabel={a.label}
        actionDisabled={a.disabled||!token||joiningId!==null} busy={joiningId===team.id}
        onDetails={()=>open(team.id)} onAction={()=>void join(team.id)}/>
    </View>;
  }
  const title=mode==="popular"?t("teams.mostFollowed"):mode==="mine"?t("teams.myTeams")
    :mode==="following"?t("teams.followedTeams"):t("teams.title");
  return <Screen showHeader publicNav style={styles.page}>
    {mode!=="directory"?<View style={[styles.row,{alignItems:"center",flexDirection:isRTL?"row-reverse":"row"}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("teams.backToTeams")}
        onPress={()=>router.navigate("/teams")} style={styles.back}>
        <Ionicons name={isRTL?"arrow-forward":"arrow-back"} size={21} color={colors.primary}/>
      </Pressable>
      <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>{title}</AppText>
    </View>:null}
    {mode==="directory"?<>
      <View testID="teams-followed-strip" style={styles.panel}>
        <View style={[styles.sectionHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.titleCopy}>
            <AppText variant="bodyLarge" weight="bold">{t("teams.followedTeams")}</AppText>
            <AppText variant="caption" muted>{t("teams.phase1.followedSubtitle")}</AppText>
          </View>
          {followedTotal>0?<Pressable accessibilityRole="button"
            accessibilityLabel={t("teams.phase1.viewFollowing")} testID="teams-followed-all"
            onPress={()=>router.push("/teams/following")} style={styles.headerAction}>
            <AppText variant="caption" weight="semibold" style={styles.accent}>
              {t("teams.phase1.viewFollowing")}
            </AppText>
            <Ionicons name={isRTL?"arrow-back":"arrow-forward"} size={17} color={colors.primary}/>
          </Pressable>:null}
        </View>
        {loading?<DataLoadingState variant="list" minHeight={120}/>:followed.length===0?
          <AppText variant="caption" muted>{t("teams.followedEmpty")}</AppText>:
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            testID="teams-followed-carousel"
            contentContainerStyle={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
            {followed.slice(0,10).map(team=>{
              const a=action(team);
              return <SocialFollowedTile key={team.id} id={team.id} name={team.name}
                imageUrl={team.logoUrl} kind="TEAM" detailsLabel={t("teams.viewTeam")}
                memberCountLabel={t("teams.members",{count:team.rosterCount})}
                actionLabel={a.label} actionDisabled={a.disabled||joiningId!==null}
                busy={joiningId===team.id} onDetails={()=>open(team.id)} onAction={()=>void join(team.id)}/>;
            })}
            {followedTotal>10?<Pressable testID="teams-followed-more" accessibilityRole="button"
              onPress={()=>router.push("/teams/following")} style={styles.more}>
              <Ionicons name={isRTL?"arrow-back":"arrow-forward"} size={24} color={colors.primary}/>
              <AppText variant="caption" weight="semibold">{t("booking.followedShowMore")}</AppText>
              <AppText variant="caption" muted>+{followedTotal-10}</AppText>
            </Pressable>:null}
          </ScrollView>}
      </View>
      <View testID="teams-quick-access" style={styles.quickSection}>
        <View style={styles.titleCopy}>
          <AppText variant="bodyLarge" weight="bold">{t("teams.phase1.quickAccess")}</AppText>
          <AppText variant="caption" muted>{t("teams.phase1.quickSubtitle")}</AppText>
        </View>
        <View style={[styles.quickRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Pressable testID="teams-most-followed-button" accessibilityRole="button"
            onPress={()=>router.push("/teams/popular")} style={styles.shortcut}>
            <Ionicons name="trending-up-outline" size={19} color={colors.primary}/>
            <AppText variant="caption" weight="semibold" numberOfLines={2} style={styles.accent}>
              {t("teams.mostFollowed")}
            </AppText>
          </Pressable>
          <Pressable testID="teams-my-teams-button" accessibilityRole="button"
            onPress={()=>router.push("/teams/my")} style={styles.shortcut}>
            <Ionicons name="people-circle-outline" size={19} color={colors.primary}/>
            <AppText variant="caption" weight="semibold" numberOfLines={2} style={styles.accent}>
              {t("teams.myTeams")}
            </AppText>
          </Pressable>
          <Pressable testID="teams-invitations-shortcut" accessibilityRole="button"
            onPress={()=>router.push("/teams/invitations")} style={styles.shortcut}>
            <Ionicons name="mail-unread-outline" size={19} color={colors.primary}/>
            <AppText variant="caption" weight="semibold" numberOfLines={2} style={styles.accent}>
              {t("teams.invitationsTitle")}
            </AppText>
          </Pressable>
        </View>
      </View>
      <View testID="teams-search-panel" style={styles.filters}>
        <View style={styles.titleCopy}>
          <AppText variant="bodyLarge" weight="bold">{t("teams.phase1.findTeams")}</AppText>
          <AppText variant="caption" muted>{t("teams.phase1.searchSubtitle")}</AppText>
        </View>
        <DirectoryFilterSelect testID="teams-province-select" label={t("teams.phase2.province")}
          value={province} allLabel={t("teams.phase2.allProvinces")}
          options={facets.provinces.map(name=>({value:name,label:name}))}
          onSelect={provinceSelected}/>
        <DirectoryFilterSelect testID="teams-city-select" label={t("teams.filterCity")}
          value={city} allLabel={t("teams.allCities")}
          options={facets.cities.map(name=>({value:name,label:name}))} onSelect={citySelected}/>
        <DirectoryFilterSelect testID="teams-district-select" label={t("teams.phase2.district")}
          value={district} allLabel={t("teams.phase2.allDistricts")}
          options={facets.districts.map(name=>({value:name,label:name}))}
          onSelect={districtSelected}/>
        <TextField testID="teams-name-search" label={t("teams.searchName")}
          placeholder={t("teams.searchPlaceholder")} value={query} maxLength={120}
          returnKeyType="search" onFocus={()=>setSuggestionsOpen(true)}
          onChangeText={typing}
          onSubmitEditing={()=>submit()}/>
        {suggestionsOpen&&suggestions.length>0?<View style={styles.suggestions}>
          {suggestions.map(item=><Pressable key={item.id} accessibilityRole="button"
            onPress={()=>{setQuery(item.name);submit(item.name);}} style={styles.suggestion}>
            <AppText numberOfLines={1}>{item.name}</AppText>
            <AppText muted variant="caption" numberOfLines={1}>{item.city}</AppText>
          </Pressable>)}
        </View>:null}
        <Button label={t("teams.search")} onPress={()=>submit()} loading={loading}/>
        <View style={{gap:spacing.xs}}>
          <AppText weight="semibold">{t("teams.phase2.sortBy")}</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.sortRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
            {(["recommended","mostFollowed","mostMembers","newest","alphabetical"] as const)
              .map(value=><Pressable key={value} testID={`teams-sort-${value}`}
                accessibilityRole="tab" accessibilityState={{selected:sort===value}}
                onPress={()=>sortSelected(value)}
                style={[styles.sortChip,sort===value&&styles.sortSelected]}>
                <AppText variant="caption" weight="semibold"
                  style={{color:sort===value?"#FFFFFF":colors.primary}}>
                  {t(`teams.phase2.sort.${value}` as never)}
                </AppText>
              </Pressable>)}
          </ScrollView>
        </View>
      </View>
      {session?.user.roles.includes("TEAM_MANAGER")?<View style={styles.managerShortcut}>
        <AppText variant="caption" muted style={{flex:1}}>{t("teams.phase1.managerHint")}</AppText>
        <Button label={t("teams.create")} variant="secondary"
          onPress={()=>router.push("/teams/create")}/>
      </View>:null}
    </>:null}
    <View testID="teams-results-section" style={styles.resultsSection}>
      <View style={[styles.sectionHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.titleCopy}>
          <AppText variant="bodyLarge" weight="bold">{mode==="directory"?
            t("teams.phase1.exploreTeams"):title}</AppText>
          {!loading&&!error?<AppText variant="caption" muted>
            {t("teams.phase1.resultsCount",{count:total})}
          </AppText>:<AppText variant="caption" muted>{t("teams.phase1.browseSubtitle")}</AppText>}
        </View>
        <Pressable testID="teams-refresh-results" accessibilityRole="button"
          accessibilityLabel={t("teams.phase1.refresh")} disabled={loading}
          onPress={()=>setRetry(v=>v+1)}
          style={({pressed})=>[styles.refresh,pressed&&styles.pressed]}>
          <Ionicons name="refresh-outline" size={20} color={colors.primary}/>
        </Pressable>
      </View>
      {loading?<DataLoadingState variant="list" minHeight={330}/>:null}
      {error?<Card style={styles.message}>
        <Ionicons name="alert-circle-outline" size={25} color={colors.danger}/>
        <AppText style={{color:colors.danger,textAlign:"center"}}>{error}</AppText>
        <Button label={t("common.retry")} onPress={()=>setRetry(n=>n+1)}
          variant="secondary"/>
      </Card>:null}
      {!loading&&!error&&teams.length===0?<Card style={styles.message}>
        <Ionicons name="people-outline" size={30} color={colors.primary}/>
        <AppText weight="medium" style={{textAlign:"center"}}>{t("teams.noMatches")}</AppText>
        {mode==="directory"&&(province||city||district||search||sort!=="recommended")?<Button
          label={t("teams.phase1.clearFilters")} variant="secondary"
          onPress={clearFilters}/>:null}
      </Card>:null}
      {!loading&&!error?<View testID="teams-results-grid" style={[styles.resultsGrid,{
        flexDirection:isRTL?"row-reverse":"row",
      }]}>{teams.map(render)}</View>:null}
      {!loading&&!error&&hasMore?<View testID="teams-load-more">
        <Button label={t("teams.phase2.showMore")} variant="secondary"
          disabled={loadingMore} loading={loadingMore}
          onPress={()=>void load(applied.current,currentPage+1,true)}/>
      </View>:null}
    </View>
  </Screen>;
}
const styles=StyleSheet.create({
  page:{paddingTop:spacing.sm,gap:spacing.md},
  row:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  panel:{gap:spacing.sm,backgroundColor:colors.surface,borderRadius:radius.lg,padding:spacing.md,
    borderWidth:1,borderColor:colors.border},
  sectionHeading:{alignItems:"center",gap:spacing.sm,justifyContent:"space-between"},
  titleCopy:{flex:1,minWidth:0,gap:2},
  headerAction:{flexDirection:"row",gap:spacing.xs,alignItems:"center",
    minHeight:44,paddingHorizontal:spacing.sm},
  quickSection:{gap:spacing.sm},
  quickRow:{gap:spacing.sm,alignItems:"stretch"},
  resultsSection:{gap:spacing.md},
  resultsGrid:{flexWrap:"wrap",gap:spacing.sm,alignItems:"stretch"},
  sortRow:{gap:spacing.sm,paddingVertical:2},
  sortChip:{borderWidth:1,borderColor:colors.primary,borderRadius:radius.pill,
    paddingHorizontal:spacing.md,minHeight:42,alignItems:"center",justifyContent:"center",
    backgroundColor:colors.surface},
  sortSelected:{backgroundColor:colors.primary},
  refresh:{height:44,width:44,alignItems:"center",justifyContent:"center",
    borderWidth:1,borderColor:colors.border,borderRadius:radius.md,
    backgroundColor:colors.surface},
  message:{gap:spacing.md,alignItems:"center",padding:spacing.lg},
  managerShortcut:{flexDirection:"row",alignItems:"center",gap:spacing.sm,
    borderRadius:radius.md,borderColor:colors.border,borderWidth:1,
    padding:spacing.sm,backgroundColor:colors.surface},
  shortcut:{flex:1,minWidth:0,minHeight:66,borderRadius:radius.md,
    paddingHorizontal:4,paddingVertical:spacing.sm,gap:4,
    backgroundColor:colors.primarySoft,borderColor:colors.primary,borderWidth:1,
    flexDirection:"column",alignItems:"center",justifyContent:"center"},
  accent:{color:colors.primary,textAlign:"center",flexShrink:1},
  more:{width:148,minHeight:208,backgroundColor:colors.primarySoft,alignItems:"center",
    justifyContent:"center",borderRadius:radius.md,gap:spacing.sm},
  filters:{gap:spacing.sm,backgroundColor:colors.surface,borderWidth:1,
    borderColor:colors.border,borderRadius:radius.lg,padding:spacing.md},
  suggestions:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,overflow:"hidden"},
  suggestion:{minHeight:52,justifyContent:"center",paddingHorizontal:spacing.md,
    borderBottomWidth:1,borderBottomColor:colors.border,gap:3},
  item:{gap:spacing.sm,width:"100%"},
  itemGrid:{width:"48.5%"},
  pressed:{opacity:.75},
  back:{width:44,height:44,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft,borderRadius:22},
});
