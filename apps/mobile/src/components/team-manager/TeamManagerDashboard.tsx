import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { RoleSubscriptionOfferDto, TeamDto, TeamInvitationDto, TeamJoinRequestDto, TeamListItemDto, TeamPrivacy, PublicVenueDto } from "@leaguekick/contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { ApiRequestError, authApi, notificationApi, marketingApi, resolveMediaImageUrl, teamApi, teamManagerApi, venueApi,
  teamOperationsApi,type TeamOperations,type TeamGuestPlayer, type TeamManagerOverview, type TeamManagerProfileDetails, type TeamCapacity } from "../../lib/api";
import { formatCompetitionDateTime } from "../../lib/date-time";
import { useAuth } from "../../providers/AuthProvider";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DataLoadingState } from "../ui/DataLoadingState";
import { Screen } from "../ui/Screen";
import { TextField } from "../ui/TextField";
import { TeamCompetitionOps } from "./TeamCompetitionOps";
import { TeamGrowthPanel } from "./TeamGrowthPanel";
import {TeamManagerOverviewPanel} from "./TeamManagerOverviewPanel";
import {WhatsAppGroupButton,isWhatsAppGroupInviteLink} from "../ui/WhatsAppGroupButton";

// Keep the existing Section IDs: this is a navigation-only regrouping, not a data/workflow change.
type Section="overview"|"players"|"competitions"|"matches"|"schedule"|"media"|"statistics"|"settings";
type MainSection="overview"|"aboutTeam"|"media"|"statistics"|"settings";
type AboutTeamSection="players"|"competitions"|"matches"|"schedule";
const mainTabs=[
  {id:"overview",icon:"grid-outline",key:"tmnav.overall"},
  {id:"aboutTeam",icon:"shield-checkmark-outline",key:"tmnav.aboutTeam"},
  {id:"media",icon:"images-outline",key:"tmnav.media"},
  {id:"statistics",icon:"stats-chart-outline",key:"tmnav.analytics"},
  {id:"settings",icon:"settings-outline",key:"tmnav.settings"},
] as const satisfies ReadonlyArray<{id:MainSection;icon:keyof typeof Ionicons.glyphMap;key:string}>;
const aboutTeamTabs=[
  {id:"players",icon:"people-outline",key:"tmnav.players"},
  {id:"competitions",icon:"trophy-outline",key:"tmnav.competitions"},
  {id:"matches",icon:"football-outline",key:"tmnav.matches"},
  // The requested Program tab uses the existing, fully functional Schedule page.
  {id:"schedule",icon:"calendar-outline",key:"tmnav.program"},
] as const satisfies ReadonlyArray<{id:AboutTeamSection;icon:keyof typeof Ionicons.glyphMap;key:string}>;
function isAboutTeamSection(id:Section):id is AboutTeamSection{
  return id==="players"||id==="competitions"||id==="matches"||id==="schedule";
}
function mainSectionFor(id:Section):MainSection{
  return isAboutTeamSection(id)?"aboutTeam":id;
}
const positions=["UNSPECIFIED","GOALKEEPER","FIXO","ALA","PIVO","UNIVERSAL"] as const;
type Position=(typeof positions)[number];
const initialProfile:TeamManagerProfileDetails={
  province:null,district:null,description:null,foundedOn:null,
  primaryColor:null,secondaryColor:null,contactPhone:null,homeVenueId:null,allowJoinRequests:true,
  coverImageUrl:null,
  whatsappGroupUrl:null,
};

function Options({items,selected,onSelect}:{items:{id:string;label:string}[];selected:string;onSelect:(id:string)=>void}){
  const {isRTL}=useLocale();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false}
    contentContainerStyle={{gap:spacing.sm,flexDirection:isRTL?"row-reverse":"row",alignItems:"center"}}>
    {items.map(item=><Pressable key={item.id} accessibilityRole="button"
      accessibilityState={{selected:item.id===selected}}
      onPress={()=>onSelect(item.id)} style={[styles.option,item.id===selected&&styles.optionActive]}>
      <AppText variant="caption" weight="semibold" style={item.id===selected?{color:colors.primary}:undefined}>{item.label}</AppText>
    </Pressable>)}
  </ScrollView>;
}

export function TeamManagerDashboard(){
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const token=session?.accessToken;
  const userId=session?.user.id;
  const [tab,setTab]=useState<Section>("overview");
  // Returning to About Team restores the last selected subtab.
  const [lastAboutTeamTab,setLastAboutTeamTab]=useState<AboutTeamSection>("players");
  const activeMain=mainSectionFor(tab);
  const [teams,setTeams]=useState<TeamListItemDto[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [team,setTeam]=useState<TeamDto|null>(null);
  const [overview,setOverview]=useState<TeamManagerOverview|null>(null);
  const [overviewOps,setOverviewOps]=useState<TeamOperations|null>(null);
  const [overviewOpsKey,setOverviewOpsKey]=useState<string|null>(null);
  const [overviewOpsErrorKey,setOverviewOpsErrorKey]=useState<string|null>(null);
  const [overviewOpsReload,setOverviewOpsReload]=useState(0);
  const [lineupFocus,setLineupFocus]=useState<string|null>(null);
  // Loaded data is scoped to the current account and selected team.
  const [teamsActor,setTeamsActor]=useState<string|null>(null);
  const [loadedTeamKey,setLoadedTeamKey]=useState<string|null>(null);
  const [listError,setListError]=useState<string|null>(null);
  const [detailsError,setDetailsError]=useState<{key:string;message:string}|null>(null);
  const [metadataError,setMetadataError]=useState(false);
  const [attentionKey,setAttentionKey]=useState<string|null>(null);
  const [attentionError,setAttentionError]=useState(false);
  const [attentionLoaded,setAttentionLoaded]=useState({
    requests:false,invitations:false,notifications:false,
  });
  const [offer,setOffer]=useState<RoleSubscriptionOfferDto|null>(null);
  const [capacity,setCapacity]=useState<TeamCapacity|null>(null);
  const [paymentRef,setPaymentRef]=useState("");
  const [slotBusy,setSlotBusy]=useState(false);
  const [requests,setRequests]=useState<TeamJoinRequestDto[]>([]);
  const [joinAction,setJoinAction]=useState<{requestId:string;accept:boolean}|null>(null);
  const [joinActionError,setJoinActionError]=useState<{requestId:string;message:string}|null>(null);
  const [invitations,setInvitations]=useState<TeamInvitationDto[]>([]);
  const [unread,setUnread]=useState(0);
  const [venues,setVenues]=useState<PublicVenueDto[]>([]);
  const [venueSearch,setVenueSearch]=useState("");
  const [showVenues,setShowVenues]=useState(false);
  const [loadingTeams,setLoadingTeams]=useState(true);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const [refresh,setRefresh]=useState(0);
  const [teamListRefresh,setTeamListRefresh]=useState(0);
  const [name,setName]=useState("");
  const [city,setCity]=useState("");
  const [logoUrl,setLogoUrl]=useState("");
  const [privacy,setPrivacy]=useState<TeamPrivacy>("PUBLIC");
  const [profile,setProfile]=useState<TeamManagerProfileDetails>(initialProfile);
  const [coverBusy,setCoverBusy]=useState(false);
  const [coverPreview,setCoverPreview]=useState<{url:string;uri:string}|null>(null);
  const selectedTeamRef=useRef(selectedId);
  selectedTeamRef.current=selectedId;
  const [inviteIdentifier,setInviteIdentifier]=useState("");
  const [inviteRole,setInviteRole]=useState<"PLAYER"|"CAPTAIN">("PLAYER");
  const [guestName,setGuestName]=useState("");
  const [guestPosition,setGuestPosition]=useState<Position>("UNSPECIFIED");
  const [guestJersey,setGuestJersey]=useState("");
  const [editingGuest,setEditingGuest]=useState<string|null>(null);
  const [playerSection,setPlayerSection]=useState<"ROSTER"|"REQUESTS"|"INVITATIONS"|"GUESTS">("ROSTER");
  const [playerSearch,setPlayerSearch]=useState("");
  const [playerPosition,setPlayerPosition]=useState<Position|"ALL">("ALL");
  const [requestHistory,setRequestHistory]=useState(false);
  const [inviteHistory,setInviteHistory]=useState(false);
  const [guestToRemove,setGuestToRemove]=useState<string|null>(null);
  const navRef=useRef<ScrollView|null>(null);
  const navViewport=useRef(0);
  const navWidth=useRef(0);
  const navCells=useRef<Partial<Record<MainSection,{x:number;width:number}>>>({});
  const subNavRef=useRef<ScrollView|null>(null);
  const subNavViewport=useRef(0);
  const subNavWidth=useRef(0);
  const subNavCells=useRef<Partial<Record<AboutTeamSection,{x:number;width:number}>>>({});

  const focusTab=useCallback((id:MainSection,animated=false)=>{
    const layout=navCells.current[id];
    if(!layout||!navViewport.current)return;
    const x=Math.max(0,Math.min(Math.max(0,navWidth.current-navViewport.current),layout.x+layout.width/2-navViewport.current/2));
    navRef.current?.scrollTo({x,y:0,animated});
  },[]);
  const focusSubTab=useCallback((id:AboutTeamSection,animated=false)=>{
    const layout=subNavCells.current[id];
    if(!layout||!subNavViewport.current)return;
    const x=Math.max(0,Math.min(Math.max(0,subNavWidth.current-subNavViewport.current),layout.x+layout.width/2-subNavViewport.current/2));
    subNavRef.current?.scrollTo({x,y:0,animated});
  },[]);
  useEffect(()=>{
    const raf=requestAnimationFrame(()=>{
      focusTab(activeMain);
      if(isAboutTeamSection(tab))focusSubTab(tab);
    });
    return()=>cancelAnimationFrame(raf);
  },[tab,activeMain,focusTab,focusSubTab]);
  const chooseTab=(section:Section)=>{
    if(section!=="matches")setLineupFocus(null);
    if(isAboutTeamSection(section))setLastAboutTeamTab(section);
    setTab(section);
    focusTab(mainSectionFor(section),true);
    if(isAboutTeamSection(section))focusSubTab(section,true);
  };
  const chooseMainTab=(section:MainSection)=>{
    chooseTab(section==="aboutTeam"?lastAboutTeamTab:section);
  };
  const date=(value:string|null)=>value?formatCompetitionDateTime(value,language):t("tm1.notScheduled");

  useFocusEffect(useCallback(()=>{
    let active=true;
    if(!token||!userId){
      setTeams([]);setTeamsActor(null);setLoadingTeams(false);
      return()=>{active=false;};
    }
    setLoadingTeams(true);setListError(null);
    // Essential team discovery runs independently of optional billing details.
    void teamApi.mine(token).then(mine=>{
      if(!active)return;
      const owned=mine.teams.filter(item=>item.managerUserId===userId);
      setTeams(owned);setTeamsActor(token);
      setSelectedId(previous=>owned.some(item=>item.id===previous)?previous:owned[0]?.id??null);
    }).catch(e=>{
      if(active)setListError(e instanceof ApiRequestError?e.message:t("teams.loadError"));
    }).finally(()=>{if(active)setLoadingTeams(false);});
    setMetadataError(false);
    void Promise.allSettled([
      authApi.roleSubscriptions(token),
      teamApi.capacity(token),
    ]).then(([offers,quota])=>{
      if(!active)return;
      setOffer(offers.status==="fulfilled"
        ?offers.value.offers.find(item=>item.role==="TEAM_MANAGER")??null:null);
      setCapacity(quota.status==="fulfilled"?quota.value:null);
      setMetadataError(offers.status==="rejected"||quota.status==="rejected");
    });
    return()=>{active=false;};
  },[token,userId,teamListRefresh,t]));

  // Prevent previous-account identity, private data and form drafts from leaking.
  useEffect(()=>{
    setTeams([]);setTeamsActor(null);setSelectedId(null);
    setTeam(null);setOverview(null);setLoadedTeamKey(null);
    setRequests([]);setInvitations([]);setUnread(0);
    setOffer(null);setCapacity(null);
    setListError(null);setDetailsError(null);
    setMetadataError(false);setAttentionError(false);setAttentionKey(null);
    setAttentionLoaded({requests:false,invitations:false,notifications:false});
    setTab("overview");setLastAboutTeamTab("players");setPaymentRef("");
    setOverviewOps(null);setOverviewOpsKey(null);setOverviewOpsErrorKey(null);
    setLineupFocus(null);
    setPlayerSection("ROSTER");setPlayerSearch("");setPlayerPosition("ALL");
    setRequestHistory(false);setInviteHistory(false);setGuestToRemove(null);
  },[userId]);

  // Reset per-team drafts while preserving the chosen dashboard destination.
  useEffect(()=>{
    setTeam(null);setOverview(null);setLoadedTeamKey(null);
    setOverviewOps(null);setOverviewOpsKey(null);setOverviewOpsErrorKey(null);
    setLineupFocus(null);
    setRequests([]);setInvitations([]);setUnread(0);
    setAttentionLoaded({requests:false,invitations:false,notifications:false});
    setAttentionError(false);setAttentionKey(null);setDetailsError(null);
    setJoinAction(null);setJoinActionError(null);
    setInviteIdentifier("");setInviteRole("PLAYER");
    setCoverPreview(null);setShowVenues(false);setVenueSearch("");setVenues([]);
    setName("");setCity("");setLogoUrl("");setPrivacy("PUBLIC");setProfile(initialProfile);
    setError(null);setMessage(null);resetGuest();
    setPlayerSection("ROSTER");setPlayerSearch("");setPlayerPosition("ALL");
    setRequestHistory(false);setInviteHistory(false);setGuestToRemove(null);
  },[selectedId]);

  useEffect(()=>{
    let active=true;
    if(!token||!selectedId){
      setTeam(null);setOverview(null);setLoadedTeamKey(null);setLoading(false);
      return()=>{active=false;};
    }
    const key=token+":"+selectedId;
    setLoading(true);setDetailsError(null);
    // Rosters and overview are necessary for the team dashboard. Failure is
    // explicitly recoverable, rather than leaving a permanent loading skeleton.
    void Promise.allSettled([
      teamApi.roster(token,selectedId),
      teamManagerApi.overview(token,selectedId),
    ]).then(([roster,summary])=>{
      if(!active)return;
      if(roster.status!=="fulfilled"||summary.status!=="fulfilled"){
        const cause=roster.status==="rejected"?roster.reason:
          summary.status==="rejected"?summary.reason:null;
        setTeam(null);setOverview(null);setLoadedTeamKey(null);
        setDetailsError({key,message:cause instanceof ApiRequestError?cause.message:t("tm1.loadError")});
        return;
      }
      setTeam(roster.value.team);setOverview(summary.value);setProfile(summary.value.profile);
      setName(roster.value.team.name);setCity(roster.value.team.city);
      setLogoUrl(roster.value.team.logoUrl??"");setPrivacy(roster.value.team.privacy);
      setLoadedTeamKey(key);
    }).finally(()=>{if(active)setLoading(false);});

    // Notifications, requests and invitations do not gate team management.
    setAttentionLoaded({requests:false,invitations:false,notifications:false});
    setAttentionError(false);setAttentionKey(null);
    void Promise.allSettled([
      teamApi.joinRequests(token,selectedId),
      teamApi.teamInvitations(token,selectedId),
      notificationApi.list(token,{limit:5}),
    ]).then(([joined,invited,notifications])=>{
      if(!active)return;
      setRequests(joined.status==="fulfilled"?joined.value.requests:[]);
      setInvitations(invited.status==="fulfilled"?invited.value.invitations:[]);
      setUnread(notifications.status==="fulfilled"?notifications.value.unreadCount:0);
      setAttentionLoaded({
        requests:joined.status==="fulfilled",
        invitations:invited.status==="fulfilled",
        notifications:notifications.status==="fulfilled",
      });
      setAttentionError([joined,invited,notifications].some(item=>item.status==="rejected"));
      setAttentionKey(key);
    });
    return()=>{active=false;};
  },[token,selectedId,refresh,t]);

  // Overview operations support the action center; failure must not block
  // identity, official record, next-match metadata or roster management.
  useEffect(()=>{
    let active=true;
    if(!token||!selectedId||tab!=="overview")return()=>{active=false;};
    const key=token+":"+selectedId;
    setOverviewOps(null);setOverviewOpsKey(null);setOverviewOpsErrorKey(null);
    void teamOperationsApi.list(token,selectedId).then(value=>{
      if(!active)return;
      setOverviewOps(value);setOverviewOpsKey(key);
    }).catch(()=>{
      if(active)setOverviewOpsErrorKey(key);
    });
    return()=>{active=false;};
  },[token,selectedId,tab,refresh,overviewOpsReload]);

  useEffect(()=>{
    if(!showVenues)return;
    let active=true;
    void venueApi.list(venueSearch?{q:venueSearch}:undefined).then(result=>{if(active)setVenues(result.venues);})
      .catch(()=>{if(active)setVenues([]);});
    return()=>{active=false;};
  },[showVenues,venueSearch]);

  async function respondToPlayerRequest(requestId:string,accept:boolean){
    if(!token||!team||busy)return;
    setBusy(true);
    setJoinAction({requestId,accept});
    setJoinActionError(null);
    setError(null);
    setMessage(null);
    const teamIdAtStart=team.id;
    try{
      const {request:updated}=await teamApi.respondJoinRequest(token,teamIdAtStart,requestId,accept);
      if(selectedTeamRef.current!==teamIdAtStart)return;
      setRequests(current=>current.map(item=>item.id===updated.id?updated:item));
      setMessage(t("tm1.saved"));
      setRefresh(v=>v+1);
    }catch(e){
      if(selectedTeamRef.current===teamIdAtStart)
        setJoinActionError({requestId,message:e instanceof ApiRequestError?e.message:t("tm1.actionFailed")});
    }finally{
      setBusy(false);
      setJoinAction(null);
    }
  }

  async function perform(fn:()=>Promise<unknown>,after?:()=>void){
    if(busy)return;
    const teamIdAtStart=selectedTeamRef.current;
    setBusy(true);setError(null);setMessage(null);
    try{
      await fn();
      if(selectedTeamRef.current!==teamIdAtStart)return;
      after?.();setMessage(t("tm1.saved"));setRefresh(value=>value+1);
    }catch(e){
      if(selectedTeamRef.current===teamIdAtStart)
        setError(e instanceof ApiRequestError?e.message:t("tm1.actionFailed"));
    }finally{setBusy(false);}
  }
  async function requestSlot(slotId?:string){
    if(!token||slotBusy)return;
    setSlotBusy(true);setError(null);
    try{
      await teamApi.requestSlot(token,paymentRef.trim(),slotId);
      setMessage(t("tmBilling.requestSent"));
      setCapacity(await teamApi.capacity(token));
    }catch(e){setError(e instanceof ApiRequestError?e.message:t("tmBilling.requestError"));}
    finally{setSlotBusy(false);}
  }
  // The team-scoped server license is authoritative, even if billing read fails.
  const teamKey=token&&selectedId?token+":"+selectedId:null;
  const canWrite=loadedTeamKey===teamKey&&overview?.canWrite===true;
  const visibleTeams=teamsActor===token?teams:[];
  const attentionReady=attentionKey===teamKey;
  const pending=requests.filter(item=>item.status==="PENDING");
  const outstanding=invitations.filter(item=>item.status==="PENDING");
  const playersMatching=team?.members.filter(member=>
    (playerPosition==="ALL"||member.position===playerPosition)&&
    (member.publicDisplayName.toLocaleLowerCase().includes(playerSearch.trim().toLocaleLowerCase())||
      (member.shirtNumber!==null&&String(member.shirtNumber).includes(playerSearch.trim())))
  )??[];
  const requestRows=requestHistory?requests.filter(item=>item.status!=="PENDING"):pending;
  const invitationRows=inviteHistory?invitations.filter(item=>item.status!=="PENDING"):outstanding;
  const openPlayerSection=(section:typeof playerSection)=>{
    setPlayerSection(section);
    chooseTab("players");
  };
  const updateProfile=(key:keyof TeamManagerProfileDetails,value:string|boolean|null)=>
    setProfile(previous=>({...previous,[key]:value}));
  const resetGuest=()=>{setGuestName("");setGuestPosition("UNSPECIFIED");setGuestJersey("");setEditingGuest(null);};
  const editGuest=(guest:TeamGuestPlayer)=>{setEditingGuest(guest.id);setGuestName(guest.name);
    setGuestPosition(guest.position as Position);setGuestJersey(guest.shirtNumber===null?"":String(guest.shirtNumber));};
  const parsedJersey=guestJersey.trim()===""?null:Number(guestJersey);
  const validJersey=parsedJersey===null||(Number.isInteger(parsedJersey)&&parsedJersey>=1&&parsedJersey<=99);
  const foundedOk=!profile.foundedOn||/^\d{4}-\d{2}-\d{2}$/.test(profile.foundedOn)&&
    !Number.isNaN(Date.parse(profile.foundedOn+"T00:00:00Z"))&&
    new Date(profile.foundedOn+"T00:00:00Z").toISOString().slice(0,10)===profile.foundedOn;
  const colorOk=(value:string|null)=>!value||/^#[0-9a-fA-F]{6}$/.test(value);
  const whatsappOk=!profile.whatsappGroupUrl||isWhatsAppGroupInviteLink(profile.whatsappGroupUrl);
  async function chooseCover(){
    if(!token||!selectedId||!canWrite||coverBusy)return;
    const teamIdAtStart=selectedId;
    setError(null);
    try{
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted){setError(t("teams.phase3.coverPermission"));return;}
      const picked=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:["images"],allowsEditing:true,aspect:[16,6],
        quality:.82,selectionLimit:1,
      });
      if(picked.canceled||!picked.assets[0])return;
      setCoverBusy(true);
      const asset=picked.assets[0];
      const result=await marketingApi.uploadUserPostImage(token,{
        uri:asset.uri,mimeType:asset.mimeType??"image/jpeg",
        ...(asset.fileSize!==undefined?{size:asset.fileSize}:{}),
      });
      if(selectedTeamRef.current!==teamIdAtStart)return;
      setProfile(previous=>({...previous,coverImageUrl:result.imageUrl}));
      setCoverPreview({url:result.imageUrl,uri:asset.uri});
    }catch(cause){
      if(selectedTeamRef.current===teamIdAtStart)setError(cause instanceof ApiRequestError?
        cause.message:t("teams.phase3.coverError"));
    }finally{setCoverBusy(false);}
  }
  const saveTeam=()=>perform(async()=>{
    await teamApi.update(token!,selectedId!,{name:name.trim(),city:city.trim(),logoUrl:logoUrl.trim(),privacy});
    await teamManagerApi.updateProfile(token!,selectedId!,profile);
    setTeamListRefresh(v=>v+1);
  });
  const saveGuest=()=>perform(async()=>{
    const input={name:guestName.trim(),position:guestPosition,shirtNumber:parsedJersey};
    if(editingGuest)await teamManagerApi.updateGuest(token!,selectedId!,editingGuest,input);
    else await teamManagerApi.addGuest(token!,selectedId!,input);
  },resetGuest);

  if(loadingTeams&&teamsActor!==token)return <Screen showHeader><DataLoadingState variant="dashboard" minHeight={500}/></Screen>;
  return <Screen showHeader>
    <ScrollView ref={navRef} horizontal style={styles.nav} showsHorizontalScrollIndicator={false}
      accessibilityLabel={t("tmnav.mainNavigation")}
      onLayout={e=>{navViewport.current=e.nativeEvent.layout.width;focusTab(activeMain);}}
      onContentSizeChange={width=>{navWidth.current=width;focusTab(activeMain);}}
      contentContainerStyle={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,paddingHorizontal:spacing.xs,alignItems:"center"}}>
      {mainTabs.map(item=><Pressable key={item.id} accessibilityRole="tab"
        accessibilityLabel={t(item.key)} accessibilityState={{selected:activeMain===item.id}}
        onLayout={(event:LayoutChangeEvent)=>{navCells.current[item.id]=event.nativeEvent.layout;if(activeMain===item.id)focusTab(item.id);}}
        onPress={()=>chooseMainTab(item.id)} style={[styles.navItem,activeMain===item.id&&styles.navActive]}>
        <Ionicons name={item.icon} size={18} color={activeMain===item.id?colors.primary:colors.textMuted}/>
        <AppText variant="caption" weight="semibold" style={activeMain===item.id?{color:colors.primary}:undefined}>{t(item.key)}</AppText>
      </Pressable>)}
    </ScrollView>
    {activeMain==="aboutTeam"?<ScrollView ref={subNavRef} horizontal style={styles.subNav}
      accessibilityLabel={t("tmnav.subNavigation")}
      showsHorizontalScrollIndicator={false}
      onLayout={e=>{subNavViewport.current=e.nativeEvent.layout.width;if(isAboutTeamSection(tab))focusSubTab(tab);}}
      onContentSizeChange={width=>{subNavWidth.current=width;if(isAboutTeamSection(tab))focusSubTab(tab);}}
      contentContainerStyle={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.xs,paddingHorizontal:spacing.xs,alignItems:"center"}}>
      {aboutTeamTabs.map(item=><Pressable key={item.id} accessibilityRole="tab"
        accessibilityLabel={t(item.key)} accessibilityState={{selected:tab===item.id}}
        onLayout={(event:LayoutChangeEvent)=>{subNavCells.current[item.id]=event.nativeEvent.layout;if(tab===item.id)focusSubTab(item.id);}}
        onPress={()=>chooseTab(item.id)} style={[styles.subItem,tab===item.id&&styles.subActive]}>
        <Ionicons name={item.icon} size={16} color={tab===item.id?colors.primary:colors.textMuted}/>
        <AppText variant="caption" weight="semibold" style={tab===item.id?{color:colors.primary}:undefined}>{t(item.key)}</AppText>
      </Pressable>)}
    </ScrollView>:null}

    {listError?<Card style={styles.problemCard}>
      <AppText style={{color:colors.danger}}>{listError}</AppText>
      <Button variant="secondary" label={t("common.retry")} onPress={()=>setTeamListRefresh(x=>x+1)}/>
    </Card>:null}
    {(metadataError||attentionError)&&!listError?<Card style={styles.noticeCard}>
      <AppText variant="caption" muted>{t("tm1.partialData")}</AppText>
      <Button variant="secondary" label={t("common.retry")}
        onPress={()=>{setTeamListRefresh(x=>x+1);setRefresh(x=>x+1);}}/>
    </Card>:null}
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button variant="secondary" label={t("common.retry")} onPress={()=>{setTeamListRefresh(x=>x+1);setRefresh(x=>x+1);}}/></Card>:null}
    {message?<Card style={{backgroundColor:colors.primarySoft}}><AppText style={{color:colors.primary}}>{message}</AppText></Card>:null}

    {visibleTeams.length===0&&!error&&!listError&&teamsActor===token?<Card style={{paddingVertical:spacing.xxl,alignItems:"center",gap:spacing.md}}>
      <Ionicons name="shield-checkmark-outline" size={54} color={colors.primary}/>
      <AppText variant="title" weight="bold" style={{textAlign:"center"}}>{t("tm1.welcome")}</AppText>
      <AppText muted style={{textAlign:"center"}}>{t("tm1.noTeam")}</AppText>
      <Button label={t("teams.createAction")} onPress={()=>router.push("/teams/create")}/>
      <Button variant="secondary" label={t("teams.invitationsTitle")} onPress={()=>router.push("/teams/invitations")}/>
      <Button variant="ghost" label={t("teams.title")} onPress={()=>router.push("/teams")}/>
    </Card>:null}
    {visibleTeams.length>0?<View style={{gap:spacing.sm}}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{gap:spacing.sm,alignItems:"center",flexDirection:isRTL?"row-reverse":"row"}}>
        {visibleTeams.map(item=><Pressable key={item.id} accessibilityRole="button"
          onPress={()=>{if(item.id!==selectedId)setSelectedId(item.id);}}
          disabled={busy||slotBusy||coverBusy}
          accessibilityState={{selected:item.id===selectedId,disabled:busy||slotBusy||coverBusy}}
          style={[styles.teamItem,item.id===selectedId&&styles.teamSelected]}>
          {item.logoUrl?<Image source={{uri:resolveMediaImageUrl(item.logoUrl)??item.logoUrl}} style={styles.teamIcon}/>:
            <Ionicons name="shield-outline" size={22} color={colors.primary}/>}
          <AppText weight="semibold" style={item.id===selectedId?{color:colors.primary}:undefined}>{item.name}</AppText>
        </Pressable>)}
      </ScrollView>
      {!canWrite&&!loading?<Card style={{borderColor:colors.warning}}>
        <AppText weight="bold" style={{color:colors.warning}}>{t("tm1.readOnly")}</AppText>
        <Button variant="secondary" label={t("tm1.manageSubscription")} onPress={()=>router.push("/role-subscriptions/team-owner")}/>
      </Card>:null}
    </View>:null}

    {detailsError?.key===teamKey&&visibleTeams.length>0?<Card style={styles.problemCard}>
      <AppText style={{color:colors.danger}}>{detailsError.message}</AppText>
      <Button variant="secondary" label={t("common.retry")} onPress={()=>setRefresh(x=>x+1)}/>
    </Card>:(loading||team?.id!==selectedId||loadedTeamKey!==teamKey||!overview)&&visibleTeams.length>0?
      <DataLoadingState variant="dashboard" minHeight={400}/>:team&&overview?<>
      {tab==="overview"?<TeamManagerOverviewPanel
        team={team} overview={overview}
        operations={overviewOpsKey===teamKey?overviewOps:null}
        operationsReady={overviewOpsKey===teamKey&&overviewOps!==null}
        operationsFailed={overviewOpsErrorKey===teamKey}
        onRetryOperations={()=>setOverviewOpsReload(value=>value+1)}
        pendingRequests={attentionReady&&attentionLoaded.requests?pending.length:null}
        pendingInvites={attentionReady&&attentionLoaded.invitations?outstanding.length:null}
        unreadNotifications={attentionReady&&attentionLoaded.notifications?unread:null}
        canWrite={canWrite} subscriptionStatus={offer?.status??null}
        subscriptionUntil={capacity?.slots.find(slot=>slot.teamId===team.id)?.activeUntil??offer?.activeUntil??null}
        onOpen={chooseTab}
        onPlayersSection={openPlayerSection}
        onLineup={id=>{setLineupFocus(id);chooseTab("matches");}}
      />:null}

      {tab==="players"?<View testID="tm-players-workspace" style={styles.playersWorkspace}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          testID="tm-players-subtabs" accessibilityLabel={t("tmPlayers.navigation")}
          contentContainerStyle={[styles.playersTabs,{flexDirection:isRTL?"row-reverse":"row"}]}>
          {([
            {id:"ROSTER",icon:"people-outline",label:t("tmPlayers.roster"),count:team.rosterCount},
            {id:"REQUESTS",icon:"person-add-outline",label:t("tmPlayers.requests"),
              count:attentionReady&&attentionLoaded.requests?pending.length:null},
            {id:"INVITATIONS",icon:"mail-outline",label:t("tmPlayers.invitations"),
              count:attentionReady&&attentionLoaded.invitations?outstanding.length:null},
            {id:"GUESTS",icon:"people-circle-outline",label:t("tmPlayers.guests"),count:overview.guests.length},
          ] as const).map(item=><Pressable key={item.id}
            testID={`tm-players-tab-${item.id}`} accessibilityRole="tab"
            accessibilityState={{selected:playerSection===item.id}}
            onPress={()=>setPlayerSection(item.id)}
            style={[styles.playersTab,playerSection===item.id&&styles.playersTabActive]}>
            <Ionicons name={item.icon} size={18} color={playerSection===item.id?colors.primary:colors.textMuted}/>
            <AppText weight="semibold" variant="caption"
              style={playerSection===item.id?{color:colors.primary}:undefined}>{item.label}</AppText>
            <View style={styles.playersCount}><AppText variant="caption" weight="bold"
              style={{color:colors.primary}}>{item.count??"—"}</AppText></View>
          </Pressable>)}
        </ScrollView>

        {playerSection==="ROSTER"?<Card testID="tm-players-roster" style={styles.playersCard}>
          <AppText variant="bodyLarge" weight="bold">{t("tmPlayers.roster")} ({team.rosterCount})</AppText>
          <TextField testID="tm-players-search" label={t("tmPlayers.search")}
            placeholder={t("tmPlayers.searchHint")} value={playerSearch}
            onChangeText={setPlayerSearch} maxLength={100}/>
          <AppText variant="caption" muted>{t("tmPlayers.positionFilter")}</AppText>
          <Options selected={playerPosition} onSelect={v=>setPlayerPosition(v as Position|"ALL")}
            items={[{id:"ALL",label:t("tmPlayers.allPositions")},...positions.map(id=>({
              id,label:t(`teams.position.${id}` as never),
            }))]}/>
          <AppText variant="caption" muted>{t("tmPlayers.results",{count:playersMatching.length})}</AppText>
          {!playersMatching.length?<View style={styles.playersEmpty}>
            <Ionicons name="search-outline" color={colors.textMuted} size={28}/>
            <AppText muted>{t("tmPlayers.noMatches")}</AppText>
            <Button label={t("tmPlayers.clearFilters")} variant="secondary"
              onPress={()=>{setPlayerSearch("");setPlayerPosition("ALL");}}/>
          </View>:null}
          {playersMatching.map(member=><View key={member.userId} style={styles.divider}>
            <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
              {member.imageUrl?<Image style={styles.avatar}
                source={{uri:resolveMediaImageUrl(member.imageUrl)??member.imageUrl}}/>:
                <View style={styles.avatar}><Ionicons name="person-outline" size={20} color={colors.primary}/></View>}
              <View style={{flex:1,gap:spacing.xs}}>
                <AppText weight="semibold">{member.publicDisplayName}{member.shirtNumber!==null?` · #${member.shirtNumber}`:""}</AppText>
                <AppText variant="caption" muted>
                  {t(`teams.position.${member.position}` as never)} · {t(`teams.role.${member.role}` as never)}
                </AppText>
              </View>
              {team.captainUserId===member.userId?<Ionicons name="star" size={20} color={colors.primary}/>:null}
            </View>
          </View>)}
          <Button label={t("tm1.manageMembers")} variant="secondary" onPress={()=>router.push({
            pathname:"/teams/[teamId]/manage",params:{teamId:team.id},
          })}/>
        </Card>:null}

        {playerSection==="REQUESTS"?<Card testID="tm-players-requests" style={styles.playersCard}>
          <AppText variant="bodyLarge" weight="bold">{t("tmPlayers.requests")}</AppText>
          <AppText variant="caption" muted>{t("teams.phase4.managerReviewHint")}</AppText>
          <View style={[styles.playersSegment,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Button label={t("tmPlayers.pending")} variant={!requestHistory?"primary":"secondary"}
              style={styles.playersSegmentButton} onPress={()=>setRequestHistory(false)}/>
            <Button label={t("tmPlayers.history")} variant={requestHistory?"primary":"secondary"}
              style={styles.playersSegmentButton} onPress={()=>setRequestHistory(true)}/>
          </View>
          {!(attentionReady&&attentionLoaded.requests)?<AppText muted>{t("tm1.partialData")}</AppText>:null}
          {attentionReady&&attentionLoaded.requests&&requestRows.length===0?
            <AppText muted>{requestHistory?t("tmPlayers.noHistory"):t("tm1.noRequests")}</AppText>:null}
          {requestRows.map(request=><View key={request.id} style={styles.divider}>
            <AppText weight="semibold">{request.requesterDisplayName}</AppText>
            <AppText variant="caption" muted>{formatCompetitionDateTime(request.createdAt,language)}</AppText>
            {request.status!=="PENDING"?<AppText variant="caption"
              style={{color:colors.primary}}>{t(`tmPlayers.requestStatus.${request.status}` as never)}</AppText>:null}
            {request.status==="PENDING"?<View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Button label={t("teams.accept")} style={styles.action} disabled={!canWrite||busy}
                loading={joinAction?.requestId===request.id&&joinAction.accept}
                onPress={()=>void respondToPlayerRequest(request.id,true)}/>
              <Button label={t("teams.decline")} style={styles.action} variant="secondary" disabled={!canWrite||busy}
                loading={joinAction?.requestId===request.id&&!joinAction.accept}
                onPress={()=>void respondToPlayerRequest(request.id,false)}/>
            </View>:null}
            {joinActionError?.requestId===request.id?
              <AppText style={{color:colors.danger}}>{joinActionError.message}</AppText>:null}
          </View>)}
        </Card>:null}

        {playerSection==="INVITATIONS"?<Card testID="tm-players-invitations" style={styles.playersCard}>
          <AppText variant="bodyLarge" weight="bold">{t("tmPlayers.invitations")}</AppText>
          <AppText variant="caption" muted>{t("tm1.consentHint")}</AppText>
          <View style={styles.playersInviteForm}>
            <TextField label={t("tm1.usernamePhone")} value={inviteIdentifier}
              onChangeText={setInviteIdentifier} autoCapitalize="none" maxLength={320}/>
            <AppText variant="caption" muted>{t("tmPlayers.inviteRole")}</AppText>
            <Options selected={inviteRole} onSelect={v=>setInviteRole(v as "PLAYER"|"CAPTAIN")}
              items={["PLAYER","CAPTAIN"].map(id=>({id,label:t(`teams.role.${id}` as never)}))}/>
            <Button testID="tm-players-send-invite" label={t("teams.invite")} loading={busy}
              disabled={!canWrite||busy||inviteIdentifier.trim().length<3}
              onPress={()=>void perform(()=>teamApi.invite(token!,team.id,{
                identifier:inviteIdentifier.trim(),role:inviteRole,
              }),()=>setInviteIdentifier(""))}/>
          </View>
          <View style={[styles.playersSegment,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Button label={t("tmPlayers.pending")} variant={!inviteHistory?"primary":"secondary"}
              style={styles.playersSegmentButton} onPress={()=>setInviteHistory(false)}/>
            <Button label={t("tmPlayers.history")} variant={inviteHistory?"primary":"secondary"}
              style={styles.playersSegmentButton} onPress={()=>setInviteHistory(true)}/>
          </View>
          {!(attentionReady&&attentionLoaded.invitations)?<AppText muted>{t("tm1.partialData")}</AppText>:null}
          {attentionReady&&attentionLoaded.invitations&&invitationRows.length===0?
            <AppText muted>{inviteHistory?t("tmPlayers.noHistory"):t("tm1.noInvites")}</AppText>:null}
          {invitationRows.map(inv=><View key={inv.id} style={styles.divider}>
            <AppText weight="semibold">{inv.invitedPublicDisplayName}</AppText>
            <AppText variant="caption" muted>
              {t(`teams.role.${inv.role}` as never)} · {formatCompetitionDateTime(inv.createdAt,language)}
            </AppText>
            <AppText variant="caption" style={{color:colors.primary}}>
              {t(`tmPlayers.invitationStatus.${inv.status}` as never)}
            </AppText>
            {inv.status==="PENDING"?<>
              <AppText variant="caption" muted>{t("tmPlayers.expires")}: {formatCompetitionDateTime(inv.expiresAt,language)}</AppText>
              <Button label={t("tm1.revoke")} variant="secondary" disabled={!canWrite||busy}
                onPress={()=>void perform(()=>teamApi.revokeInvitation(token!,team.id,inv.id))}/>
            </>:null}
          </View>)}
        </Card>:null}

        {playerSection==="GUESTS"?<Card testID="tm-players-guests" style={styles.playersCard}>
          <AppText variant="bodyLarge" weight="bold">{t("tm1.temporaryPlayers")} ({overview.guests.length})</AppText>
          <View style={styles.playersGuestNotice}>
            <Ionicons name="information-circle-outline" size={22} color={colors.primary}/>
            <AppText style={{flex:1}} variant="caption" muted>{t("tm1.guestHint")}</AppText>
          </View>
          <View style={styles.playersGuestForm}>
            <AppText variant="bodyLarge" weight="semibold">
              {editingGuest?t("tmPlayers.editGuest"):t("tm1.addGuest")}
            </AppText>
            <TextField label={t("tm1.playerName")} value={guestName}
              onChangeText={setGuestName} maxLength={100}/>
            <AppText variant="caption" muted>{t("tm1.position")}</AppText>
            <Options selected={guestPosition} onSelect={v=>setGuestPosition(v as Position)}
              items={positions.map(id=>({id,label:t(`teams.position.${id}` as never)}))}/>
            <TextField label={t("teams.shirtNumber")} value={guestJersey}
              onChangeText={setGuestJersey} keyboardType="number-pad" forceLtr maxLength={2}/>
            {!validJersey?<AppText variant="caption" style={{color:colors.danger}}>
              {t("teams.shirtNumberInvalid")}
            </AppText>:null}
            <Button label={editingGuest?t("common.save"):t("tm1.addGuest")} loading={busy}
              disabled={!canWrite||busy||guestName.trim().length<2||!validJersey}
              onPress={()=>void saveGuest()}/>
            {editingGuest?<Button label={t("common.cancel")} variant="ghost" onPress={resetGuest}/>:null}
          </View>
          {overview.guests.length===0?<AppText muted>{t("tmPlayers.noGuests")}</AppText>:null}
          {overview.guests.map(guest=><View key={guest.id} style={styles.divider}>
            <AppText weight="semibold">{guest.name}{guest.shirtNumber!==null?` · #${guest.shirtNumber}`:""}</AppText>
            <AppText variant="caption" muted>{t(`teams.position.${guest.position}` as never)}</AppText>
            <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Button label={t("tm1.edit")} variant="secondary" style={styles.action}
                disabled={!canWrite||busy} onPress={()=>editGuest(guest)}/>
              <Button label={t("tm1.remove")} variant="ghost" style={styles.action}
                disabled={!canWrite||busy} onPress={()=>setGuestToRemove(guest.id)}/>
            </View>
            {guestToRemove===guest.id?<View testID="tm-guest-delete-confirm" style={styles.playersConfirmation}>
              <AppText weight="semibold">{t("tmPlayers.confirmRemoveGuest")}</AppText>
              <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <Button label={t("tm1.remove")} variant="danger" style={styles.action}
                  loading={busy} disabled={!canWrite||busy}
                  onPress={()=>void perform(()=>teamManagerApi.deleteGuest(token!,team.id,guest.id),
                    ()=>{setGuestToRemove(null);if(editingGuest===guest.id)resetGuest();})}/>
                <Button label={t("common.cancel")} variant="secondary" style={styles.action}
                  onPress={()=>setGuestToRemove(null)}/>
              </View>
            </View>:null}
          </View>)}
        </Card>:null}
      </View>:null}

      {(tab==="competitions"||tab==="matches"||tab==="schedule")&&token?<TeamCompetitionOps
        tab={tab} team={team} token={token} canWrite={canWrite} onSelectTab={chooseTab}
        focusMatchId={lineupFocus} onConsumedFocus={()=>setLineupFocus(null)}/>:null}

      {(tab==="media"||tab==="statistics"||tab==="matches")&&token?
        <TeamGrowthPanel tab={tab} team={team} token={token} canWrite={canWrite}/>:null}

      {tab==="settings"?<>
        <Card>
          <AppText variant="bodyLarge" weight="bold">{t("tmBilling.subscriptionPerTeam")}</AppText>
          <AppText variant="caption" muted>{t("tmBilling.policy")}</AppText>
          <AppText variant="caption" muted>{t("tmBilling.ownedTeams")}: {capacity?.ownedTeams??visibleTeams.length}</AppText>
          <AppText variant="caption" muted>{t("tmBilling.price")}: {capacity?.monthlyPriceAfn??300} AFN/{t("roles.month")}</AppText>
          {(capacity?.slots??[]).filter(slot=>slot.teamId).map(slot=><View key={slot.id} style={styles.divider}>
            <AppText weight="semibold">{slot.teamName??t("tmBilling.additionalTitle")}</AppText>
            <AppText variant="caption" muted>{t("tmBilling.status")}: {slot.status}</AppText>
            <AppText variant="caption" muted>{t("tm1.expires")}: {date(slot.activeUntil)}</AppText>
            {slot.status==="EXPIRED"||slot.status==="CANCELLED"?<Button
              label={t("tmBilling.renew")} disabled={slotBusy} loading={slotBusy}
              onPress={()=>void requestSlot(slot.id)}/>:null}
          </View>)}
          {(capacity?.slots??[]).filter(slot=>!slot.teamId).map(slot=><View key={slot.id} style={styles.divider}>
            <AppText variant="caption" muted>{t("tmBilling.status")}: {slot.status}</AppText>
            <AppText variant="caption" muted>{t("tm1.expires")}: {date(slot.activeUntil)}</AppText>
          </View>)}
          <TextField label={t("roles.paymentReference")} value={paymentRef} onChangeText={setPaymentRef}/>
          <Button label={t("tmBilling.requestExtra")} variant="secondary"
            disabled={!capacity?.baseActive||slotBusy} loading={slotBusy}
            onPress={()=>void requestSlot()}/>
          <Button label={t("tm1.newTeam")} onPress={()=>router.push("/teams/create")}/>
          <AppText variant="caption" muted>{t("tmBilling.approvalHint")}</AppText>
        </Card>

        <Card><AppText variant="bodyLarge" weight="bold">{t("tm1.teamIdentity")}</AppText>
          <TextField label={t("teams.name")} value={name} onChangeText={setName}/>
          <TextField label={t("teams.city")} value={city} onChangeText={setCity}/>
          <TextField label={t("teams.logoUrl")} value={logoUrl} onChangeText={setLogoUrl} autoCapitalize="none" forceLtr/>
          <View testID="team-cover-settings" style={styles.coverSettings}>
            <AppText weight="semibold">{t("teams.phase3.coverTitle")}</AppText>
            <View style={styles.coverPreview}>
              {profile.coverImageUrl?<Image
                source={{uri:coverPreview?.url===profile.coverImageUrl?coverPreview.uri:
                  resolveMediaImageUrl(profile.coverImageUrl)??""}}
                resizeMode="cover" style={{width:"100%",height:"100%"}}/>:
                <View style={styles.coverEmpty}>
                  <Ionicons name="image-outline" size={29} color={colors.textMuted}/>
                  <AppText variant="caption" muted>{t("teams.phase3.coverEmpty")}</AppText>
                </View>}
            </View>
            <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row",flexWrap:"wrap"}]}>
              <Button label={t("teams.phase3.chooseCover")} variant="secondary"
                disabled={!canWrite||coverBusy||busy} loading={coverBusy}
                onPress={()=>void chooseCover()}/>
              {profile.coverImageUrl?<Button label={t("teams.phase3.removeCover")} variant="secondary"
                disabled={!canWrite||coverBusy||busy} onPress={()=>{
                  setProfile(v=>({...v,coverImageUrl:null}));setCoverPreview(null);
                }}/>:null}
            </View>
            <AppText variant="caption" muted>{t("teams.phase3.coverHint")}</AppText>
          </View>
          <TextField label={t("tm1.province")} value={profile.province??""} onChangeText={v=>updateProfile("province",v||null)}/>
          <TextField label={t("tm1.district")} value={profile.district??""} onChangeText={v=>updateProfile("district",v||null)}/>
          <TextField label={t("tm1.description")} value={profile.description??""} onChangeText={v=>updateProfile("description",v||null)} multiline/>
          <TextField label={t("tm1.foundedOn")} value={profile.foundedOn??""}
            onChangeText={v=>updateProfile("foundedOn",v||null)} placeholder="YYYY-MM-DD" forceLtr/>
          <TextField label={t("tm1.primaryColor")} value={profile.primaryColor??""}
            onChangeText={v=>updateProfile("primaryColor",v||null)} placeholder="#155EEF" forceLtr/>
          <TextField label={t("tm1.secondaryColor")} value={profile.secondaryColor??""}
            onChangeText={v=>updateProfile("secondaryColor",v||null)} placeholder="#FFFFFF" forceLtr/>
          <TextField label={t("tm1.contactPhone")} value={profile.contactPhone??""} keyboardType="phone-pad"
            onChangeText={v=>updateProfile("contactPhone",v||null)} forceLtr/>
          <AppText weight="semibold">{t("teams.privacy")}</AppText>
          <Options selected={privacy} onSelect={v=>setPrivacy(v as TeamPrivacy)}
            items={["PUBLIC","PRIVATE"].map(id=>({id,label:t(`teams.privacy.${id}` as never)}))}/>
          <Button label={t("common.save")} loading={busy}
            disabled={!canWrite||coverBusy||name.trim().length<2||city.trim().length<2||!foundedOk||!colorOk(profile.primaryColor)||!colorOk(profile.secondaryColor)||!whatsappOk}
            onPress={()=>void saveTeam()}/>
          <AppText variant="caption" muted>{t("tm1.publicHint")}</AppText>
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm1.publicProfile")}</AppText>
          <Button label={t("teams.viewTeam")} variant="secondary" onPress={()=>router.push({
            pathname:"/teams/[teamId]",params:{teamId:team.id},
          })}/>
        </Card>

        <Card><AppText variant="bodyLarge" weight="bold">{t("tm1.membershipSettings")}</AppText>
          <AppText variant="caption" muted>{t("tm1.allowRequestsHint")}</AppText>
          <Options selected={profile.allowJoinRequests?"YES":"NO"}
            onSelect={v=>updateProfile("allowJoinRequests",v==="YES")}
            items={[{id:"YES",label:t("tm1.allowRequests")},{id:"NO",label:t("tm1.invitationOnly")}]}/>
          <Button label={t("common.save")} loading={busy} disabled={!canWrite}
            onPress={()=>void perform(()=>teamManagerApi.updateProfile(token!,team.id,profile))}/>
        </Card>
        <Card>
          <AppText variant="bodyLarge" weight="bold">{t("teamWhatsApp.title")}</AppText>
          <AppText variant="caption" muted>{t("teamWhatsApp.managerHint")}</AppText>
          <TextField label={t("teamWhatsApp.groupInviteUrl")}
            placeholder="https://chat.whatsapp.com/..."
            value={profile.whatsappGroupUrl??""}
            onChangeText={value=>updateProfile("whatsappGroupUrl",value.trim()?value:null)}
            maxLength={400} autoCapitalize="none" forceLtr/>
          {!whatsappOk?<AppText variant="caption" style={{color:colors.danger}}>
            {t("teamWhatsApp.invalid")}</AppText>:null}
          <AppText variant="caption" muted>{t("teamWhatsApp.privacyHint")}</AppText>
          <Button label={t("common.save")} disabled={!canWrite||!whatsappOk||busy}
            loading={busy} onPress={()=>void perform(()=>
              teamManagerApi.updateProfile(token!,team.id,profile))}/>
          {overview.profile.whatsappGroupUrl?<WhatsAppGroupButton url={overview.profile.whatsappGroupUrl}/>:null}
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm1.homeVenue")}</AppText>
          <AppText variant="caption" muted>{t("tm1.homeVenueHint")}</AppText>
          <Button variant="secondary" label={t("tm1.chooseVenue")} onPress={()=>setShowVenues(v=>!v)}/>
          {showVenues?<View style={{gap:spacing.sm}}>
            <TextField label={t("tm1.searchVenue")} value={venueSearch} onChangeText={setVenueSearch}/>
            <Button variant="ghost" label={t("tm1.clearVenue")} onPress={()=>updateProfile("homeVenueId",null)}/>
            {venues.slice(0,18).map(venue=><Pressable key={venue.id}
              accessibilityRole="button" style={[styles.option,venue.id===profile.homeVenueId&&styles.optionActive]}
              onPress={()=>{updateProfile("homeVenueId",venue.id);setShowVenues(false);}}>
              <AppText weight="semibold">{venue.name}</AppText>
              <AppText variant="caption" muted>{venue.city} · {venue.province}</AppText>
            </Pressable>)}
          </View>:null}
          <Button label={t("common.save")} disabled={!canWrite} loading={busy}
            onPress={()=>void perform(()=>teamManagerApi.updateProfile(token!,team.id,profile))}/>
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm1.subscription")}</AppText>
          <AppText>{t("tm1.status")}: {offer?.status??"—"}</AppText>
          <AppText variant="caption" muted>{t("tm1.expires")}: {date(offer?.activeUntil??null)}</AppText>
          <Button label={t("tm1.manageSubscription")} onPress={()=>router.push("/role-subscriptions/team-owner")}/>
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm1.permissions")}</AppText>
          <AppText variant="caption" muted>{t("tm1.permissionsHint")}</AppText>
          <Button label={t("tm1.manageMembers")} variant="secondary" onPress={()=>router.push({
            pathname:"/teams/[teamId]/manage",params:{teamId:team.id},
          })}/>
          <Button label={t("tm1.notifications")} variant="secondary" onPress={()=>router.push("/settings")}/>
        </Card>
      </>:null}
    </>:null}
  </Screen>;
}
const styles=StyleSheet.create({
  playersWorkspace:{gap:spacing.md},
  playersTabs:{gap:spacing.sm,paddingVertical:spacing.xs,paddingHorizontal:spacing.xs,alignItems:"center"},
  playersTab:{flexDirection:"row",alignItems:"center",gap:spacing.xs,minHeight:46,
    paddingHorizontal:spacing.sm,borderRadius:radius.md,borderWidth:1,
    borderColor:colors.border,backgroundColor:colors.surface},
  playersTabActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  playersCount:{minWidth:25,paddingHorizontal:spacing.xs,paddingVertical:spacing.xs,
    borderRadius:radius.pill,alignItems:"center",backgroundColor:colors.primarySoft},
  playersCard:{gap:spacing.md},
  playersEmpty:{alignItems:"center",gap:spacing.md,paddingVertical:spacing.lg},
  playersSegment:{gap:spacing.sm},
  playersSegmentButton:{flex:1,minWidth:0,paddingHorizontal:spacing.xs},
  playersInviteForm:{gap:spacing.sm,padding:spacing.md,borderRadius:radius.md,
    borderWidth:1,borderColor:colors.border,backgroundColor:colors.surfaceMuted},
  playersGuestForm:{gap:spacing.sm},
  playersGuestNotice:{flexDirection:"row",alignItems:"center",gap:spacing.sm,
    padding:spacing.md,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,
    backgroundColor:colors.primarySoft},
  playersConfirmation:{gap:spacing.sm,borderWidth:1,borderColor:colors.danger,
    borderRadius:radius.md,padding:spacing.md},
  problemCard:{gap:spacing.sm,borderColor:colors.danger},
  noticeCard:{gap:spacing.sm,borderColor:colors.warning},
  coverSettings:{gap:spacing.sm,paddingVertical:spacing.sm},
  coverPreview:{height:150,borderRadius:radius.md,overflow:"hidden",backgroundColor:colors.surfaceMuted},
  coverEmpty:{flex:1,alignItems:"center",justifyContent:"center",gap:spacing.sm},
  nav:{flexGrow:0,flexShrink:0,borderTopWidth:1,borderBottomWidth:1,
    borderTopColor:colors.border,borderBottomColor:colors.border,backgroundColor:colors.background,marginHorizontal:-spacing.xs},
  navItem:{flexDirection:"row",alignItems:"center",gap:spacing.xs,minHeight:48,
    paddingHorizontal:spacing.md,paddingVertical:spacing.xs,marginVertical:spacing.xs,
    borderWidth:1,borderColor:"transparent",borderBottomWidth:3,borderBottomColor:"transparent",
    borderRadius:radius.md,backgroundColor:colors.background},
  navActive:{borderBottomColor:colors.primary,borderColor:colors.primary,backgroundColor:colors.primarySoft},
  subNav:{flexGrow:0,flexShrink:0,borderBottomWidth:1,borderBottomColor:colors.border,
    backgroundColor:colors.surface,marginHorizontal:-spacing.xs},
  subItem:{flexDirection:"row",alignItems:"center",gap:spacing.xs,minHeight:44,
    paddingHorizontal:spacing.md,paddingVertical:spacing.xs,marginVertical:spacing.xs,
    borderWidth:1,borderColor:"transparent",borderBottomWidth:2,borderBottomColor:"transparent",
    borderRadius:radius.md},
  subActive:{borderBottomColor:colors.primary,borderColor:colors.primary,backgroundColor:colors.primarySoft},
  option:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,
    padding:spacing.md,backgroundColor:colors.surface,minHeight:40,justifyContent:"center"},
  optionActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  teamItem:{flexDirection:"row",alignItems:"center",gap:spacing.sm,padding:spacing.sm,
    borderWidth:1,borderColor:colors.border,borderRadius:radius.pill,backgroundColor:colors.surface},
  teamSelected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  teamIcon:{width:30,height:30,borderRadius:15},
  teamLogo:{width:64,height:64,borderRadius:radius.lg,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  avatar:{width:44,height:44,borderRadius:22,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  row:{flexDirection:"row",gap:spacing.md,alignItems:"center"},
  divider:{paddingTop:spacing.md,marginTop:spacing.sm,borderTopWidth:1,borderColor:colors.border,gap:spacing.xs},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  action:{flexGrow:1,flexBasis:"40%"},
});
