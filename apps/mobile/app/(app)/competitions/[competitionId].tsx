import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {CompetitionDto,CompetitionMediaPostDto,CompetitionParticipationDto,SocialFollowStateDto,TeamDirectoryItemDto,TeamListItemDto,ManualTeamDto} from "@leaguekick/contracts";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {useCallback,useEffect,useRef,useState} from "react";
import {AppState,Image,Pressable,ScrollView,Share,StyleSheet,View,useWindowDimensions,type LayoutChangeEvent} from "react-native";
import {competitionApi,marketingApi,ownerApi,manualTeamApi,resolveMediaImageUrl,teamApi} from "../../../src/lib/api";
import {formatCompetitionDateTime} from "../../../src/lib/date-time";
import {competitionHomeSnapshot,competitionShareMessage} from "../../../src/lib/competition-detail-home";
import {emptyCompetitionMatchPreferences,type CompetitionMatchPreferences}
  from "../../../src/lib/competition-detail-match-filters";
import type {MatchFilter} from "../../../src/components/competition/CompetitionMatchList";
import {TextField} from "../../../src/components/ui/TextField";
import {CompetitionParticipationPanel} from "../../../src/components/competition/CompetitionParticipationPanel";
import {AppText} from "../../../src/components/ui/AppText";
import {Button} from "../../../src/components/ui/Button";
import {Card} from "../../../src/components/ui/Card";
import {DataLoadingState} from "../../../src/components/ui/DataLoadingState";
import {Screen} from "../../../src/components/ui/Screen";
import {
  COMPETITION_PROFILE_TABS,COMPETITION_TAB_ICONS,CompetitionProfileSections,
  type CompetitionProfileTab,
} from "../../../src/components/competition/CompetitionProfileSections";
import {allowedCompetitionSubtabs,chooseCompetitionMain,chooseCompetitionSubtab,
  requestedCompetitionNavigation,resolvedCompetitionSubtab} from "../../../src/lib/competition-detail-navigation";
import {useAuth} from "../../../src/providers/AuthProvider";
import {useLocale} from "../../../src/providers/LocaleProvider";

function selectedTab(input?:string):CompetitionProfileTab{
  // Links saved before the Results tab was removed still reach Matches > Finished.
  if(input==="RESULTS")return "MATCHES";
  return COMPETITION_PROFILE_TABS.includes(input as CompetitionProfileTab)
    ?input as CompetitionProfileTab:"HOME";
}

export default function CompetitionDetailScreen(){
  const {competitionId,focusRegistration,tab,stage,subtab}=useLocalSearchParams<{
    competitionId:string;focusRegistration?:string;tab?:string;stage?:string;subtab?:string;
  }>();
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const {height:viewportHeight}=useWindowDimensions();
  const scrollRef=useRef<ScrollView>(null);
  const tabScrollRef=useRef<ScrollView>(null);
  const tabViewportWidth=useRef(0);
  const tabPositions=useRef(new Map<CompetitionProfileTab,{x:number;width:number}>());
  const tabScrollTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const contentY=useRef(0);
  const handledRegistration=useRef(false);
  const [activeTab,setActiveTab]=useState<CompetitionProfileTab>(()=>selectedTab(tab));
  const [navigation,setNavigation]=useState(()=>requestedCompetitionNavigation(
    focusRegistration==="1"?"TEAMS":tab,
    focusRegistration==="1"?"REGISTRATION":tab==="RESULTS"?"RESULTS":stage==="KNOCKOUT"?"KNOCKOUT":subtab));
  const loadGeneration=useRef(0);
  const actorIdentity=competitionId+"|"+(session?.user.id??"anonymous")+"|"+(session?.accessToken??"");
  const lastActorIdentity=useRef(actorIdentity);

  const [competition,setCompetition]=useState<CompetitionDto|null>(null);
  const [myTeams,setMyTeams]=useState<TeamListItemDto[]>([]);
  const [selectedTeamId,setSelectedTeamId]=useState<string|null>(null);
  const [participations,setParticipations]=useState<CompetitionParticipationDto[]>([]);
  const [participationError,setParticipationError]=useState(false);
  const [intent,setIntent]=useState<{kind:"register"|"accept"|"decline"|"withdraw";teamId:string}|null>(null);

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
  const [shareBusy,setShareBusy]=useState(false);
  const [refreshingPublic,setRefreshingPublic]=useState(false);
  const publicRefreshBusy=useRef(false);
  const [matchPreferences,setMatchPreferences]=useState<CompetitionMatchPreferences>(
    emptyCompetitionMatchPreferences);
  const [extraMatchStatus,setExtraMatchStatus]=useState<"POSTPONED"|"CANCELLED"|null>(null);
  useEffect(()=>{
    setMatchPreferences(emptyCompetitionMatchPreferences);
    setExtraMatchStatus(null);
  },[competitionId]);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const [retry,setRetry]=useState(0);

  useEffect(()=>{
    handledRegistration.current=false;
    setActiveTab(focusRegistration==="1"?"TEAMS":selectedTab(tab));
    setNavigation(requestedCompetitionNavigation(
      focusRegistration==="1"?"TEAMS":tab,
      focusRegistration==="1"?"REGISTRATION":tab==="RESULTS"?"RESULTS":
        stage==="KNOCKOUT"?"KNOCKOUT":subtab,
      competition?.format??"LEAGUE"));
  },[tab,subtab,stage,focusRegistration,competitionId]);

  // No stale private registration/team list may survive a route or account swap.
  useEffect(()=>{
    if(lastActorIdentity.current===actorIdentity)return;
    lastActorIdentity.current=actorIdentity;
    loadGeneration.current++;
    setCompetition(null);setMediaPosts([]);setParticipations([]);setMyTeams([]);
    setSelectedTeamId(null);setParticipationError(false);setOrganizerCanInvite(false);
    setDirectoryTeams([]);setManualTeams([]);setSelectedManualId(null);
    setInvitedTeamId(null);setIntent(null);setTeamSearch("");
    setFollowState(null);setFollowBusy(false);setBusy(false);setMessage(null);
    setError(null);setLoading(true);
  },[actorIdentity]);

  const load=useCallback(async()=>{
    if(!competitionId){setLoading(false);return;}
    const generation=++loadGeneration.current;
    const valid=()=>generation===loadGeneration.current;
    setLoading(true);setError(null);
    // A permission may have been revoked while this page was away. Clear
    // privileged data before each focused reload or retry.
    setParticipations([]);setMyTeams([]);setOrganizerCanInvite(false);
    setDirectoryTeams([]);setManualTeams([]);setParticipationError(false);
    setSelectedManualId(null);setInvitedTeamId(null);setIntent(null);
    try{
      const [{competition:next},mediaResult]=await Promise.all([
        competitionApi.get(competitionId),competitionApi.media(competitionId),
      ]);
      if(!valid())return;
      let owned:TeamListItemDto[]=[];
      let registrations:CompetitionParticipationDto[]=[];
      let registrationFailed=false,inviteAllowed=false;
      let ownerDirectory:TeamDirectoryItemDto[]=[],ownerManual:ManualTeamDto[]=[];
      if(session){
        const [participation,managed]=await Promise.allSettled([
          competitionApi.myParticipations(session.accessToken,competitionId),
          teamApi.mine(session.accessToken),
        ]);
        if(!valid())return;
        if(participation.status==="fulfilled")registrations=participation.value.participations;
        else registrationFailed=true;
        if(managed.status==="fulfilled")owned=managed.value.teams
          .filter(team=>team.managerUserId===session.user.id);
        if(session.user.roles.includes("VENUE_OWNER")){
          try{
            const status=await ownerApi.getStatus(session.accessToken);
            if(!valid())return;
            if(status.venue?.id===next.venueId){
              const [directory,manual]=await Promise.all([
                teamApi.directory(session.accessToken).catch(()=>({teams:[] as TeamDirectoryItemDto[]})),
                manualTeamApi.mine(session.accessToken).catch(()=>({teams:[] as ManualTeamDto[]})),
              ]);
              if(!valid())return;
              inviteAllowed=true;ownerDirectory=directory.teams;ownerManual=manual.teams;
            }
          }catch{/* Organizer privileges default to unavailable on failed authorization. */}
        }
      }
      if(!valid())return;
      setCompetition(next);setMediaPosts(mediaResult.posts);
      setParticipations(registrations);setParticipationError(registrationFailed);
      setMyTeams(owned);
      setSelectedTeamId(current=>owned.some(team=>team.id===current)?current:owned[0]?.id??null);
      setOrganizerCanInvite(inviteAllowed);
      setDirectoryTeams(ownerDirectory);setManualTeams(ownerManual);
    }catch{if(valid()){setCompetition(null);setError(t("competition.loadError"));}}
    finally{if(valid())setLoading(false);}
  },[competitionId,session?.accessToken,session?.user.id,retry,t]);

  useFocusEffect(useCallback(()=>{
    let mounted=true;
    const actor=actorIdentity;
    void load();
    if(session?.accessToken&&competitionId){
      marketingApi.socialFollowState(session.accessToken,"COMPETITION",competitionId)
        .then(value=>{if(mounted&&actor===lastActorIdentity.current)setFollowState(value);})
        .catch(()=>{if(mounted&&actor===lastActorIdentity.current)setFollowState(null);});
    }else setFollowState(null);
    return()=>{mounted=false;loadGeneration.current++;};
  },[load,session?.accessToken,competitionId,actorIdentity]));

  // Public-only refresh never repeats a registration, invitation or follow write.
  // Generation and account scope prevent late polling from overwriting a newer
  // focus revalidation or a different competition/account.
  const refreshCompetitionPublic=useCallback(async(silent=false)=>{
    if(!competitionId||publicRefreshBusy.current||AppState.currentState!=="active")return;
    const actor=actorIdentity,generation=loadGeneration.current;
    publicRefreshBusy.current=true;
    if(!silent)setRefreshingPublic(true);
    try{
      const {competition:fresh}=await competitionApi.get(competitionId);
      if(actor!==lastActorIdentity.current||generation!==loadGeneration.current)return;
      setCompetition(current=>current?.id===fresh.id?fresh:current);
      if(!silent)setError(null);
    }catch{
      // Background polling cannot replace valid data with a transient error.
      if(!silent&&actor===lastActorIdentity.current&&generation===loadGeneration.current)
        setError(t("competition.loadError"));
    }finally{
      publicRefreshBusy.current=false;
      if(actor===lastActorIdentity.current&&generation===loadGeneration.current)
        setRefreshingPublic(false);
    }
  },[competitionId,actorIdentity,t]);

  // Foreground updates serve Home, Matches, Standings and the verified stats view.
  // Keep the previously selected match/date/team facets and existing scroll.
  useFocusEffect(useCallback(()=>{
    if(!competitionId||!["HOME","MATCHES","STANDINGS","STATS"].includes(activeTab))return;
    let active=true;
    const refreshScore=async()=>{
      if(!active||AppState.currentState!=="active")return;
      await refreshCompetitionPublic(true);
    };
    const timer=setInterval(()=>void refreshScore(),25000);
    const appState=AppState.addEventListener("change",status=>{
      if(status==="active")void refreshScore();
    });
    return()=>{active=false;clearInterval(timer);appState.remove();};
  },[competitionId,activeTab,refreshCompetitionPublic]));

  async function shareCompetition(){
    if(!competition||shareBusy)return;
    setShareBusy(true);
    try{
      await Share.share({message:competitionShareMessage(
        competition.name,competition.id,competition.venueName)});
    }catch{
      // Do not claim a share succeeded when the operating system refused it.
      setError(t("competition.detail.shareError"));
    }finally{setShareBusy(false);}
  }

  async function toggleFollow(){
    if(!session||!competitionId||!followState||followBusy)return;
    const actor=actorIdentity;
    setFollowBusy(true);setError(null);
    try{
      const next=followState.following
        ?await marketingApi.socialUnfollow(session.accessToken,"COMPETITION",competitionId)
        :await marketingApi.socialFollow(session.accessToken,"COMPETITION",competitionId);
      if(actor===lastActorIdentity.current)setFollowState(next);
    }catch{if(actor===lastActorIdentity.current)setError(t("social.followError"));}
    finally{if(actor===lastActorIdentity.current)setFollowBusy(false);}
  }

  async function executeIntent(){
    if(!session||!competitionId||!intent||busy||participationError)return;
    const item=intent;
    const actor=actorIdentity;
    setBusy(true);setError(null);setMessage(null);
    try{
      if(item.kind==="register"){
        if(!myTeams.some(team=>team.id===item.teamId&&team.managerUserId===session.user.id))
          throw new Error(t("competition.noTeamsForRegistration"));
        await competitionApi.register(session.accessToken,competitionId,item.teamId);
      }else if(item.kind==="withdraw"){
        await competitionApi.withdraw(session.accessToken,competitionId,item.teamId);
      }else{
        await competitionApi.respondInvitation(session.accessToken,competitionId,item.teamId,
          {status:item.kind==="accept"?"ACCEPTED":"REJECTED"});
      }
      if(actor!==lastActorIdentity.current)return;
      setIntent(null);
      await load();
      if(actor!==lastActorIdentity.current)return;
      setMessage(item.kind==="register"?t("competition.registrationSent"):
        t("competition.phase3.actionCompleted"));
    }catch(e){
      // The API carries specific reasons like full, duplicate, deadline or unauthorized.
      if(actor!==lastActorIdentity.current)return;
      setError(e instanceof Error?e.message:t("competition.phase3.actionError"));
      setIntent(null);
      await load();
    }finally{if(actor===lastActorIdentity.current)setBusy(false);}
  }
  async function inviteAsOrganizer(){
    if(!session||!competitionId||!organizerCanInvite||!invitedTeamId||busy)return;
    const actor=actorIdentity;
    setBusy(true);setError(null);setMessage(null);
    try{
      // Invitations remain INVITED until the actual team manager accepts.
      await competitionApi.inviteTeam(session.accessToken,competitionId,{teamId:invitedTeamId,seed:null});
      if(actor!==lastActorIdentity.current)return;
      setInvitedTeamId(null);
      await load();
      if(actor===lastActorIdentity.current)setMessage(t("competition.organizerInvitationSent"));
    }catch{if(actor===lastActorIdentity.current)setError(t("competition.inviteError"));}
    finally{if(actor===lastActorIdentity.current)setBusy(false);}
  }
  async function registerManualTeam(){
    if(!session||!competitionId||!organizerCanInvite||!selectedManualId||busy)return;
    const actor=actorIdentity;
    setBusy(true);setError(null);setMessage(null);
    try{
      await manualTeamApi.register(session.accessToken,competitionId,selectedManualId);
      if(actor!==lastActorIdentity.current)return;
      setSelectedManualId(null);
      await load();
      if(actor===lastActorIdentity.current)setMessage(t("manualTeams.registered"));
    }catch(e){
      if(actor===lastActorIdentity.current)
        setError(e instanceof Error?e.message:t("manualTeams.registrationError"));
    }finally{if(actor===lastActorIdentity.current)setBusy(false);}
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
    if(next!==activeTab)setActiveTab(next);
    setNavigation(current=>chooseCompetitionMain(current,next));
    // A tab selection is not a command to move the outer page.
    requestAnimationFrame(()=>focusSelectedTab(next,true));
  }
  function onMatchStatusChange(next:MatchFilter){
    const name=next==="FINISHED"?"RESULTS":
      next==="UPCOMING"?"UPCOMING":next==="LIVE"?"LIVE":"ALL";
    setExtraMatchStatus(next==="POSTPONED"||next==="CANCELLED"?next:null);
    setNavigation(current=>chooseCompetitionSubtab(chooseCompetitionMain(current,"MATCHES"),
      "MATCHES",name,["UPCOMING","LIVE","RESULTS","ALL"]));
  }
  function registrationLayout(event:LayoutChangeEvent){
    if(focusRegistration!=="1"||handledRegistration.current||activeTab!=="TEAMS")return;
    handledRegistration.current=true;
    const y=event.nativeEvent.layout.y;
    requestAnimationFrame(()=>scrollRef.current?.scrollTo({
      y:Math.max(0,contentY.current+y-spacing.sm),animated:true,
    }));
  }

  const availableSubtabs=competition?allowedCompetitionSubtabs(activeTab,competition.format,{
    registrationOpen:competition.status==="REGISTRATION_OPEN",
    hasParticipation:participations.length>0,
  }):[];
  const selectedSubtab=resolvedCompetitionSubtab(navigation,activeTab,availableSubtabs);
  const representedIds=new Set([
    ...(competition?.teams.filter(team=>!["REJECTED","WITHDRAWN"].includes(team.status))
      .map(team=>team.teamId)??[]),
    ...participations.filter(item=>!["REJECTED","WITHDRAWN"].includes(item.status))
      .map(item=>item.teamId),
  ]);
  const availableOwnerTeams=organizerCanInvite
    ?directoryTeams.filter(team=>!representedIds.has(team.id))
    :[];
  const filteredOwnerTeams=availableOwnerTeams.filter(team=>
    [team.name,team.city].some(value=>value.toLowerCase().includes(teamSearch.trim().toLowerCase()))
  ).slice(0,12);
  const eligibleManagedTeams=myTeams.filter(team=>!representedIds.has(team.id));
  const eligibleManualTeams=manualTeams.filter(team=>!representedIds.has(team.id));
  const accepted=competition?.teams.filter(team=>team.status==="ACCEPTED")??[];
  const home=competition?competitionHomeSnapshot(competition):null;
  const played=competition?.matches.filter(match=>match.status==="COMPLETED"||match.status==="CORRECTED").length??0;
  const inProgress=competition?.matches.filter(match=>match.status==="IN_PROGRESS").length??0;
  const nextDate=competition?.status==="REGISTRATION_OPEN"
    ?competition.registrationClosesAt:competition?.startsAt;
  const eventDate=nextDate?formatCompetitionDateTime(nextDate,language):null;
  const capacityRatio=competition?.maxTeams?Math.min(1,accepted.length/competition.maxTeams):0;
  // Permanent organizer-controlled cover wins; older competitions retain a published
  // media-image fallback. The image appears only on an already public competition.
  const cover=resolveMediaImageUrl(competition?.coverImageUrl??mediaPosts.find(post=>post.imageUrl)?.imageUrl??null);
  const logo=resolveMediaImageUrl(competition?.logoUrl??null);

  const registrationOpen=competition?.status==="REGISTRATION_OPEN"&&
    (!competition.registrationClosesAt||Date.parse(competition.registrationClosesAt)>Date.now());
  const full=Boolean(competition&&accepted.length>=competition.maxTeams);
  function openHomeAction(){
    if(!home)return;
    switchTab(home.action.main);
    setNavigation(current=>chooseCompetitionSubtab(
      chooseCompetitionMain(current,home.action.main),home.action.main,
      home.action.sub,allowedCompetitionSubtabs(home.action.main,competition!.format,{
        registrationOpen:competition!.status==="REGISTRATION_OPEN",
        hasParticipation:participations.length>0,
      })));
  }
  const canApply=registrationOpen&&!full&&!participationError;
  const applicationForm=competition?.status==="REGISTRATION_OPEN"&&session?
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
      <AppText variant="caption" muted>
        {t("competition.phase3.feeAmount")}: {competition.registrationFeeAfn} AFN
      </AppText>
      {full?<AppText style={{color:colors.danger}}>{t("competition.phase3.full")}</AppText>:null}
      {!registrationOpen?<AppText style={{color:colors.danger}}>
        {t("competition.phase3.deadline")}</AppText>:null}
      {eligibleManagedTeams.length>0?<Button label={t("competition.register")}
        onPress={()=>selectedTeamId&&setIntent({kind:"register",teamId:selectedTeamId})}
        loading={busy} disabled={!canApply||!selectedTeamId||
          !eligibleManagedTeams.some(team=>team.id===selectedTeamId)}/>:null}
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
    </Card>:null;
  const activeIntentTeam=intent&&myTeams.find(team=>team.id===intent.teamId);
  const confirmationMessage=intent?.kind==="register"?
    t("competition.phase3.confirmRegister",{
      team:activeIntentTeam?.name??"",fee:competition?.registrationFeeAfn??0,
    }):intent?.kind==="accept"?t("competition.phase3.confirmAccept"):
    intent?.kind==="decline"?t("competition.phase3.confirmDecline"):
    t("competition.phase3.confirmWithdraw");
  const registration=session?<View style={styles.registration}>
    {participationError?<Card style={styles.registration}>
      <AppText style={{color:colors.danger}}>{t("competition.phase3.reloadError")}</AppText>
      <Button variant="secondary" label={t("common.retry")} onPress={()=>void load()}/>
    </Card>:null}
    {selectedSubtab!=="REGISTRATION"?<CompetitionParticipationPanel
      participations={participations} busy={busy}
      onAccept={teamId=>setIntent({kind:"accept",teamId})}
      onDecline={teamId=>setIntent({kind:"decline",teamId})}
      onWithdraw={teamId=>setIntent({kind:"withdraw",teamId})}/>:null}
    {selectedSubtab!=="MY_PARTICIPATION"?applicationForm:null}
    {intent?<Card style={styles.registration}>
      <AppText variant="bodyLarge" weight="bold">{t("competition.phase3.confirmTitle")}</AppText>
      <AppText>{confirmationMessage}</AppText>
      <View style={[styles.registerTitle,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Button label={t("competition.phase3.confirm")} loading={busy}
          onPress={()=>void executeIntent()}/>
        <Button label={t("competition.phase3.cancel")} variant="secondary"
          disabled={busy} onPress={()=>setIntent(null)}/>
      </View>
    </Card>:null}
    {message?<AppText style={{color:colors.success}}>{message}</AppText>:null}
  </View>:null;

  if(loading||lastActorIdentity.current!==actorIdentity)
    return <Screen showHeader><DataLoadingState variant="detail" minHeight={540}/></Screen>;
  if(!competition)return <Screen showHeader>
    <Card style={{gap:spacing.md}}>
      <AppText>{error??t("competition.loadError")}</AppText>
      <Button label={t("common.retry")} onPress={()=>setRetry(n=>n+1)}/>
    </Card>
  </Screen>;

  return <Screen showHeader scrollRef={scrollRef} style={styles.page}>
    <Pressable testID="competition-profile-back" accessibilityRole="button"
      accessibilityLabel={t("competition.backToCompetitions")}
      onPress={()=>router.navigate("/competitions")}
      style={[styles.backToList,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Ionicons name={isRTL?"arrow-forward":"arrow-back"} size={21} color={colors.primary}/>
      <AppText weight="semibold" style={{color:colors.primary}}>
        {t("competition.backToCompetitions")}
      </AppText>
    </Pressable>
    <View testID="competition-public-profile" style={styles.profile}>
      <View style={styles.cover}>
        {cover?<Image source={{uri:cover}} resizeMode="cover" style={StyleSheet.absoluteFill}/>:<>
          <View style={styles.coverAccent}/>
          <Ionicons name="trophy-outline" size={80} color="#B7D2FF"/>
        </>}
        {cover?<View style={styles.coverShade}/>:null}
        <View style={[styles.coverTop,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View testID="competition-hero-status" style={[styles.heroStatus,
            competition.status==="IN_PROGRESS"&&styles.heroLive]}>
            {competition.status==="IN_PROGRESS"?<View style={styles.heroLiveDot}/>:null}
            <AppText variant="caption" weight="bold" style={{color:"#FFFFFF"}}>
              {t(`competition.status.${competition.status}` as never)}
            </AppText>
          </View>
          <Pressable accessibilityRole="button" testID="competition-cover-share"
            accessibilityLabel={t("competition.detail.share")} disabled={shareBusy}
            onPress={()=>void shareCompetition()} style={styles.shareCoverButton}>
            <Ionicons name="share-social-outline" size={21} color="#FFFFFF"/>
          </Pressable>
        </View>
        <View style={styles.coverFormat}>
          <AppText variant="caption" weight="bold" style={{color:"#FFFFFF"}}>
            {t(`competition.format.${competition.format}` as never)}
          </AppText>
        </View>
      </View>
      <View style={styles.identity}>
        <View style={styles.avatarFrame}>
          <View style={styles.avatar} testID="competition-brand-logo">
            {logo?<Image source={{uri:logo}} resizeMode="cover" style={styles.logoImage}/>:
              <Ionicons name="trophy" size={45} color={colors.primary}/>}
          </View>
        </View>
        <AppText variant="title" weight="bold" style={styles.name} numberOfLines={3}>
          {competition.name}
        </AppText>
        {competition.description?.trim()?<AppText numberOfLines={2}
          style={styles.identityDescription} muted>{competition.description.trim()}</AppText>:null}
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
            variant={followState.following?"secondary":"primary"} style={{flex:1}}/>:
            !session?<Button label={t("social.follow")} variant="secondary"
              onPress={()=>router.push("/login")} style={{flex:1}}/>:null}
        </View>
        <Button label={home?.action.sub==="REGISTRATION"?
          t("competition.phase4.registerTeam"):
          home?.action.sub==="LIVE"?t("competition.phase4.liveMatches"):
          home?.action.sub==="RESULTS"?t("competition.phase4.finishedResults"):
          t("competition.phase4.viewSchedule")}
          onPress={openHomeAction}
          style={{width:"100%",marginTop:spacing.sm}}/>
      </View>
    </View>

    <View testID="competition-profile-summary" style={styles.summaryCard}>
      <View style={[styles.summaryFacts,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.summaryFact}>
          <Ionicons name="wallet-outline" size={18} color={colors.primary}/>
          <View style={{flex:1,gap:2}}>
            <AppText variant="caption" muted>{t("competition.registrationFee")}</AppText>
            <AppText weight="semibold" numberOfLines={2}>{competition.registrationFeeAfn===0?
              t("competition.profile.free"):`${competition.registrationFeeAfn} AFN`}</AppText>
          </View>
        </View>
        {eventDate?<View style={styles.summaryFact}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary}/>
          <View style={{flex:1,gap:2}}>
            <AppText variant="caption" muted>{t(competition.status==="REGISTRATION_OPEN"?
              "competition.registrationDeadline":"competition.startsAt")}</AppText>
            <AppText variant="caption" weight="semibold" numberOfLines={3}>{eventDate}</AppText>
          </View>
        </View>:null}
      </View>
      <View style={[styles.progressHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <AppText variant="caption" weight="semibold">
          {t("competition.profile.registeredTeams")}
        </AppText>
        <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
          {accepted.length}/{competition.maxTeams}
        </AppText>
      </View>
      <View testID="competition-capacity-progress" style={styles.progressTrack}>
        <View style={[styles.progressFill,{width:`${Math.round(capacityRatio*100)}%`}]}/>
      </View>
    </View>
    <View style={[styles.metrics,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Pressable accessibilityRole="button" testID="competition-metric-teams"
        accessibilityLabel={t("competition.teams")} onPress={()=>switchTab("TEAMS")} style={styles.metric}>
        <Ionicons name="people-outline" size={19} color={colors.primary}/>
        <AppText weight="bold" variant="bodyLarge">{accepted.length}/{competition.maxTeams}</AppText>
        <AppText variant="caption" muted>{t("competition.teams")}</AppText>
      </Pressable>
      <View style={styles.metricDivider}/>
      <Pressable accessibilityRole="button" testID="competition-metric-matches"
        accessibilityLabel={t("competition.profile.matches")} onPress={()=>switchTab("MATCHES")} style={styles.metric}>
        <Ionicons name="football-outline" size={19} color={colors.primary}/>
        <AppText weight="bold" variant="bodyLarge">{competition.matches.length}</AppText>
        <AppText variant="caption" muted>{t("competition.profile.matches")}</AppText>
      </Pressable>
      <View style={styles.metricDivider}/>
      <Pressable accessibilityRole="button" testID="competition-metric-results"
        accessibilityLabel={t("competition.profile.results")} onPress={()=>switchTab("MATCHES")} style={styles.metric}>
        <Ionicons name={inProgress>0?"radio-outline":"checkmark-done-outline"} size={19}
          color={inProgress>0?colors.danger:colors.primary}/>
        <AppText weight="bold" variant="bodyLarge">{inProgress>0?inProgress:played}</AppText>
        <AppText variant="caption" muted>{inProgress>0?
          t("competition.profile.liveMatches"):t("competition.profile.results")}</AppText>
      </Pressable>
    </View>

    <View style={styles.tabWrapper}>
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

    <View testID="competition-profile-subtabs">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{flexGrow:0}} contentContainerStyle={[styles.tabList,
          {flexDirection:isRTL?"row-reverse":"row"}]}>
        {availableSubtabs.map(key=><Pressable key={key}
          testID={"competition-subtab-"+activeTab+"-"+key}
          accessibilityRole="tab" accessibilityState={{selected:selectedSubtab===key}}
          onPress={()=>{
            if(activeTab==="MATCHES")setExtraMatchStatus(null);
            setNavigation(current=>chooseCompetitionSubtab(
              current,activeTab,key,availableSubtabs));
          }}
          style={[styles.tab,selectedSubtab===key&&styles.tabActive]}>
          <AppText variant="caption" weight="semibold"
            style={{color:selectedSubtab===key?colors.primary:colors.textMuted}}>
            {t(`competition.detail.sub.${key}` as never)}
          </AppText>
        </Pressable>)}
      </ScrollView>
    </View>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button variant="secondary" label={t("common.retry")} onPress={()=>void load()}/></Card>:null}
    {activeTab==="STANDINGS"||activeTab==="STATS"?
      <Pressable testID="competition-table-refresh" accessibilityRole="button"
        accessibilityLabel={t("competition.detail.refreshMatches")}
        disabled={refreshingPublic} onPress={()=>void refreshCompetitionPublic()}
        style={[styles.dataRefresh,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="refresh-outline" size={19} color={colors.primary}/>
        <AppText weight="semibold" variant="caption" style={{color:colors.primary}}>
          {refreshingPublic?t("competition.detail.refreshing"):t("competition.detail.refresh")}
        </AppText>
      </Pressable>:null}
    <View testID="competition-tab-content" style={{minHeight:viewportHeight}}
      onLayout={e=>{contentY.current=e.nativeEvent.layout.y;}}>
      <CompetitionProfileSections
        key={activeTab+"-"+selectedSubtab+"-"+(extraMatchStatus??"")}
        competition={competition}
        posts={mediaPosts} activeTab={activeTab} subtab={selectedSubtab}
        registration={registration} onTabChange={switchTab}
        initialStage={selectedSubtab==="KNOCKOUT"?"KNOCKOUT":undefined}
        initialMatchFilter={extraMatchStatus??(tab==="RESULTS"||selectedSubtab==="RESULTS"?"FINISHED":"ALL")}
        matchPreferences={matchPreferences}
        onMatchPreferencesChange={setMatchPreferences}
        onMatchStatusChange={onMatchStatusChange}
        onMatchRefresh={()=>void refreshCompetitionPublic()}
        matchRefreshing={refreshingPublic}
        myAcceptedTeamId={(()=>{
          const acceptedIds=participations.filter(item=>item.status==="ACCEPTED"&&
            competition.teams.some(team=>team.teamId===item.teamId&&team.status==="ACCEPTED"))
            .map(item=>item.teamId);
          return acceptedIds.length===1?acceptedIds[0]!:null;
        })()}/>
    </View>
  </Screen>;
}

const styles=StyleSheet.create({
  page:{paddingTop:spacing.sm,gap:spacing.md},
  dataRefresh:{minHeight:44,paddingHorizontal:spacing.md,alignSelf:"flex-end",
    alignItems:"center",gap:spacing.sm,borderRadius:radius.md,
    backgroundColor:colors.primarySoft},
  backToList:{alignItems:"center",gap:spacing.sm,minHeight:44,
    alignSelf:"flex-start",paddingHorizontal:spacing.sm,borderRadius:radius.md,
    backgroundColor:colors.primarySoft},
  profile:{borderRadius:radius.lg,overflow:"hidden",borderWidth:1,
    borderColor:colors.border,backgroundColor:colors.surface},
  cover:{height:206,backgroundColor:"#153F91",alignItems:"center",
    justifyContent:"center",overflow:"hidden"},
  coverShade:{position:"absolute",top:0,bottom:0,left:0,right:0,backgroundColor:"rgba(5,20,42,.24)"},
  coverTop:{position:"absolute",top:spacing.sm,left:spacing.sm,right:spacing.sm,
    flexDirection:"row",alignItems:"center"},
  heroStatus:{backgroundColor:"rgba(9,28,58,.9)",paddingHorizontal:spacing.md,
    minHeight:30,borderRadius:radius.pill,flexDirection:"row",alignItems:"center",gap:6,
    justifyContent:"center"},
  heroLive:{backgroundColor:"#AB1717"},
  heroLiveDot:{width:7,height:7,borderRadius:4,backgroundColor:"#FFFFFF"},
  shareCoverButton:{width:44,height:44,borderRadius:22,backgroundColor:"rgba(7,24,49,.79)",
    alignItems:"center",justifyContent:"center",marginStart:"auto"},
  coverAccent:{position:"absolute",width:210,height:210,right:-85,top:-65,borderRadius:105,
    backgroundColor:"#2467CE",opacity:.6},
  coverFormat:{position:"absolute",bottom:spacing.sm,right:spacing.sm,
    backgroundColor:"rgba(15,23,42,.76)",paddingHorizontal:spacing.md,
    paddingVertical:6,borderRadius:radius.pill},
  identity:{alignItems:"center",paddingHorizontal:spacing.md,paddingBottom:spacing.md},
  identityDescription:{textAlign:"center",marginTop:spacing.xs,paddingHorizontal:spacing.sm},
  avatarFrame:{width:106,height:106,borderRadius:53,marginTop:-49,
    padding:4,backgroundColor:colors.surface},
  avatar:{width:"100%",height:"100%",borderRadius:49,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center",overflow:"hidden"},
  logoImage:{width:"100%",height:"100%"},
  name:{textAlign:"center",marginTop:6},
  venueLink:{gap:4,alignItems:"center",justifyContent:"center",
    minHeight:44,marginTop:spacing.xs,paddingHorizontal:spacing.sm},
  badges:{alignItems:"center",justifyContent:"center",gap:spacing.sm,
    flexWrap:"wrap",marginTop:6},
  badge:{minHeight:28,borderRadius:radius.pill,backgroundColor:colors.primarySoft,
    paddingHorizontal:spacing.sm,flexDirection:"row",gap:5,alignItems:"center"},
  statusDot:{width:7,height:7,borderRadius:4,backgroundColor:colors.primary},
  followRow:{width:"100%",marginTop:spacing.md,gap:spacing.sm},
  summaryCard:{backgroundColor:colors.surface,borderRadius:radius.lg,
    borderWidth:1,borderColor:colors.border,padding:spacing.md,gap:spacing.md},
  summaryFacts:{flexWrap:"wrap",gap:spacing.sm},
  summaryFact:{flex:1,minWidth:130,flexDirection:"row",alignItems:"flex-start",gap:spacing.xs},
  progressHeading:{justifyContent:"space-between",alignItems:"center",gap:spacing.sm},
  progressTrack:{height:8,backgroundColor:colors.primarySoft,borderRadius:radius.pill,overflow:"hidden"},
  progressFill:{height:"100%",backgroundColor:colors.primary,borderRadius:radius.pill},
  metrics:{backgroundColor:colors.surface,borderRadius:radius.lg,
    borderWidth:1,borderColor:colors.border,alignItems:"center",paddingVertical:spacing.md},
  metric:{flex:1,alignItems:"center",justifyContent:"center",gap:2,minWidth:0,minHeight:64},
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
