import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {CompetitionListItemDto,SocialDirectoryDiscoveryResponse} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useMemo,useState} from "react";
import {Pressable,ScrollView,StyleSheet,View} from "react-native";
import {competitionApi,marketingApi} from "../../lib/api";
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

type Mode="directory"|"following"|"popular"|"ongoing";
const empty:SocialDirectoryDiscoveryResponse={entityType:"COMPETITION",counts:[],followedIds:[]};
const open=(id:string)=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId:id}});
const action=(item:CompetitionListItemDto,t:(key:any)=>string)=>{
  if(item.status==="REGISTRATION_OPEN")return {
    label:t("competition.register"),to:()=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId:item.id,tab:"TEAMS",focusRegistration:"1"}})};
  if(item.status==="IN_PROGRESS"||item.status==="COMPLETED")return {
    label:t("competition.standings"),to:()=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId:item.id,tab:"STANDINGS"}})};
  return {label:t("competition.viewCompetition"),to:()=>open(item.id)};
};

export function CompetitionDirectoryExperience({mode}:{mode:Mode}){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
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

  useFocusEffect(useCallback(()=>{
    let active=true;
    setError(null);setLoading(true);
    const token=session?.accessToken;
    void Promise.all([
      competitionApi.list(),
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
  },[session?.accessToken,retry,t]));

  const byId=useMemo(()=>new Map(items.map(item=>[item.id,item])),[items]);
  const counts=useMemo(()=>new Map(meta.counts.map(x=>[x.id,x.count])),[meta.counts]);
  const followed=meta.followedIds.map(id=>byId.get(id))
    .filter((x):x is CompetitionListItemDto=>Boolean(x));
  const statusOptions=[...new Set(items.map(x=>x.status))].sort();
  const results=mode==="popular"
    ?[...items].sort((a,b)=>(counts.get(b.id)??0)-(counts.get(a.id)??0)
      ||a.name.localeCompare(b.name)).slice(0,15)
    :mode==="following"?followed
    :mode==="ongoing"?items.filter(x=>x.status==="IN_PROGRESS"&&followedVenueIds.includes(x.venueId))
      .sort((a,b)=>(b.startsAt??"").localeCompare(a.startsAt??"")||a.name.localeCompare(b.name)).slice(0,10)
    :items.filter(x=>(!status||x.status===status)
      &&(!search||x.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  const suggestions=query.trim()?items.filter(x=>(!status||x.status===status)
    &&x.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0,8):[];
  function submit(value=query){setSearch(value.trim());setSuggestionsOpen(false);}
  function render(item:CompetitionListItemDto,index:number){
    const next=action(item,t);
    return <View key={item.id} style={styles.result}>
      {mode==="popular"?<AppText variant="caption" weight="semibold" style={styles.accent}>
        #{index+1} · {t("social.followers",{count:counts.get(item.id)??0})}
      </AppText>:null}
      <SocialDirectoryCard id={item.id} name={item.name} imageUrl={null}
        detail={item.venueName} badge={t(`competition.status.${item.status}` as never)}
        kind="COMPETITION" detailsLabel={t("competition.viewCompetition")}
        actionLabel={next.label} onDetails={()=>open(item.id)} onAction={next.to}/>
    </View>;
  }
  const title=mode==="popular"?t("competition.mostFollowed")
    :mode==="ongoing"?t("competition.ongoingFollowedVenues")
    :mode==="following"?t("competition.followedCompetitions"):t("competition.title");
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
        <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="heart-circle-outline" size={21} color={colors.primary}/>
          <AppText weight="bold" style={{flex:1}}>{t("competition.followedCompetitions")}</AppText>
        </View>
        {loading?<DataLoadingState variant="list" minHeight={120}/>:followed.length===0?
          <AppText muted variant="caption">{t("competition.followedEmpty")}</AppText>:
          <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="competitions-followed-carousel"
            contentContainerStyle={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
            {followed.slice(0,10).map(item=>{
              const next=action(item,t);
              return <SocialFollowedTile key={item.id} id={item.id} name={item.name} imageUrl={null}
                kind="COMPETITION" detailsLabel={t("competition.viewCompetition")}
                actionLabel={next.label} onDetails={()=>open(item.id)} onAction={next.to}/>;
            })}
            {followed.length>10?<Pressable testID="competitions-followed-more" accessibilityRole="button"
              onPress={()=>router.push("/competitions/following")} style={styles.more}>
              <Ionicons name={isRTL?"arrow-back":"arrow-forward"} size={24} color={colors.primary}/>
              <AppText variant="caption" weight="semibold">{t("booking.followedShowMore")}</AppText>
              <AppText variant="caption" muted>+{followed.length-10}</AppText>
            </Pressable>:null}
          </ScrollView>}
        <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Pressable testID="competitions-most-followed-button" accessibilityRole="button"
            onPress={()=>router.push("/competitions/popular")} style={styles.shortcut}>
            <Ionicons name="trending-up-outline" size={19} color={colors.primary}/>
            <AppText variant="caption" weight="semibold" numberOfLines={2} style={styles.accent}>
              {t("competition.mostFollowed")}
            </AppText>
          </Pressable>
          <Pressable testID="competitions-ongoing-followed-button" accessibilityRole="button"
            onPress={()=>router.push("/competitions/ongoing")} style={styles.shortcut}>
            <Ionicons name="play-circle-outline" size={19} color={colors.primary}/>
            <AppText variant="caption" weight="semibold" numberOfLines={2} style={styles.accent}>
              {t("competition.ongoingFollowedVenues")}
            </AppText>
          </Pressable>
        </View>
      </View>
      <View style={styles.filters}>
        <DirectoryFilterSelect testID="competition-status-select" label={t("competition.filterStatus")}
          value={status} allLabel={t("competition.allStatuses")}
          options={statusOptions.map(option=>({value:option,label:t(`competition.status.${option}` as never)}))}
          onSelect={setStatus}/>
        <TextField testID="competition-name-search" label={t("competition.searchName")}
          placeholder={t("competition.searchPlaceholder")} value={query} maxLength={120}
          autoCorrect={false} returnKeyType="search" onFocus={()=>setSuggestionsOpen(true)}
          onChangeText={text=>{setQuery(text);setSuggestionsOpen(true);}}
          onSubmitEditing={()=>submit()}/>
        {suggestionsOpen&&suggestions.length>0?<View style={styles.suggestions}>
          {suggestions.map(item=><Pressable key={item.id} accessibilityRole="button"
            onPress={()=>{setQuery(item.name);submit(item.name);}}
            style={styles.suggestion}>
            <AppText numberOfLines={1}>{item.name}</AppText>
          </Pressable>)}
        </View>:null}
        <Button label={t("competition.search")} onPress={()=>submit()} loading={loading}/>
      </View>
    </>:null}
    {loading&&mode!=="directory"?<DataLoadingState variant="list" minHeight={330}/>:null}
    {error?<Card style={styles.result}><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary" onPress={()=>setRetry(n=>n+1)}/></Card>:null}
    {!loading&&!error&&results.length===0?<Card><AppText>
      {mode==="ongoing"?t("competition.noOngoingFollowed"):t("competition.noMatches")}
    </AppText></Card>:null}
    {!loading&&!error?results.map(render):null}
  </Screen>;
}
const styles=StyleSheet.create({
  page:{paddingTop:spacing.sm,gap:spacing.md},
  row:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  panel:{gap:spacing.sm,backgroundColor:colors.surface,borderRadius:radius.lg,padding:spacing.sm,
    borderWidth:1,borderColor:colors.border},
  shortcut:{flex:1,minHeight:56,borderRadius:radius.md,padding:6,gap:5,
    backgroundColor:colors.primarySoft,borderColor:colors.primary,borderWidth:1,
    flexDirection:"row",alignItems:"center",justifyContent:"center"},
  accent:{color:colors.primary,textAlign:"center",flexShrink:1},
  more:{width:148,minHeight:208,backgroundColor:colors.primarySoft,alignItems:"center",
    justifyContent:"center",borderRadius:radius.md,gap:spacing.sm},
  filters:{gap:spacing.sm},
  suggestions:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,overflow:"hidden"},
  suggestion:{minHeight:44,justifyContent:"center",paddingHorizontal:spacing.md,
    borderBottomWidth:1,borderBottomColor:colors.border},
  result:{gap:spacing.xs},
  back:{width:44,height:44,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft,borderRadius:22},
});
