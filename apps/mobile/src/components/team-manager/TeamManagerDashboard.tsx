import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { RoleSubscriptionOfferDto, TeamDto, TeamInvitationDto, TeamJoinRequestDto, TeamListItemDto, TeamPrivacy, PublicVenueDto } from "@leaguekick/contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { ApiRequestError, authApi, notificationApi, resolveMediaImageUrl, teamApi, teamManagerApi, venueApi,
  type TeamGuestPlayer, type TeamManagerOverview, type TeamManagerProfileDetails, type TeamCapacity } from "../../lib/api";
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
  whatsappGroupUrl:null,
};

function Stat({value,label}:{value:number;label:string}){
  return <View style={styles.stat}><AppText variant="title" weight="bold" style={{color:colors.primary}}>{value}</AppText>
    <AppText variant="caption" muted style={{textAlign:"center"}}>{label}</AppText></View>;
}
function Options({items,selected,onSelect}:{items:{id:string;label:string}[];selected:string;onSelect:(id:string)=>void}){
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:spacing.sm}}>
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
  const [inviteIdentifier,setInviteIdentifier]=useState("");
  const [inviteRole,setInviteRole]=useState<"PLAYER"|"CAPTAIN">("PLAYER");
  const [guestName,setGuestName]=useState("");
  const [guestPosition,setGuestPosition]=useState<Position>("UNSPECIFIED");
  const [guestJersey,setGuestJersey]=useState("");
  const [editingGuest,setEditingGuest]=useState<string|null>(null);
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
    if(!token||!userId){setLoadingTeams(false);return()=>{active=false;};}
    setLoadingTeams(true);
    void Promise.all([teamApi.mine(token),authApi.roleSubscriptions(token),teamApi.capacity(token)]).then(([mine,offers,quota])=>{
      if(!active)return;
      const owned=mine.teams.filter(item=>item.managerUserId===userId);
      setTeams(owned);
      setSelectedId(previous=>owned.some(item=>item.id===previous)?previous:owned[0]?.id??null);
      setOffer(offers.offers.find(item=>item.role==="TEAM_MANAGER")??null);
      setCapacity(quota);
      setError(null);
    }).catch(e=>{if(active)setError(e instanceof ApiRequestError?e.message:t("teams.loadError"));})
      .finally(()=>{if(active)setLoadingTeams(false);});
    return()=>{active=false;};
  },[token,userId,teamListRefresh,t]));

  useEffect(()=>{
    let active=true;
    if(!token||!selectedId){setTeam(null);setOverview(null);return()=>{active=false;};}
    setLoading(true);
    void Promise.all([
      teamApi.roster(token,selectedId),
      teamManagerApi.overview(token,selectedId),
      teamApi.joinRequests(token,selectedId),
      teamApi.teamInvitations(token,selectedId),
      notificationApi.list(token,{limit:5}),
    ]).then(([roster,summary,joined,invited,notifications])=>{
      if(!active)return;
      setTeam(roster.team);setOverview(summary);setProfile(summary.profile);
      setName(roster.team.name);setCity(roster.team.city);setLogoUrl(roster.team.logoUrl??"");
      setPrivacy(roster.team.privacy);setRequests(joined.requests);setInvitations(invited.invitations);
      setUnread(notifications.unreadCount);setError(null);
    }).catch(e=>{if(active){setOverview(null);setError(e instanceof ApiRequestError?e.message:t("tm1.loadError"));}})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[token,selectedId,refresh,t]);

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
    try{
      const {request:updated}=await teamApi.respondJoinRequest(token,team.id,requestId,accept);
      setRequests(current=>current.map(item=>item.id===updated.id?updated:item));
      setMessage(t("tm1.saved"));
      setRefresh(v=>v+1);
    }catch(e){
      setJoinActionError({requestId,message:e instanceof ApiRequestError?e.message:t("tm1.actionFailed")});
    }finally{
      setBusy(false);
      setJoinAction(null);
    }
  }

  async function perform(fn:()=>Promise<unknown>,after?:()=>void){
    if(busy)return;
    setBusy(true);setError(null);setMessage(null);
    try{await fn();after?.();setMessage(t("tm1.saved"));setRefresh(value=>value+1);}
    catch(e){setError(e instanceof ApiRequestError?e.message:t("tm1.actionFailed"));}
    finally{setBusy(false);}
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
  const canWrite=overview?.canWrite===true&&offer?.status==="ACTIVE";
  const pending=requests.filter(item=>item.status==="PENDING");
  const outstanding=invitations.filter(item=>item.status==="PENDING");
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

  if(loadingTeams)return <Screen showHeader><DataLoadingState variant="dashboard" minHeight={500}/></Screen>;
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

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button variant="secondary" label={t("common.retry")} onPress={()=>{setTeamListRefresh(x=>x+1);setRefresh(x=>x+1);}}/></Card>:null}
    {message?<Card style={{backgroundColor:colors.primarySoft}}><AppText style={{color:colors.primary}}>{message}</AppText></Card>:null}

    {teams.length===0&&!error?<Card style={{paddingVertical:spacing.xxl,alignItems:"center",gap:spacing.md}}>
      <Ionicons name="shield-checkmark-outline" size={54} color={colors.primary}/>
      <AppText variant="title" weight="bold" style={{textAlign:"center"}}>{t("tm1.welcome")}</AppText>
      <AppText muted style={{textAlign:"center"}}>{t("tm1.noTeam")}</AppText>
      <Button label={t("teams.createAction")} onPress={()=>router.push("/teams/create")}/>
      <Button variant="secondary" label={t("teams.invitationsTitle")} onPress={()=>router.push("/teams/invitations")}/>
      <Button variant="ghost" label={t("teams.title")} onPress={()=>router.push("/teams")}/>
    </Card>:null}
    {teams.length>0?<View style={{gap:spacing.sm}}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{gap:spacing.sm,alignItems:"center",flexDirection:isRTL?"row-reverse":"row"}}>
        {teams.map(item=><Pressable key={item.id} accessibilityRole="button"
          onPress={()=>{setSelectedId(item.id);resetGuest();}}
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

    {loading&&teams.length>0?<DataLoadingState variant="dashboard" minHeight={400}/>:team&&overview?<>
      {tab==="overview"?<>
        <Card><View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
          {team.logoUrl?<Image source={{uri:resolveMediaImageUrl(team.logoUrl)??team.logoUrl}} style={styles.teamLogo}/>:
            <View style={styles.teamLogo}><Ionicons name="shield-checkmark-outline" size={29} color={colors.primary}/></View>}
          <View style={{flex:1,gap:spacing.xs}}>
            <AppText variant="title" weight="bold">{team.name}</AppText>
            <AppText variant="caption" muted>{team.city} · {team.status}</AppText>
            <AppText variant="caption" style={{color:colors.primary}}>{t("tm1.subscription")}: {offer?.status??"—"}</AppText>
          </View>
        </View></Card>
        <View style={styles.stats}>
          <Stat label={t("tm1.registeredPlayers")} value={team.rosterCount}/>
          <Stat label={t("tm1.competitions")} value={overview.stats.competitions}/>
          <Stat label={t("tm1.matchesPlayed")} value={overview.stats.played}/>
          <Stat label={t("tm1.wins")} value={overview.stats.wins}/>
        </View>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm1.upcomingMatch")}</AppText>
          {overview.nextMatch?<><AppText weight="semibold">{team.name} · {overview.nextMatch.opponentName||t("tm1.unknownOpponent")}</AppText>
            <AppText muted variant="caption">{overview.nextMatch.competitionName} · {date(overview.nextMatch.startsAt)}</AppText>
            <Button variant="secondary" label={t("tm1.viewCompetition")} onPress={()=>router.push({
              pathname:"/competitions/[competitionId]",params:{competitionId:overview.nextMatch!.competitionId,tab:"MATCHES"},
            })}/></>:<AppText muted>{t("tm1.noUpcoming")}</AppText>}
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm1.quickActions")}</AppText>
          {overview.profile.whatsappGroupUrl?
            <WhatsAppGroupButton url={overview.profile.whatsappGroupUrl}/>:
            <Button label={t("teamWhatsApp.setup")} variant="secondary" onPress={()=>chooseTab("settings")}/>}
          <View style={styles.actions}>
            <Button label={t("tm1.invitePlayer")} variant="secondary" style={styles.action} onPress={()=>chooseTab("players")}/>
            <Button label={t("tm1.editTeam")} variant="secondary" style={styles.action} onPress={()=>chooseTab("settings")}/>
            <Button label={t("tm1.findCompetition")} variant="secondary" style={styles.action} onPress={()=>router.push("/competitions")}/>
            <Button label={t("tm1.bookVenue")} variant="secondary" style={styles.action} onPress={()=>router.push("/venues")}/>
          </View>
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm1.attention")}</AppText>
          <AppText muted>{t("tm1.pendingRequests")}: {pending.length} · {t("tm1.pendingInvites")}: {outstanding.length}</AppText>
          <AppText muted>{t("tm1.notifications")}: {unread}</AppText>
          <Button variant="ghost" label={t("tm1.notifications")} onPress={()=>router.push("/notifications")}/>
        </Card>
      </>:null}

      {tab==="players"?<>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm1.registeredPlayers")} ({team.rosterCount})</AppText>
          {team.members.map(member=><View key={member.userId} style={styles.divider}>
            <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
              {member.imageUrl?<Image style={styles.avatar} source={{uri:resolveMediaImageUrl(member.imageUrl)??member.imageUrl}}/>:
                <View style={styles.avatar}><Ionicons name="person-outline" size={20} color={colors.primary}/></View>}
              <View style={{flex:1}}>
                <AppText weight="semibold">{member.publicDisplayName}{member.shirtNumber?` · #${member.shirtNumber}`:""}</AppText>
                <AppText muted variant="caption">{t(`teams.role.${member.role}` as never)} · {t(`teams.position.${member.position}` as never)}</AppText>
              </View>
            </View>
          </View>)}
          <Button label={t("tm1.manageMembers")} variant="secondary" onPress={()=>router.push({
            pathname:"/teams/[teamId]/manage",params:{teamId:team.id},
          })}/>
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm1.invitePlayer")}</AppText>
          <TextField label={t("tm1.usernamePhone")} value={inviteIdentifier} onChangeText={setInviteIdentifier} autoCapitalize="none"/>
          <Options selected={inviteRole} onSelect={v=>setInviteRole(v as "PLAYER"|"CAPTAIN")}
            items={["PLAYER","CAPTAIN"].map(id=>({id,label:t(`teams.role.${id}` as never)}))}/>
          <Button label={t("teams.invite")} loading={busy} disabled={!canWrite||inviteIdentifier.trim().length<3}
            onPress={()=>void perform(()=>teamApi.invite(token!,team.id,{identifier:inviteIdentifier.trim(),role:inviteRole}),
              ()=>setInviteIdentifier(""))}/>
          <AppText variant="caption" muted>{t("tm1.consentHint")}</AppText>
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm1.pendingRequests")} ({pending.length})</AppText>
          {pending.length===0?<AppText muted>{t("tm1.noRequests")}</AppText>:null}
          {pending.map(request=><View key={request.id} style={styles.divider}>
            <AppText weight="semibold">{request.requesterDisplayName}</AppText>
            <View style={styles.actions}>
              <Button label={t("teams.accept")} style={styles.action} disabled={!canWrite||busy}
                loading={joinAction?.requestId===request.id&&joinAction.accept}
                onPress={()=>void respondToPlayerRequest(request.id,true)}/>
              <Button label={t("teams.decline")} style={styles.action} variant="secondary" disabled={!canWrite||busy}
                loading={joinAction?.requestId===request.id&&!joinAction.accept}
                onPress={()=>void respondToPlayerRequest(request.id,false)}/>
            </View>
            {joinActionError?.requestId===request.id?
              <AppText style={{color:colors.danger}}>{joinActionError.message}</AppText>:null}
          </View>)}
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm1.temporaryPlayers")} ({overview.guests.length})</AppText>
          <AppText variant="caption" muted>{t("tm1.guestHint")}</AppText>
          <TextField label={t("tm1.playerName")} value={guestName} onChangeText={setGuestName}/>
          <AppText weight="semibold">{t("tm1.position")}</AppText>
          <Options selected={guestPosition} onSelect={v=>setGuestPosition(v as Position)}
            items={positions.map(id=>({id,label:t(`teams.position.${id}` as never)}))}/>
          <TextField label={t("teams.shirtNumber")} value={guestJersey} onChangeText={setGuestJersey} keyboardType="number-pad" forceLtr/>
          <Button label={editingGuest?t("common.save"):t("tm1.addGuest")} loading={busy}
            disabled={!canWrite||guestName.trim().length<2||!validJersey} onPress={()=>void saveGuest()}/>
          {editingGuest?<Button label={t("common.cancel")} variant="ghost" onPress={resetGuest}/>:null}
          {overview.guests.map(guest=><View key={guest.id} style={styles.divider}>
            <AppText weight="semibold">{guest.name}{guest.shirtNumber?` · #${guest.shirtNumber}`:""}</AppText>
            <AppText variant="caption" muted>{t(`teams.position.${guest.position}` as never)}</AppText>
            <View style={styles.actions}>
              <Button label={t("tm1.edit")} variant="secondary" style={styles.action}
                disabled={!canWrite} onPress={()=>editGuest(guest)}/>
              <Button label={t("tm1.remove")} variant="ghost" style={styles.action}
                disabled={!canWrite||busy} onPress={()=>void perform(()=>teamManagerApi.deleteGuest(token!,team.id,guest.id))}/>
            </View>
          </View>)}
        </Card>
        <Card><AppText weight="bold">{t("tm1.pendingInvites")} ({outstanding.length})</AppText>
          {outstanding.length===0?<AppText muted>{t("tm1.noInvites")}</AppText>:null}
          {outstanding.map(inv=><View key={inv.id} style={styles.divider}>
            <AppText>{inv.invitedPublicDisplayName} · {t(`teams.role.${inv.role}` as never)}</AppText>
            <Button label={t("tm1.revoke")} variant="ghost" disabled={!canWrite||busy}
              onPress={()=>void perform(()=>teamApi.revokeInvitation(token!,team.id,inv.id))}/>
          </View>)}
        </Card>
      </>:null}

      {(tab==="competitions"||tab==="matches"||tab==="schedule")&&token?<TeamCompetitionOps tab={tab} team={team} token={token} canWrite={canWrite} onSelectTab={chooseTab}/>:null}

      {(tab==="media"||tab==="statistics"||tab==="matches")&&token?
        <TeamGrowthPanel tab={tab} team={team} token={token} canWrite={canWrite}/>:null}

      {tab==="settings"?<>
        <Card>
          <AppText variant="bodyLarge" weight="bold">{t("tmBilling.subscriptionPerTeam")}</AppText>
          <AppText variant="caption" muted>{t("tmBilling.policy")}</AppText>
          <AppText variant="caption" muted>{t("tmBilling.ownedTeams")}: {capacity?.ownedTeams??teams.length}</AppText>
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
            disabled={!canWrite||name.trim().length<2||city.trim().length<2||!foundedOk||!colorOk(profile.primaryColor)||!colorOk(profile.secondaryColor)||!whatsappOk}
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
  nav:{flexGrow:0,flexShrink:0,borderTopWidth:1,borderBottomWidth:1,
    borderTopColor:colors.border,borderBottomColor:colors.border,backgroundColor:colors.background,marginHorizontal:-spacing.xs},
  navItem:{flexDirection:"row",alignItems:"center",gap:spacing.xs,height:48,
    paddingHorizontal:spacing.md,borderBottomWidth:3,borderBottomColor:"transparent",
    backgroundColor:colors.background},
  navActive:{borderBottomColor:colors.primary,backgroundColor:colors.primarySoft},
  subNav:{flexGrow:0,flexShrink:0,borderBottomWidth:1,borderBottomColor:colors.border,
    backgroundColor:colors.surface,marginHorizontal:-spacing.xs},
  subItem:{flexDirection:"row",alignItems:"center",gap:spacing.xs,height:43,
    paddingHorizontal:spacing.md,borderBottomWidth:2,borderBottomColor:"transparent"},
  subActive:{borderBottomColor:colors.primary,backgroundColor:colors.primarySoft},
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
  stats:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  stat:{flexGrow:1,flexBasis:"21%",minWidth:70,alignItems:"center",
    gap:spacing.xs,padding:spacing.md,backgroundColor:colors.surface,
    borderWidth:1,borderColor:colors.border,borderRadius:radius.lg},
  divider:{paddingTop:spacing.md,marginTop:spacing.sm,borderTopWidth:1,borderColor:colors.border,gap:spacing.xs},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  action:{flexGrow:1,flexBasis:"40%"},
});
