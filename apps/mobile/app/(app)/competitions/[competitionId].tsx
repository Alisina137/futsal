import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {CompetitionDto,CompetitionMediaPostDto,SocialFollowStateDto,TeamDirectoryItemDto,TeamListItemDto,ManualTeamDto} from "@leaguekick/contracts";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {useCallback,useEffect,useRef,useState} from "react";
import {AppState,Image,Pressable,ScrollView,StyleSheet,View,type LayoutChangeEvent} from "react-native";
import {competitionApi,marketingApi,ownerApi,manualTeamApi,resolveMediaImageUrl,teamApi} from "../../../src/lib/api";
import {TextField} from "../../../src/components/ui/TextField";
import {AppText} from "../../../src/components/ui/AppText";
import {Button} from "../../../src/components/ui/Button";
import {Card} from "../../../src/components/ui/Card";
import {DataLoadingState} from "../../../src/components/ui/DataLoadingState";
import {Screen} from "../../../src/components/ui/Screen";
import {
  COMPETITION_PROFILE_TABS,COMPETITION_TAB_ICONS,CompetitionProfileSections,
  type CompetitionProfileTab,
} from "../../../src/components/competition/CompetitionProfileSections";
import {useAuth} from "../../../src/providers/AuthProvider";
import {useLocale} from "../../../src/providers/LocaleProvider";

function selectedTab(input?:string):CompetitionProfileTab{
  // Links saved before the Results tab was removed still reach Matches > Finished.
  if(input==="RESULTS")return "MATCHES";
  return COMPETITION_PROFILE_TABS.includes(input as CompetitionProfileTab)
    ?input as CompetitionProfileTab:"HOME";
}

export default function CompetitionDetailScreen(){
  const {competitionId,focusRegistration,tab,stage}=useLocalSearchParams<{
    competitionId:string;focusRegistration?:string;tab?:string;stage?:string;
  }>();
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const scrollRef=useRef<ScrollView>(null);
  const tabScrollRef=useRef<ScrollView>(null);
  const tabViewportWidth=useRef(0);
  const tabPositions=useRef(new Map<CompetitionProfileTab,{x:number;width:number}>());
  const tabScrollTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const tabsY=useRef(0);
  const contentY=useRef(0);
  const handledRegistration=useRef(false);
  const [activeTab,setActiveTab]=useState<CompetitionProfileTab>(()=>selectedTab(tab));
  const [competition,setCompetition]=useState<CompetitionDto|null>(null);
  const [myTeams,setMyTeams]=useState<TeamListItemDto[]>([]);
  const [selectedTeamId,setSelectedTeamId]=useState<string|null>(null);
  const [organizerCanInvite,setOrganizerCanInvite]=useState(false);
  const [directoryTeams,setDirectoryTeams]=useState<TeamDirectoryItemDto[]>([]);
  const [manualTeams,setManualTeams]=useState<ManualTeamDto[]>([]);
  const [selectedManualId,setSelectedManualId]=useState<string|null>(null);
  const [invitedTeamId,setInvitedTeamId]=useState<string|null>(null);
  const [teamSearch,setTeamSearch]=useState("");
  const [mediaPosts,setMediaPosts]=useState<CompetitionMediaPostDto[]>([]);
  const [followState,setFollowState]=useState<SocialFollowStateDto|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [followBusy,setFollowBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const [retry,setRetry]=useState(0);

  useEffect(()=>{
    handledRegistration.current=false;
    setActiveTab(focusRegistration==="1"?"TEAMS":selectedTab(tab));
  },[tab,focusRegistration,competitionId]);

  const load=useCallback(async()=>{
    if(!competitionId){setLoading(false);return;}
    setLoading(true);setError(null);
    try{
      const [{competition:next},mediaResult]=await Promise.all([
        competitionApi.get(competitionId),competitionApi.media(competitionId),
      ]);
      setCompetition(next);
      setMediaPosts(mediaResult.posts);
      if(session){
        try{
          const owned=(await teamApi.mine(session.accessToken)).teams
            .filter(team=>team.managerUserId===session.user.id);
          setMyTeams(owned);
          setSelectedTeamId(current=>owned.some(team=>team.id===current)?current:owned[0]?.id??null);
        }catch{setMyTeams([]);setSelectedTeamId(null);}
        // Venue owners can invite teams only into competitions hosted at their own venue.
        if(session.user.roles.includes("VENUE_OWNER")){
          try{
            const status=await ownerApi.getStatus(session.accessToken);
            if(status.venue?.id===next.venueId){
              const [teamResult,manualResult]=await Promise.all([
                teamApi.directory(session.accessToken).catch(()=>({teams:[] as TeamDirectoryItemDto[]})),
                manualTeamApi.mine(session.accessToken).catch(()=>({teams:[] as ManualTeamDto[]})),
              ]);
              setOrganizerCanInvite(true);
              setDirectoryTeams(teamResult.teams);
              setManualTeams(manualResult.teams);
            }else{
              setOrganizerCanInvite(false);setDirectoryTeams([]);setInvitedTeamId(null);setManualTeams([]);setSelectedManualId(null);
            }
          }catch{
            setOrganizerCanInvite(false);setDirectoryTeams([]);setInvitedTeamId(null);setManualTeams([]);setSelectedManualId(null);
          }
        }else{
          setOrganizerCanInvite(false);setDirectoryTeams([]);setInvitedTeamId(null);setManualTeams([]);setSelectedManualId(null);
        }
      }else{
        setMyTeams([]);setSelectedTeamId(null);
        setOrganizerCanInvite(false);setDirectoryTeams([]);setInvitedTeamId(null);setManualTeams([]);setSelectedManualId(null);
      }
    }catch{setError(t("competition.loadError"));}
    finally{setLoading(false);}
  },[competitionId,session?.accessToken,session?.user.id,retry,t]);

  useFocusEffect(useCallback(()=>{
    let mounted=true;
    void load();
    if(session?.accessToken&&competitionId){
      marketingApi.socialFollowState(session.accessToken,"COMPETITION",competitionId)
        .then(value=>{if(mounted)setFollowState(value);})
        .catch(()=>{if(mounted)setFollowState(null);});
    }else setFollowState(null);
    return()=>{mounted=false;};
  },[load,session?.accessToken,competitionId]));

  // Refresh live score updates while this profile's Home feed is in focus.
  // No spinners or destructive reloads: pending scores remain visible on transient errors.
  // Poll even if no match is currently live, so a newly started fixture appears automatically.
  useFocusEffect(useCallback(()=>{
    if(!competitionId||activeTab!=="HOME")return;
    let active=true;
    let inFlight=false;
    const refreshScore=async()=>{
      if(!active||inFlight||AppState.currentState!=="active")return;
      inFlight=true;
      try{
        const {competition:fresh}=await competitionApi.get(competitionId);
        if(active)setCompetition(current=>current?.id===fresh.id?fresh:current);
      }catch{
        // Keep the latest known results when connectivity temporarily fails.
      }finally{inFlight=false;}
    };
    const timer=setInterval(()=>void refreshScore(),25000);
    const appState=AppState.addEventListener("change",status=>{
      if(status==="active")void refreshScore();
    });
    return()=>{active=false;clearInterval(timer);appState.remove();};
  },[competitionId,activeTab]));

  async function toggleFollow(){
    if(!session||!competitionId||!followState||followBusy)return;
    setFollowBusy(true);setError(null);
    try{
      const next=followState.following
        ?await marketingApi.socialUnfollow(session.accessToken,"COMPETITION",competitionId)
        :await marketingApi.socialFollow(session.accessToken,"COMPETITION",competitionId);
      setFollowState(next);
    }catch{setError(t("social.followError"));}
    finally{setFollowBusy(false);}
  }

  async function register(){
    if(!session||!competitionId||!selectedTeamId)return;
    setBusy(true);setError(null);setMessage(null);
    try{
      await competitionApi.register(session.accessToken,competitionId,selectedTeamId);
      await load();
      setMessage(t("competition.registrationSent"));
    }catch{setError(t("competition.registrationError"));}
    finally{setBusy(false);}
  }
  async function inviteAsOrganizer(){
    if(!session||!competitionId||!organizerCanInvite||!invitedTeamId)return;
    setBusy(true);setError(null);setMessage(null);
    try{
      // Invitations remain INVITED until the actual team manager accepts.
      await competitionApi.inviteTeam(session.accessToken,competitionId,{teamId:invitedTeamId,seed:null});
      setInvitedTeamId(null);
      await load();
      setMessage(t("competition.organizerInvitationSent"));
    }catch{setError(t("competition.inviteError"));}
    finally{setBusy(false);}
  }
  async function registerManualTeam(){
    if(!session||!competitionId||!organizerCanInvite||!selectedManualId)return;
    setBusy(true);setError(null);setMessage(null);
    try{
      await manualTeamApi.register(session.accessToken,competitionId,selectedManualId);
      setSelectedManualId(null);
      await load();
      setMessage(t("manualTeams.registered"));
    }catch(e){
      setError(e instanceof Error?e.message:t("manualTeams.registrationError"));
    }finally{setBusy(false);}
  }
  function focusSelectedTab(target:CompetitionProfileTab,animated=true){
    const bounds=tabPositions.current.get(target);
    if(!bounds||!tabViewportWidth.current)return;
    const x=Math.max(0,bounds.x+bounds.width/2-tabViewportWidth.current/2);
    tabScrollRef.current?.scrollTo({x,animated});
  }

  useEffect(()=>{
    // Wait for the horizontal nav viewport and all tab measurements to stabilize
    // after initial deep linking or RTL layout, then center the active selection.
    if(tabScrollTimer.current)clearTimeout(tabScrollTimer.current);
    tabScrollTimer.current=setTimeout(()=>{
      requestAnimationFrame(()=>focusSelectedTab(activeTab,true));
    },30);
    return()=>{if(tabScrollTimer.current)clearTimeout(tabScrollTimer.current);};
  },[activeTab,isRTL,competition?.id]);

  function switchTab(next:CompetitionProfileTab){
    setActiveTab(next);
    requestAnimationFrame(()=>focusSelectedTab(next,true));
    requestAnimationFrame(()=>scrollRef.current?.scrollTo({
      y:Math.max(0,tabsY.current-spacing.sm),animated:true,
    }));
  }
  function registrationLayout(event:LayoutChangeEvent){
    if(focusRegistration!=="1"||handledRegistration.current||activeTab!=="TEAMS")return;
    handledRegistration.current=true;
    const y=event.nativeEvent.layout.y;
    requestAnimationFrame(()=>scrollRef.current?.scrollTo({
      y:Math.max(0,contentY.current+y-spacing.sm),animated:true,
    }));
  }

  const representedIds=new Set(competition?.teams
    .filter(team=>!["REJECTED","WITHDRAWN"].includes(team.status))
    .map(team=>team.teamId)??[]);
  const availableOwnerTeams=organizerCanInvite
    ?directoryTeams.filter(team=>!representedIds.has(team.id))
    :[];
  const filteredOwnerTeams=availableOwnerTeams.filter(team=>
    [team.name,team.city].some(value=>value.toLowerCase().includes(teamSearch.trim().toLowerCase()))
  ).slice(0,12);
  const eligibleManagedTeams=myTeams.filter(team=>!representedIds.has(team.id));
  const eligibleManualTeams=manualTeams.filter(team=>!representedIds.has(team.id));
  const accepted=competition?.teams.filter(team=>team.status==="ACCEPTED")??[];
  const played=competition?.matches.filter(match=>match.status==="COMPLETED"||match.status==="CORRECTED").length??0;
  // Competitions do not yet have a dedicated cover/avatar column. A real published
  // competition media image is used as the cover; never fabricate a logo or photo.
  const cover=resolveMediaImageUrl(mediaPosts.find(post=>post.imageUrl)?.imageUrl??null);

  const registration=competition?.status==="REGISTRATION_OPEN"&&session?
    <Card onLayout={registrationLayout} style={styles.registration}>
      <View style={[styles.registerTitle,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.registerIcon}>
          <Ionicons name="person-add-outline" color={colors.primary} size={21}/>
        </View>
        <AppText weight="bold" variant="bodyLarge" style={{flex:1}}>{t("competition.register")}</AppText>
      </View>
      {eligibleManagedTeams.length>0?<AppText muted>{t("competition.selectTeam")}</AppText>:null}
      {eligibleManagedTeams.length===0&&!organizerCanInvite
        ?<AppText>{t("competition.noTeamsForRegistration")}</AppText>:null}
      {eligibleManagedTeams.map(team=><Pressable key={team.id} accessibilityRole="radio"
        accessibilityState={{selected:selectedTeamId===team.id}}
        onPress={()=>setSelectedTeamId(team.id)}
        style={[styles.teamChoice,{flexDirection:isRTL?"row-reverse":"row"},
          selectedTeamId===team.id&&styles.teamSelected]}>
        <View style={styles.radioOuter}>
          {selectedTeamId===team.id?<View style={styles.radioInner}/>:null}
        </View>
        <View style={{flex:1}}>
          <AppText weight="semibold">{team.name}</AppText>
          <AppText variant="caption" muted>{team.city}</AppText>
        </View>
      </Pressable>)}
      {eligibleManagedTeams.length>0?<Button label={t("competition.register")} onPress={()=>void register()}
        loading={busy} disabled={!selectedTeamId||!eligibleManagedTeams.some(team=>team.id===selectedTeamId)}/>:null}
      {organizerCanInvite?<>
        <View style={{height:1,backgroundColor:colors.border,marginVertical:spacing.xs}}/>
        <AppText weight="bold" variant="bodyLarge">{t("manualTeams.registerDirect")}</AppText>
        <AppText muted>{t("manualTeams.registerDirectHint")}</AppText>
        {eligibleManualTeams.map(team=><Pressable key={team.id} accessibilityRole="radio"
          accessibilityState={{selected:selectedManualId===team.id}}
          onPress={()=>setSelectedManualId(team.id)}
          style={[styles.teamChoice,{flexDirection:isRTL?"row-reverse":"row"},
            selectedManualId===team.id&&styles.teamSelected]}>
          <View style={styles.radioOuter}>
            {selectedManualId===team.id?<View style={styles.radioInner}/>:null}
          </View>
          <View style={{flex:1}}>
            <AppText weight="semibold">{team.name}</AppText>
            <AppText variant="caption" muted>{team.city} · {t("competition.manualTeamBadge")}</AppText>
          </View>
        </Pressable>)}
        <Button label={t("manualTeams.registerDirect")} loading={busy}
          disabled={!selectedManualId||!eligibleManualTeams.some(team=>team.id===selectedManualId)}
          onPress={()=>void registerManualTeam()}/>
        <Button variant="secondary" label={t("manualTeams.create")} onPress={()=>
          router.push("/owner/manual-teams")}/>

        <View style={{height:1,backgroundColor:colors.border,marginVertical:spacing.xs}}/>
        <AppText weight="bold" variant="bodyLarge">{t("competition.inviteTeam")}</AppText>
        <AppText muted>{t("competition.organizerInviteHint")}</AppText>
        {availableOwnerTeams.length>0?<TextField label={t("teams.searchName")}
          placeholder={t("teams.searchPlaceholder")} value={teamSearch}
          onChangeText={setTeamSearch}/>:null}
        {availableOwnerTeams.length===0?<AppText muted>{t("competition.control.noTeamsAvailable")}</AppText>:null}
        {availableOwnerTeams.length>0&&filteredOwnerTeams.length===0
          ?<AppText muted>{t("teams.noMatches")}</AppText>:null}
        {filteredOwnerTeams.map(team=><Pressable key={team.id} accessibilityRole="radio"
          accessibilityState={{selected:invitedTeamId===team.id}}
          onPress={()=>setInvitedTeamId(team.id)}
          style={[styles.teamChoice,{flexDirection:isRTL?"row-reverse":"row"},
            invitedTeamId===team.id&&styles.teamSelected]}>
          <View style={styles.radioOuter}>
            {invitedTeamId===team.id?<View style={styles.radioInner}/>:null}
          </View>
          <View style={{flex:1}}>
            <AppText weight="semibold">{team.name}</AppText>
            <AppText variant="caption" muted>{team.city}</AppText>
          </View>
        </Pressable>)}
        <Button label={t("competition.inviteTeam")} onPress={()=>void inviteAsOrganizer()}
          loading={busy} disabled={!invitedTeamId||!availableOwnerTeams.some(team=>team.id===invitedTeamId)}/>
      </>:null}
      {message?<AppText style={{color:colors.success}}>{message}</AppText>:null}
    </Card>:null;

  if(loading)return <Screen showHeader><DataLoadingState variant="detail" minHeight={540}/></Screen>;
  if(!competition)return <Screen showHeader>
    <Card style={{gap:spacing.md}}>
      <AppText>{error??t("competition.loadError")}</AppText>
      <Button label={t("common.retry")} onPress={()=>setRetry(n=>n+1)}/>
    </Card>
  </Screen>;

  return <Screen showHeader scrollRef={scrollRef} style={styles.page}>
    <View testID="competition-public-profile" style={styles.profile}>
      <View style={styles.cover}>
        {cover?<Image source={{uri:cover}} resizeMode="cover" style={StyleSheet.absoluteFill}/>:<>
          <View style={styles.coverAccent}/>
          <Ionicons name="trophy-outline" size={80} color="#B7D2FF"/>
        </>}
        <View style={styles.coverFormat}>
          <AppText variant="caption" weight="bold" style={{color:"#FFFFFF"}}>
            {t(`competition.format.${competition.format}` as never)}
          </AppText>
        </View>
      </View>
      <View style={styles.identity}>
        <View style={styles.avatarFrame}>
          <View style={styles.avatar}>
            <Ionicons name="trophy" size={45} color={colors.primary}/>
          </View>
        </View>
        <AppText variant="title" weight="bold" style={styles.name}>{competition.name}</AppText>
        <Pressable accessibilityRole="button" onPress={()=>router.push({
          pathname:"/venues/[venueId]",params:{venueId:competition.venueId},
        })} style={[styles.venueLink,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="location-outline" size={16} color={colors.textMuted}/>
          <AppText variant="caption" muted numberOfLines={2} style={{textAlign:"center"}}>
            {competition.venueName}
          </AppText>
          <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={14} color={colors.primary}/>
        </Pressable>
        <View style={[styles.badges,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.badge}>
            <View style={styles.statusDot}/>
            <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
              {t(`competition.status.${competition.status}` as never)}
            </AppText>
          </View>
          {followState?<View style={styles.badge}>
            <Ionicons name="people-outline" size={15} color={colors.primary}/>
            <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
              {t("social.followers",{count:followState.followerCount})}
            </AppText>
          </View>:null}
        </View>
        <View style={[styles.followRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Button label={t("competition.profile.about")}
            onPress={()=>router.push({pathname:"/competitions/[competitionId]/about",params:{competitionId}})}
            variant="secondary" style={{flex:1}}/>
          {followState?<Button label={followState.following?t("social.unfollow"):t("social.follow")}
            onPress={()=>void toggleFollow()} loading={followBusy}
            variant={followState.following?"secondary":"primary"} style={{flex:1}}/>:null}
        </View>
      </View>
    </View>

    <View style={[styles.metrics,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.metric}>
        <Ionicons name="people-outline" size={19} color={colors.primary}/>
        <AppText weight="bold" variant="bodyLarge">{accepted.length}/{competition.maxTeams}</AppText>
        <AppText variant="caption" muted>{t("competition.teams")}</AppText>
      </View>
      <View style={styles.metricDivider}/>
      <View style={styles.metric}>
        <Ionicons name="football-outline" size={19} color={colors.primary}/>
        <AppText weight="bold" variant="bodyLarge">{competition.matches.length}</AppText>
        <AppText variant="caption" muted>{t("competition.profile.matches")}</AppText>
      </View>
      <View style={styles.metricDivider}/>
      <View style={styles.metric}>
        <Ionicons name="checkmark-done-outline" size={19} color={colors.primary}/>
        <AppText weight="bold" variant="bodyLarge">{played}</AppText>
        <AppText variant="caption" muted>{t("competition.profile.results")}</AppText>
      </View>
    </View>

    <View onLayout={e=>{tabsY.current=e.nativeEvent.layout.y;}} style={styles.tabWrapper}>
      <ScrollView horizontal testID="competition-profile-tabs" showsHorizontalScrollIndicator={false}
        ref={tabScrollRef} onLayout={event=>{
          tabViewportWidth.current=event.nativeEvent.layout.width;
          requestAnimationFrame(()=>focusSelectedTab(activeTab,false));
        }}
        style={styles.tabViewport} contentContainerStyle={[
          styles.tabList,{flexDirection:isRTL?"row-reverse":"row"},
        ]}>
        {COMPETITION_PROFILE_TABS.map(value=><Pressable key={value}
          onLayout={event=>{
            const {x,width}=event.nativeEvent.layout;
            tabPositions.current.set(value,{x,width});
            if(value===activeTab)requestAnimationFrame(()=>focusSelectedTab(activeTab,false));
          }}
          testID={`competition-tab-${value}`} accessibilityRole="tab"
          accessibilityState={{selected:activeTab===value}}
          accessibilityLabel={value==="STANDINGS"&&competition.format!=="LEAGUE"
            ?t(competition.format==="KNOCKOUT"?"competition.profile.knockoutStage":"competition.profile.stages")
            :t(`competition.profile.tab.${value}` as never)}
          onPress={()=>switchTab(value)}
          style={({pressed})=>[styles.tab,activeTab===value&&styles.tabActive,
            pressed&&styles.tabPressed]}>
          <Ionicons name={COMPETITION_TAB_ICONS[value]} size={19}
            color={activeTab===value?colors.primary:colors.textMuted}/>
          <AppText variant="caption" weight="semibold" numberOfLines={1}
            style={{color:activeTab===value?colors.primary:colors.textMuted}}>
            {value==="STANDINGS"&&competition.format!=="LEAGUE"
              ?t(competition.format==="KNOCKOUT"?"competition.profile.knockoutStage":"competition.profile.stages")
              :t(`competition.profile.tab.${value}` as never)}
          </AppText>
        </Pressable>)}
      </ScrollView>
    </View>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    <View onLayout={e=>{contentY.current=e.nativeEvent.layout.y;}}>
      <CompetitionProfileSections competition={competition} posts={mediaPosts}
        activeTab={activeTab} registration={registration} onTabChange={switchTab}
        initialStage={stage==="KNOCKOUT"?"KNOCKOUT":undefined}
        initialMatchFilter={tab==="RESULTS"?"FINISHED":"ALL"}/>
    </View>
  </Screen>;
}

const styles=StyleSheet.create({
  page:{paddingTop:spacing.md,gap:spacing.md},
  profile:{borderRadius:radius.lg,overflow:"hidden",borderWidth:1,
    borderColor:colors.border,backgroundColor:colors.surface},
  cover:{height:184,backgroundColor:"#153F91",alignItems:"center",
    justifyContent:"center",overflow:"hidden"},
  coverAccent:{position:"absolute",width:210,height:210,right:-85,top:-65,borderRadius:105,
    backgroundColor:"#2467CE",opacity:.6},
  coverFormat:{position:"absolute",bottom:spacing.sm,right:spacing.sm,
    backgroundColor:"rgba(15,23,42,.76)",paddingHorizontal:spacing.md,
    paddingVertical:6,borderRadius:radius.pill},
  identity:{alignItems:"center",paddingHorizontal:spacing.md,paddingBottom:spacing.md},
  avatarFrame:{width:106,height:106,borderRadius:53,marginTop:-49,
    padding:4,backgroundColor:colors.surface},
  avatar:{width:"100%",height:"100%",borderRadius:49,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  name:{textAlign:"center",marginTop:6},
  venueLink:{gap:4,alignItems:"center",justifyContent:"center",
    minHeight:44,marginTop:spacing.xs,paddingHorizontal:spacing.sm},
  badges:{alignItems:"center",justifyContent:"center",gap:spacing.sm,
    flexWrap:"wrap",marginTop:6},
  badge:{minHeight:28,borderRadius:radius.pill,backgroundColor:colors.primarySoft,
    paddingHorizontal:spacing.sm,flexDirection:"row",gap:5,alignItems:"center"},
  statusDot:{width:7,height:7,borderRadius:4,backgroundColor:colors.primary},
  followRow:{width:"100%",marginTop:spacing.md,gap:spacing.sm},
  metrics:{backgroundColor:colors.surface,borderRadius:radius.lg,
    borderWidth:1,borderColor:colors.border,alignItems:"center",paddingVertical:spacing.md},
  metric:{flex:1,alignItems:"center",justifyContent:"center",gap:2,minWidth:0},
  metricDivider:{width:1,height:44,backgroundColor:colors.border},
  tabWrapper:{backgroundColor:colors.surface,borderWidth:1,
    borderColor:colors.border,borderRadius:radius.md,overflow:"hidden"},
  tabViewport:{height:64,minHeight:64,maxHeight:64,flexGrow:0,flexShrink:0},
  tabList:{alignItems:"stretch",paddingHorizontal:spacing.xs,gap:spacing.xs},
  tab:{minWidth:89,height:62,alignItems:"center",justifyContent:"center",
    gap:4,paddingHorizontal:spacing.sm,borderBottomWidth:3,borderBottomColor:"transparent"},
  tabActive:{borderBottomColor:colors.primary,backgroundColor:colors.primarySoft},
  tabPressed:{opacity:.76},
  registration:{gap:spacing.md},
  registerTitle:{alignItems:"center",gap:spacing.sm},
  registerIcon:{width:39,height:39,borderRadius:12,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  teamChoice:{gap:spacing.sm,alignItems:"center",minHeight:60,borderWidth:1,
    borderColor:colors.border,borderRadius:radius.md,padding:spacing.sm,
    backgroundColor:colors.surface},
  teamSelected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  radioOuter:{width:22,height:22,borderRadius:11,borderWidth:2,borderColor:colors.primary,
    alignItems:"center",justifyContent:"center"},
  radioInner:{width:11,height:11,borderRadius:6,backgroundColor:colors.primary},
});
