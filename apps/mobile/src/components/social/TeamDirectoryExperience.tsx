import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {SocialDirectoryDiscoveryResponse,TeamDirectoryItemDto} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useMemo,useState} from "react";
import {Pressable,ScrollView,StyleSheet,View} from "react-native";
import {marketingApi,teamApi} from "../../lib/api";
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
const empty:SocialDirectoryDiscoveryResponse={entityType:"TEAM",counts:[],followedIds:[]};
const open=(id:string)=>router.push({pathname:"/teams/[teamId]",params:{teamId:id}});

export function TeamDirectoryExperience({mode}:{mode:Mode}){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const token=session?.accessToken;
  const [teams,setTeams]=useState<TeamDirectoryItemDto[]>([]);
  const [meta,setMeta]=useState(empty);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [retry,setRetry]=useState(0);
  const [joiningId,setJoiningId]=useState<string|null>(null);
  const [city,setCity]=useState("");
  const [query,setQuery]=useState("");
  const [search,setSearch]=useState("");
  const [suggestionsOpen,setSuggestionsOpen]=useState(false);

  useFocusEffect(useCallback(()=>{
    let active=true;
    if(!token){setLoading(false);setTeams([]);setMeta(empty);return()=>{active=false;};}
    setLoading(true);setError(null);
    void Promise.all([teamApi.directory(token),marketingApi.socialDirectoryDiscovery(token,"TEAM")])
      .then(([list,discovery])=>{if(active){setTeams(list.teams);setMeta(discovery);}})
      .catch(()=>{if(active)setError(t("teams.directoryLoadError"));})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[token,retry,t]));

  const byId=useMemo(()=>new Map(teams.map(team=>[team.id,team])),[teams]);
  const followers=useMemo(()=>new Map(meta.counts.map(row=>[row.id,row.count])),[meta.counts]);
  const followed=meta.followedIds.map(id=>byId.get(id)).filter((x):x is TeamDirectoryItemDto=>Boolean(x));
  const cities=[...new Set(teams.map(x=>x.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const results=mode==="popular"
    ?[...teams].sort((a,b)=>(followers.get(b.id)??0)-(followers.get(a.id)??0)||a.name.localeCompare(b.name)).slice(0,15)
    :mode==="following"?followed:mode==="mine"?teams.filter(x=>x.myMembershipRole)
    :teams.filter(x=>(!city||x.city===city)&&(!search||[x.name,x.city].some(y=>y.toLowerCase().includes(search.toLowerCase()))));
  const suggestions=query.trim()
    ?teams.filter(x=>(!city||x.city===city)
      &&[x.name,x.city].some(text=>text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))
      .slice(0,8):[];
  function submit(value=query){setSearch(value.trim());setSuggestionsOpen(false);}
  async function join(id:string){
    if(!token||joiningId)return;
    setJoiningId(id);setError(null);
    try{
      await teamApi.requestJoin(token,id);
      setTeams(list=>list.map(x=>x.id===id?{...x,joinRequestStatus:"PENDING"}:x));
    }catch{setError(t("teams.joinRequestError"));}
    finally{setJoiningId(null);}
  }
  function action(team:TeamDirectoryItemDto){
    return team.myMembershipRole?{label:t("teams.alreadyMemberSelf"),disabled:true}
      :team.joinRequestStatus==="PENDING"?{label:t("teams.joinRequestPending"),disabled:true}
      :{label:t("teams.requestToJoin"),disabled:false};
  }
  function render(team:TeamDirectoryItemDto,index:number){
    const a=action(team);
    return <View key={team.id} style={styles.item}>
      {mode==="popular"?<AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
        #{index+1} · {t("social.followers",{count:followers.get(team.id)??0})}
      </AppText>:null}
      <SocialDirectoryCard id={team.id} name={team.name} kind="TEAM" imageUrl={team.logoUrl}
        detail={team.city} badge={t("teams.members",{count:team.rosterCount})}
        detailsLabel={t("teams.viewTeam")} actionLabel={a.label}
        actionDisabled={a.disabled||!token||joiningId!==null} busy={joiningId===team.id}
        onDetails={()=>open(team.id)} onAction={()=>void join(team.id)}/>
    </View>;
  }
  const title=mode==="popular"?t("teams.mostFollowed"):mode==="mine"?t("teams.myTeams")
    :mode==="following"?t("teams.followedTeams"):t("teams.title");
  return <Screen showHeader publicNav style={styles.page}>
    {mode!=="directory"?<View style={[styles.row,{alignItems:"center"}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("teams.backToTeams")}
        onPress={()=>router.navigate("/teams")} style={styles.back}>
        <Ionicons name={isRTL?"arrow-forward":"arrow-back"} size={21} color={colors.primary}/>
      </Pressable>
      <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>{title}</AppText>
    </View>:null}
    {mode==="directory"?<>
      <View testID="teams-followed-strip" style={styles.panel}>
        <AppText weight="bold">{t("teams.followedTeams")}</AppText>
        {loading?<DataLoadingState variant="list" minHeight={120}/>:followed.length===0?
          <AppText variant="caption" muted>{t("teams.followedEmpty")}</AppText>:
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            testID="teams-followed-carousel"
            contentContainerStyle={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
            {followed.slice(0,10).map(team=>{
              const a=action(team);
              return <SocialFollowedTile key={team.id} id={team.id} name={team.name}
                imageUrl={team.logoUrl} kind="TEAM" detailsLabel={t("teams.viewTeam")}
                actionLabel={a.label} actionDisabled={a.disabled||joiningId!==null}
                busy={joiningId===team.id} onDetails={()=>open(team.id)} onAction={()=>void join(team.id)}/>;
            })}
            {followed.length>10?<Pressable testID="teams-followed-more" accessibilityRole="button"
              onPress={()=>router.push("/teams/following")} style={styles.more}>
              <Ionicons name={isRTL?"arrow-back":"arrow-forward"} size={24} color={colors.primary}/>
              <AppText variant="caption" weight="semibold">{t("booking.followedShowMore")}</AppText>
              <AppText variant="caption" muted>+{followed.length-10}</AppText>
            </Pressable>:null}
          </ScrollView>}
        <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
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
        </View>
      </View>
      <View style={styles.filters}>
        <DirectoryFilterSelect testID="teams-city-select" label={t("teams.filterCity")}
          value={city} allLabel={t("teams.allCities")}
          options={cities.map(name=>({value:name,label:name}))} onSelect={setCity}/>
        <TextField testID="teams-name-search" label={t("teams.searchName")}
          placeholder={t("teams.searchPlaceholder")} value={query} maxLength={120}
          returnKeyType="search" onFocus={()=>setSuggestionsOpen(true)}
          onChangeText={text=>{setQuery(text);setSuggestionsOpen(true);}}
          onSubmitEditing={()=>submit()}/>
        {suggestionsOpen&&suggestions.length>0?<View style={styles.suggestions}>
          {suggestions.map(item=><Pressable key={item.id} accessibilityRole="button"
            onPress={()=>{setQuery(item.name);submit(item.name);}} style={styles.suggestion}>
            <AppText numberOfLines={1}>{item.name}</AppText>
            <AppText muted variant="caption" numberOfLines={1}>{item.city}</AppText>
          </Pressable>)}
        </View>:null}
        <Button label={t("teams.search")} onPress={()=>submit()} loading={loading}/>
      </View>
      <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Button label={t("teams.invitationsTitle")} onPress={()=>router.push("/teams/invitations")}
          variant="secondary" style={{flex:1}}/>
        {session?.user.roles.includes("TEAM_MANAGER")?<Button label={t("teams.create")}
          onPress={()=>router.push("/teams/create")} style={{flex:1}}/>:null}
      </View>
    </>:null}
    {loading&&mode!=="directory"?<DataLoadingState variant="list" minHeight={350}/>:null}
    {error?<Card style={styles.item}><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} onPress={()=>setRetry(n=>n+1)} variant="secondary"/></Card>:null}
    {!loading&&!error&&results.length===0?<Card><AppText>{t("teams.noMatches")}</AppText></Card>:null}
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
  suggestion:{minHeight:52,justifyContent:"center",paddingHorizontal:spacing.md,
    borderBottomWidth:1,borderBottomColor:colors.border,gap:3},
  item:{gap:spacing.sm},
  back:{width:44,height:44,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft,borderRadius:22},
});
