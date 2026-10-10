import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { CompetitionListItemDto, RoleSubscriptionOfferDto, TeamDto, TeamInvitationDto, TeamJoinRequestDto, TeamListItemDto, TeamPrivacy } from "@leaguekick/contracts";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { ApiRequestError, authApi, competitionApi, marketingApi, notificationApi, resolveMediaImageUrl, teamApi, teamManagerApi, type TeamManagerWorkspace } from "../../lib/api";
import { formatCompetitionDateTime } from "../../lib/date-time";
import { useAuth } from "../../providers/AuthProvider";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DateTimePickerField } from "../ui/DateTimePickerField";
import { DataLoadingState } from "../ui/DataLoadingState";
import { Screen } from "../ui/Screen";
import { TextField } from "../ui/TextField";

const sections=[
  {id:"overview",icon:"grid-outline",key:"tm.overview"},
  {id:"team",icon:"shield-outline",key:"tm.team"},
  {id:"players",icon:"people-outline",key:"tm.players"},
  {id:"competitions",icon:"trophy-outline",key:"tm.competitions"},
  {id:"matches",icon:"football-outline",key:"tm.matches"},
  {id:"schedule",icon:"calendar-outline",key:"tm.schedule"},
  {id:"media",icon:"images-outline",key:"tm.media"},
  {id:"statistics",icon:"stats-chart-outline",key:"tm.statistics"},
  {id:"settings",icon:"settings-outline",key:"tm.settings"},
] as const;
type Section=(typeof sections)[number]["id"];
type Game=TeamManagerWorkspace["matches"][number];
const completed=(game:Game)=>game.status==="COMPLETED"||game.status==="CORRECTED";
const future=(game:Game)=>!completed(game)&&game.status!=="CANCELLED";
const positions=["UNSPECIFIED","GOALKEEPER","FIXO","ALA","PIVO","UNIVERSAL"] as const;
function badgeStatus(status:string){return status.replaceAll("_"," ");}
function gameResult(game:Game,teamId:string){
  if(game.homeScore===null||game.awayScore===null)return null;
  const home=game.homeTeamId===teamId;
  const scored=home?game.homeScore:game.awayScore;
  const conceded=home?game.awayScore:game.homeScore;
  return {scored,conceded,won:scored>conceded,draw:scored===conceded};
}
function openCompetition(id:string,tab?:string){
  router.push({pathname:"/competitions/[competitionId]",params:{competitionId:id,...(tab?{tab}:{})}});
}
function Tile({label,value}:{label:string;value:string|number}){
  return <View style={styles.stat}><AppText variant="title" weight="bold" style={{color:colors.primary}}>{value}</AppText>
    <AppText variant="caption" muted style={{textAlign:"center"}}>{label}</AppText></View>;
}
function SelectRow({options,selected,onSelect}:{options:readonly {key:string;label:string}[];selected:string;onSelect:(key:string)=>void}){
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:spacing.xs,paddingVertical:spacing.xs}}>
    {options.map(item=><Pressable key={item.key} accessibilityRole="button"
      accessibilityState={{selected:selected===item.key}} onPress={()=>onSelect(item.key)}
      style={[styles.chip,selected===item.key&&styles.chipOn]}>
      <AppText variant="caption" weight="semibold" style={selected===item.key?{color:colors.primary}:undefined}>{item.label}</AppText>
    </Pressable>)}
  </ScrollView>;
}

export function TeamManagerDashboard(){
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const token=session?.accessToken;
  const userId=session?.user.id;
  const [tab,setTab]=useState<Section>("overview");
  const [teams,setTeams]=useState<TeamListItemDto[]>([]);
  const [teamId,setTeamId]=useState<string|null>(null);
  const [team,setTeam]=useState<TeamDto|null>(null);
  const [workspace,setWorkspace]=useState<TeamManagerWorkspace|null>(null);
  const [offer,setOffer]=useState<RoleSubscriptionOfferDto|null>(null);
  const [joinRequests,setJoinRequests]=useState<TeamJoinRequestDto[]>([]);
  const [invitations,setInvitations]=useState<TeamInvitationDto[]>([]);
  const [unread,setUnread]=useState(0);
  const [directory,setDirectory]=useState<TeamListItemDto[]>([]);
  const [availableCompetitions,setAvailableCompetitions]=useState<CompetitionListItemDto[]>([]);
  const [loadingTeams,setLoadingTeams]=useState(true);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const [refresh,setRefresh]=useState(0);
  const [name,setName]=useState("");
  const [city,setCity]=useState("");
  const [logoUrl,setLogoUrl]=useState("");
  const [privacy,setPrivacy]=useState<TeamPrivacy>("PUBLIC");
  const [inviteId,setInviteId]=useState("");
  const [inviteRole,setInviteRole]=useState<"PLAYER"|"CAPTAIN">("PLAYER");
  const [guestName,setGuestName]=useState("");
  const [guestPosition,setGuestPosition]=useState<string>("UNSPECIFIED");
  const [guestShirt,setGuestShirt]=useState("");
  const [compFilter,setCompFilter]=useState("ALL");
  const [compSearch,setCompSearch]=useState("");
  const [matchFilter,setMatchFilter]=useState("UPCOMING");
  const [chosenMatch,setChosenMatch]=useState<string|null>(null);
  const [lineupStarts,setLineupStarts]=useState<string[]>([]);
  const [lineupSubs,setLineupSubs]=useState<string[]>([]);
  const [eventKind,setEventKind]=useState<"TRAINING"|"MEETING"|"FRIENDLY"|"OTHER">("TRAINING");
  const [eventName,setEventName]=useState("");
  const [eventDescription,setEventDescription]=useState("");
  const [eventPlace,setEventPlace]=useState("");
  const [eventStart,setEventStart]=useState("");
  const [eventEnd,setEventEnd]=useState("");
  const [postBody,setPostBody]=useState("");
  const [postImage,setPostImage]=useState("");
  const [imageUploading,setImageUploading]=useState(false);
  const [challenger,setChallenger]=useState("");
  const [challengeTime,setChallengeTime]=useState("");
  const [challengePlace,setChallengePlace]=useState("");
  const [showChallenge,setShowChallenge]=useState(false);
  const nav=useRef<ScrollView|null>(null);
  const viewport=useRef(0);
  const width=useRef(0);
  const layouts=useRef<Partial<Record<Section,{x:number;width:number}>>>({});

  const focus=useCallback((selected:Section,animated=false)=>{
    const layout=layouts.current[selected];if(!layout||!viewport.current)return;
    nav.current?.scrollTo({x:Math.max(0,Math.min(width.current-viewport.current,layout.x+layout.width/2-viewport.current/2)),y:0,animated});
  },[]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>focus(tab));return()=>cancelAnimationFrame(frame);},[tab,focus]);

  useFocusEffect(useCallback(()=>{
    let active=true;
    if(!token||!userId){setLoadingTeams(false);return()=>{active=false;};}
    setLoadingTeams(true);
    void Promise.all([teamApi.mine(token),authApi.roleSubscriptions(token)]).then(([list,subs])=>{
      if(!active)return;
      const owned=list.teams.filter(item=>item.managerUserId===userId);
      setTeams(owned);
      setTeamId(prev=>owned.some(x=>x.id===prev)?prev:owned[0]?.id??null);
      setOffer(subs.offers.find(x=>x.role==="TEAM_MANAGER")??null);
      setError(null);
    }).catch(e=>{if(active)setError(e instanceof ApiRequestError?e.message:t("teams.loadError"));})
      .finally(()=>{if(active)setLoadingTeams(false);});
    return()=>{active=false;};
  },[token,userId,t]));

  useEffect(()=>{
    let active=true;
    if(!teamId||!token){setTeam(null);setWorkspace(null);return()=>{active=false;};}
    setLoading(true);
    void Promise.all([
      teamApi.roster(token,teamId),
      teamManagerApi.workspace(token,teamId),
      teamApi.joinRequests(token,teamId).catch(()=>({requests:[] as TeamJoinRequestDto[]})),
      teamApi.teamInvitations(token,teamId).catch(()=>({invitations:[] as TeamInvitationDto[]})),
      notificationApi.list(token,{limit:5}).catch(()=>({unreadCount:0})),
    ]).then(([teamResult,data,requests,invites,notifications])=>{
      if(!active)return;
      setTeam(teamResult.team);setWorkspace(data);setJoinRequests(requests.requests);
      setInvitations(invites.invitations);setUnread(notifications.unreadCount);
      setName(teamResult.team.name);setCity(teamResult.team.city);
      setLogoUrl(teamResult.team.logoUrl??"");setPrivacy(teamResult.team.privacy);
      setError(null);
    }).catch(e=>{if(active){setError(e instanceof ApiRequestError?e.message:t("teams.loadError"));setWorkspace(null);}})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[token,teamId,refresh,t]);

  useEffect(()=>{
    if(tab!=="competitions"&&tab!=="matches")return;
    let active=true;
    void Promise.all([competitionApi.list(),token?teamApi.directory(token):Promise.resolve({teams:[]})])
      .then(([competitions,directoryTeams])=>{
        if(active){setAvailableCompetitions(competitions.competitions);setDirectory(directoryTeams.teams);}
      }).catch(()=>{});
    return()=>{active=false;};
  },[tab,token]);

  async function act(work:()=>Promise<unknown>,success=true){
    if(busy)return;
    setBusy(true);setError(null);setMessage(null);
    try{await work();if(success)setMessage(t("tm.saved"));setRefresh(x=>x+1);}
    catch(e){setError(e instanceof ApiRequestError?e.message:t("tm.actionFailed"));}
    finally{setBusy(false);}
  }
  const canWrite=workspace?.viewer.manager===true&&offer?.status==="ACTIVE";
  const competitions=workspace?.competitions??[];
  const games=workspace?.matches??[];
  const finished=games.filter(completed);
  const upcoming=games.filter(future).filter(x=>!!x.startsAt&&Date.parse(x.startsAt)>=Date.now())
    .sort((a,b)=>Date.parse(a.startsAt!)-Date.parse(b.startsAt!));
  const scores=finished.map(x=>gameResult(x,teamId??"")).filter((x):x is NonNullable<typeof x>=>x!==null);
  const stats={wins:scores.filter(x=>x.won).length,draws:scores.filter(x=>x.draw).length,losses:scores.filter(x=>!x.won&&!x.draw).length,
    scored:scores.reduce((n,x)=>n+x.scored,0),conceded:scores.reduce((n,x)=>n+x.conceded,0)};
  const pending=joinRequests.filter(x=>x.status==="PENDING");
  const sentInvitations=invitations.filter(x=>x.status==="PENDING");
  const teamName=team?.name??"";
  const date=(value:string|null)=>value?formatCompetitionDateTime(value,language):t("tm.notScheduled");
  const navTo=(next:Section)=>{setTab(next);focus(next,true);};
  const selectedGame=games.find(x=>x.id===chosenMatch);
  function editLineup(playerId:string,group:"start"|"sub"){
    setLineupStarts(old=>group==="start"?(old.includes(playerId)?old.filter(x=>x!==playerId):old.length>=5?old:[...old,playerId]):old.filter(x=>x!==playerId));
    setLineupSubs(old=>group==="sub"?(old.includes(playerId)?old.filter(x=>x!==playerId):[...old,playerId]):old.filter(x=>x!==playerId));
  }
  function openLineup(game:Game){
    setChosenMatch(game.id);
    const saved=workspace?.lineups.find(x=>x.matchId===game.id);
    setLineupStarts(saved?.startingUserIds??[]);setLineupSubs(saved?.substituteUserIds??[]);
  }

  if(loadingTeams)return <Screen showHeader><DataLoadingState variant="dashboard" minHeight={500}/></Screen>;

  return <Screen showHeader>
    <ScrollView ref={nav} horizontal showsHorizontalScrollIndicator={false} style={styles.nav}
      onLayout={e=>{viewport.current=e.nativeEvent.layout.width;focus(tab);}}
      onContentSizeChange={w=>{width.current=w;focus(tab);}}
      contentContainerStyle={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.xs,alignItems:"center",padding:spacing.xs}}>
      {sections.map(item=><Pressable key={item.id} accessibilityRole="tab" accessibilityState={{selected:tab===item.id}}
        onLayout={(e:LayoutChangeEvent)=>{layouts.current[item.id]=e.nativeEvent.layout;if(tab===item.id)focus(item.id);}}
        onPress={()=>navTo(item.id)} style={[styles.navItem,tab===item.id&&styles.navActive]}>
        <Ionicons name={item.icon} size={18} color={tab===item.id?colors.primary:colors.textMuted}/>
        <AppText variant="caption" weight="semibold" style={tab===item.id?{color:colors.primary}:undefined}>{t(item.key)}</AppText>
      </Pressable>)}
    </ScrollView>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button variant="secondary" label={t("common.retry")} onPress={()=>setRefresh(v=>v+1)}/></Card>:null}
    {message?<Card style={{backgroundColor:colors.primarySoft}}><AppText style={{color:colors.primary}}>{message}</AppText></Card>:null}

    {teams.length===0&&!error?<Card style={{alignItems:"center",gap:spacing.md,paddingVertical:spacing.xxl}}>
      <Ionicons name="shield-checkmark-outline" size={56} color={colors.primary}/>
      <AppText variant="title" weight="bold">{t("tm.welcome")}</AppText>
      <AppText muted style={{textAlign:"center"}}>{t("tm.noTeam")}</AppText>
      <Button label={t("teams.createAction")} onPress={()=>router.push("/teams/create")}/>
      <Button label={t("teams.invitationsTitle")} variant="secondary" onPress={()=>router.push("/teams/invitations")}/>
      <Button label={t("teams.title")} variant="ghost" onPress={()=>router.push("/teams")}/>
    </Card>:null}

    {teams.length>0?<View style={{gap:spacing.sm}}>
      <ScrollView horizontal contentContainerStyle={{gap:spacing.sm,alignItems:"center",flexDirection:isRTL?"row-reverse":"row"}}>
        {teams.map(item=><Pressable key={item.id} accessibilityRole="button"
          onPress={()=>{setTeamId(item.id);setChosenMatch(null);}} style={[styles.teamSelect,teamId===item.id&&styles.teamSelectOn]}>
          {item.logoUrl?<Image source={{uri:resolveMediaImageUrl(item.logoUrl)??item.logoUrl}} style={{width:30,height:30,borderRadius:15}}/>:
            <Ionicons name="shield-outline" size={24} color={colors.primary}/>}
          <AppText weight="semibold" style={teamId===item.id?{color:colors.primary}:undefined}>{item.name}</AppText>
        </Pressable>)}
        <Button label={t("tm.newTeam")} variant="secondary" onPress={()=>router.push("/teams/create")}/>
      </ScrollView>
      {offer?.status!=="ACTIVE"?<Card style={{borderColor:colors.warning}}>
        <AppText weight="bold" style={{color:colors.warning}}>{t("tm.readOnly")}</AppText>
        <Button label={t("tm.subscription")} variant="secondary" onPress={()=>router.push("/role-subscriptions/team-owner")}/>
      </Card>:null}
    </View>:null}

    {loading&&teams.length>0?<DataLoadingState variant="dashboard" minHeight={360}/>:team&&workspace?<>
      {tab==="overview"?<>
        <Card style={styles.hero}><View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
          {team.logoUrl?<Image style={styles.logo} source={{uri:resolveMediaImageUrl(team.logoUrl)??team.logoUrl}}/>:
            <View style={styles.logo}><Ionicons name="shield-checkmark" size={30} color={colors.primary}/></View>}
          <View style={{flex:1,gap:spacing.xs}}>
            <AppText variant="title" weight="bold">{teamName}</AppText>
            <AppText variant="caption" muted>{team.city} · {badgeStatus(team.status)}</AppText>
            <AppText variant="caption" style={{color:colors.primary}}>{t("tm.subscription")}: {offer?.status??"—"}</AppText>
          </View>
        </View></Card>
        <View style={styles.stats}><Tile label={t("tm.players")} value={team.rosterCount+(workspace.guests.length)}/>
          <Tile label={t("tm.competitions")} value={competitions.length}/>
          <Tile label={t("tm.played")} value={finished.length}/>
          <Tile label={t("tm.wins")} value={stats.wins}/></View>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.nextMatch")}</AppText>
          {upcoming[0]?<><AppText weight="bold">{teamName} · {upcoming[0].opponentName||t("tm.toBeDecided")}</AppText>
            <AppText muted>{upcoming[0].competitionName} · {date(upcoming[0].startsAt)}</AppText>
            <Button label={t("tm.viewMatch")} onPress={()=>openCompetition(upcoming[0]!.competitionId,"MATCHES")}/></>:
            <AppText muted>{t("tm.noUpcoming")}</AppText>}
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.quickActions")}</AppText>
          <View style={styles.actions}>
            <Button label={t("tm.invitePlayer")} style={styles.action} variant="secondary" onPress={()=>navTo("players")}/>
            <Button label={t("tm.findCompetition")} style={styles.action} variant="secondary" onPress={()=>navTo("competitions")}/>
            <Button label={t("tm.bookVenue")} style={styles.action} variant="secondary" onPress={()=>router.push("/venues")}/>
            <Button label={t("tm.createPost")} style={styles.action} variant="secondary" onPress={()=>navTo("media")}/>
          </View>
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.alerts")}</AppText>
          <AppText muted>{t("tm.pendingRequests")}: {pending.length} · {t("tm.pendingInvites")}: {sentInvitations.length} · {t("tm.notifications")}: {unread}</AppText>
          <Button label={t("tm.notifications")} variant="ghost" onPress={()=>router.push("/notifications")}/>
        </Card>
      </>:null}

      {tab==="team"?<>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.teamIdentity")}</AppText>
          <TextField label={t("teams.name")} value={name} onChangeText={setName}/>
          <TextField label={t("teams.city")} value={city} onChangeText={setCity}/>
          <TextField label={t("teams.logoUrl")} value={logoUrl} onChangeText={setLogoUrl} forceLtr autoCapitalize="none"/>
          <AppText weight="semibold">{t("teams.privacy")}</AppText>
          <SelectRow options={(["PUBLIC","PRIVATE"] as const).map(k=>({key:k,label:t(`teams.privacy.${k}` as never)}))}
            selected={privacy} onSelect={k=>setPrivacy(k as TeamPrivacy)}/>
          <Button label={t("common.save")} disabled={!canWrite||name.trim().length<2||city.trim().length<2}
            loading={busy} onPress={()=>void act(()=>teamApi.update(token!,teamId!,{name:name.trim(),city:city.trim(),logoUrl,privacy}))}/>
        </Card>
        <Card><AppText weight="bold">{t("tm.publicProfile")}</AppText>
          <Button label={t("teams.viewTeam")} variant="secondary" onPress={()=>router.push({pathname:"/teams/[teamId]",params:{teamId:team.id}})}/>
          <AppText variant="caption" muted>{t("tm.publicVsPrivate")}</AppText>
        </Card>
      </>:null}

      {tab==="players"?<>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.registeredPlayers")} ({team.rosterCount})</AppText>
          {team.members.map(member=><View key={member.userId} style={styles.divider}>
            <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
              {member.imageUrl?<Image source={{uri:resolveMediaImageUrl(member.imageUrl)??member.imageUrl}} style={styles.avatar}/>:
                <View style={styles.avatar}><Ionicons name="person-outline" size={18} color={colors.primary}/></View>}
              <View style={{flex:1}}>
                <AppText weight="bold">{member.publicDisplayName}{member.shirtNumber?` · #${member.shirtNumber}`:""}</AppText>
                <AppText variant="caption" muted>{member.position} · {member.role}</AppText>
              </View>
            </View>
          </View>)}
          <Button label={t("teams.manage")} onPress={()=>router.push({pathname:"/teams/[teamId]/manage",params:{teamId:team.id}})} variant="secondary"/>
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.invitePlayer")}</AppText>
          <TextField label={t("tm.usernameOrPhone")} value={inviteId} onChangeText={setInviteId} autoCapitalize="none"/>
          <SelectRow options={([{key:"PLAYER",label:t("teams.role.PLAYER")},{key:"CAPTAIN",label:t("teams.role.CAPTAIN")}])}
            selected={inviteRole} onSelect={v=>setInviteRole(v as "PLAYER"|"CAPTAIN")}/>
          <Button label={t("teams.invite")} loading={busy} disabled={!canWrite||inviteId.trim().length<3} onPress={()=>void act(async()=>{
            await teamApi.invite(token!,teamId!,{identifier:inviteId.trim(),role:inviteRole});
            setInviteId("");
          })}/>
          <AppText variant="caption" muted>{t("tm.inviteHelp")}</AppText>
        </Card>
        {pending.length?<Card><AppText weight="bold">{t("tm.pendingRequests")} ({pending.length})</AppText>
          {pending.map(request=><View key={request.id} style={styles.divider}>
            <AppText weight="semibold">{request.requesterDisplayName}</AppText>
            <View style={styles.actions}>
              <Button label={t("teams.accept")} style={styles.action} disabled={!canWrite} loading={busy}
                onPress={()=>void act(()=>teamApi.respondJoinRequest(token!,teamId!,request.id,true))}/>
              <Button label={t("teams.decline")} style={styles.action} variant="secondary" disabled={!canWrite} loading={busy}
                onPress={()=>void act(()=>teamApi.respondJoinRequest(token!,teamId!,request.id,false))}/>
            </View>
          </View>)}
        </Card>:null}
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.guestPlayers")} ({workspace.guests.length})</AppText>
          <AppText variant="caption" muted>{t("tm.guestHelp")}</AppText>
          <TextField label={t("tm.guestName")} value={guestName} onChangeText={setGuestName}/>
          <SelectRow options={positions.map(k=>({key:k,label:t(`teams.position.${k}` as never)}))}
            selected={guestPosition} onSelect={setGuestPosition}/>
          <TextField label={t("teams.shirtNumber")} value={guestShirt} keyboardType="number-pad" onChangeText={setGuestShirt}/>
          <Button label={t("tm.addGuest")} disabled={!canWrite||guestName.trim().length<2||!!guestShirt&&(!Number.isInteger(Number(guestShirt))||Number(guestShirt)<1||Number(guestShirt)>99)}
            loading={busy} onPress={()=>void act(async()=>{
              await teamManagerApi.addGuest(token!,teamId!,{name:guestName.trim(),position:guestPosition,shirtNumber:guestShirt?Number(guestShirt):null});
              setGuestName("");setGuestShirt("");
            })}/>
          {workspace.guests.map(guest=><View key={guest.id} style={styles.divider}>
            <AppText weight="semibold">{guest.name}{guest.shirtNumber?` · #${guest.shirtNumber}`:""} · {guest.position}</AppText>
            <Button label={t("tm.remove")} disabled={!canWrite} loading={busy} variant="ghost"
              onPress={()=>void act(()=>teamManagerApi.deleteGuest(token!,teamId!,guest.id))}/>
          </View>)}
        </Card>
        {sentInvitations.length?<Card><AppText weight="bold">{t("tm.pendingInvites")}</AppText>
          {sentInvitations.map(inv=><AppText key={inv.id}>{inv.invitedPublicDisplayName} · {inv.role}</AppText>)}
        </Card>:null}
      </>:null}

      {tab==="competitions"?<>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.myCompetitions")}</AppText>
          <SelectRow selected={compFilter} onSelect={setCompFilter}
            options={["ALL","INVITED","PENDING","ACCEPTED","COMPLETED"].map(key=>({key,label:key==="ALL"?t("tm.all"):key==="COMPLETED"?t("tm.completed"):badgeStatus(key)}))}/>
          {competitions.filter(c=>compFilter==="ALL"||(compFilter==="COMPLETED"?c.competitionStatus==="COMPLETED":compFilter==="PENDING"?["APPLIED","PENDING"].includes(c.registrationStatus):c.registrationStatus===compFilter))
            .map(comp=><View key={comp.id} style={styles.divider}>
              <AppText weight="bold">{comp.name}</AppText>
              <AppText variant="caption" muted>{comp.venueName} · {badgeStatus(comp.competitionStatus)} · {badgeStatus(comp.registrationStatus)}</AppText>
              <AppText variant="caption" muted>{date(comp.startsAt)}</AppText>
              <View style={styles.actions}>
                <Button label={t("tm.details")} style={styles.action} variant="secondary" onPress={()=>openCompetition(comp.id)}/>
                {comp.registrationStatus==="INVITED"?<>
                  <Button label={t("teams.accept")} style={styles.action} disabled={!canWrite||busy} onPress={()=>void act(()=>competitionApi.respondInvitation(token!,comp.id,teamId!,{status:"ACCEPTED"}))}/>
                  <Button label={t("teams.decline")} style={styles.action} variant="secondary" disabled={!canWrite||busy} onPress={()=>void act(()=>competitionApi.respondInvitation(token!,comp.id,teamId!,{status:"REJECTED"}))}/>
                </>:null}
              </View>
            </View>)}
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.findCompetition")}</AppText>
          <TextField label={t("tm.searchCompetition")} value={compSearch} onChangeText={setCompSearch}/>
          {availableCompetitions.filter(c=>c.status==="REGISTRATION_OPEN"&&!competitions.some(m=>m.id===c.id))
            .filter(c=>!compSearch||[c.name,c.venueName].some(v=>v.toLowerCase().includes(compSearch.toLowerCase())))
            .slice(0,15).map(c=><View key={c.id} style={styles.divider}>
              <AppText weight="bold">{c.name}</AppText>
              <AppText muted variant="caption">{c.venueName} · {date(c.startsAt)}</AppText>
              <View style={styles.actions}>
                <Button label={t("tm.details")} style={styles.action} variant="secondary" onPress={()=>openCompetition(c.id)}/>
                <Button label={t("tm.register")} style={styles.action} disabled={!canWrite||busy}
                  onPress={()=>void act(()=>competitionApi.register(token!,c.id,teamId!))}/>
              </View>
            </View>)}
          <Button label={t("tm.exploreAll")} variant="ghost" onPress={()=>router.push("/competitions")}/>
        </Card>
      </>:null}

      {tab==="matches"?<>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.officialMatches")}</AppText>
          <SelectRow selected={matchFilter} onSelect={setMatchFilter}
            options={["UPCOMING","TODAY","COMPLETED","CANCELLED","ALL"].map(key=>({key,label:t(`tm.filter.${key}` as never)}))}/>
          {games.filter(g=>matchFilter==="ALL"||matchFilter==="COMPLETED"&&completed(g)||
            matchFilter==="CANCELLED"&&g.status==="CANCELLED"||
            matchFilter==="UPCOMING"&&future(g)||
            matchFilter==="TODAY"&&!!g.startsAt&&new Date(g.startsAt).toDateString()===new Date().toDateString())
            .sort((a,b)=>(a.startsAt??"").localeCompare(b.startsAt??""))
            .map(game=><View key={game.id} style={styles.divider}>
              <AppText weight="bold">{teamName} · {game.opponentName||t("tm.toBeDecided")}</AppText>
              <AppText variant="caption" muted>{game.competitionName} · {badgeStatus(game.status)}</AppText>
              <AppText variant="caption" muted>{date(game.startsAt)}{game.homeScore!==null&&game.awayScore!==null?` · ${game.homeScore} : ${game.awayScore}`:""}</AppText>
              <View style={styles.actions}>
                <Button label={t("tm.details")} variant="secondary" style={styles.action} onPress={()=>openCompetition(game.competitionId,"MATCHES")}/>
                {!completed(game)&&game.status!=="CANCELLED"?<Button label={t("tm.lineup")} variant="secondary"
                  style={styles.action} onPress={()=>openLineup(game)}/>:null}
              </View>
            </View>)}
          {games.length===0?<AppText muted>{t("tm.noMatches")}</AppText>:null}
        </Card>
        {selectedGame?<Card><AppText variant="bodyLarge" weight="bold">{t("tm.lineup")}: {selectedGame.opponentName}</AppText>
          <AppText variant="caption" muted>{t("tm.lineupHint")}</AppText>
          {team.members.map(member=><View key={member.userId} style={styles.divider}>
            <AppText weight="semibold">{member.publicDisplayName}</AppText>
            <SelectRow selected={lineupStarts.includes(member.userId)?"START":lineupSubs.includes(member.userId)?"SUB":"NONE"}
              onSelect={v=>{
                const current=lineupStarts.includes(member.userId)?"START":lineupSubs.includes(member.userId)?"SUB":"NONE";
                if(v===current){if(v==="START")editLineup(member.userId,"start");if(v==="SUB")editLineup(member.userId,"sub");}
                else if(v==="START")editLineup(member.userId,"start");
                else if(v==="SUB")editLineup(member.userId,"sub");
                else{setLineupStarts(old=>old.filter(x=>x!==member.userId));setLineupSubs(old=>old.filter(x=>x!==member.userId));}
              }}
              options={[{key:"START",label:t("tm.starting")},{key:"SUB",label:t("tm.substitute")},{key:"NONE",label:t("tm.unselected")}]}/>
          </View>)}
          <AppText variant="caption" muted>{t("tm.starting")}: {lineupStarts.length}/5</AppText>
          <Button label={t("common.save")} disabled={!canWrite||busy} loading={busy}
            onPress={()=>void act(()=>teamManagerApi.saveLineup(token!,teamId!,selectedGame.id,{startingUserIds:lineupStarts,substituteUserIds:lineupSubs}))}/>
          <Button label={t("common.cancel")} variant="ghost" onPress={()=>setChosenMatch(null)}/>
        </Card>:null}
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.friendlyChallenges")}</AppText>
          {workspace.friendlies.map(c=><View key={c.id} style={styles.divider}>
            <AppText weight="bold">{c.opponentName}</AppText>
            <AppText variant="caption" muted>{date(c.proposedAt)} · {badgeStatus(c.status)} · {c.place??""}</AppText>
            {c.toTeamId===teamId&&c.status==="PENDING"?<View style={styles.actions}>
              <Button label={t("teams.accept")} style={styles.action} disabled={!canWrite||busy}
                onPress={()=>void act(()=>teamManagerApi.respondChallenge(token!,teamId!,c.id,true))}/>
              <Button label={t("teams.decline")} style={styles.action} variant="secondary" disabled={!canWrite||busy}
                onPress={()=>void act(()=>teamManagerApi.respondChallenge(token!,teamId!,c.id,false))}/>
            </View>:null}
          </View>)}
          <Button label={t("tm.newChallenge")} variant="secondary" onPress={()=>setShowChallenge(v=>!v)}/>
          {showChallenge?<View style={{gap:spacing.md}}>
            <AppText weight="semibold">{t("tm.chooseOpponent")}</AppText>
            <SelectRow options={directory.filter(x=>x.id!==teamId).slice(0,25).map(x=>({key:x.id,label:x.name}))}
              selected={challenger} onSelect={setChallenger}/>
            <DateTimePickerField label={t("tm.proposedTime")} value={challengeTime} minimumDate={new Date()} onChange={setChallengeTime}/>
            <TextField label={t("tm.place")} value={challengePlace} onChangeText={setChallengePlace}/>
            <Button label={t("tm.sendChallenge")} disabled={!canWrite||!challenger||!challengeTime||busy}
              onPress={()=>void act(async()=>{
                await teamManagerApi.challenge(token!,teamId!,{toTeamId:challenger,proposedAt:challengeTime,place:challengePlace});
                setShowChallenge(false);setChallenger("");
              })}/>
          </View>:null}
        </Card>
      </>:null}

      {tab==="schedule"?<>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.teamCalendar")}</AppText>
          {upcoming.slice(0,8).map(game=><View key={game.id} style={styles.divider}>
            <AppText weight="semibold">{t("tm.officialMatch")}: {game.opponentName}</AppText>
            <AppText muted variant="caption">{date(game.startsAt)}</AppText>
          </View>)}
          {workspace.activities.map(activity=>{
            const yes=workspace.responses.filter(r=>r.activityId===activity.id&&r.status==="AVAILABLE").length;
            const my=workspace.responses.find(r=>r.activityId===activity.id&&r.userId===userId)?.status??"";
            return <View key={activity.id} style={styles.divider}>
              <AppText weight="bold">{activity.title} · {badgeStatus(activity.kind)}</AppText>
              <AppText variant="caption" muted>{date(activity.startsAt)} – {date(activity.endsAt)}</AppText>
              {activity.place?<AppText variant="caption" muted>{activity.place}</AppText>:null}
              {activity.description?<AppText variant="caption">{activity.description}</AppText>:null}
              <AppText variant="caption" muted>{t("tm.availableCount")}: {yes}</AppText>
              <SelectRow selected={my} onSelect={v=>void act(()=>teamManagerApi.rsvp(token!,teamId!,activity.id,v as "AVAILABLE"|"UNAVAILABLE"|"UNSURE"))}
                options={["AVAILABLE","UNAVAILABLE","UNSURE"].map(k=>({key:k,label:t(`tm.rsvp.${k}` as never)}))}/>
              {canWrite?<Button label={t("tm.remove")} variant="ghost" disabled={busy}
                onPress={()=>void act(()=>teamManagerApi.deleteActivity(token!,teamId!,activity.id))}/>:null}
            </View>;
          })}
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.newActivity")}</AppText>
          <SelectRow selected={eventKind} onSelect={v=>setEventKind(v as typeof eventKind)}
            options={["TRAINING","MEETING","FRIENDLY","OTHER"].map(k=>({key:k,label:t(`tm.kind.${k}` as never)}))}/>
          <TextField label={t("tm.activityName")} value={eventName} onChangeText={setEventName}/>
          <TextField label={t("tm.description")} value={eventDescription} onChangeText={setEventDescription}/>
          <TextField label={t("tm.place")} value={eventPlace} onChangeText={setEventPlace}/>
          <DateTimePickerField label={t("tm.startsAt")} value={eventStart} onChange={setEventStart} minimumDate={new Date()}/>
          <DateTimePickerField label={t("tm.endsAt")} value={eventEnd} onChange={setEventEnd}
            minimumDate={new Date(eventStart||Date.now())}/>
          <Button label={t("tm.createActivity")} disabled={!canWrite||!eventName.trim()||!eventStart||!eventEnd||Date.parse(eventEnd)<=Date.parse(eventStart)}
            loading={busy} onPress={()=>void act(async()=>{
              await teamManagerApi.createActivity(token!,teamId!,{kind:eventKind,title:eventName.trim(),
                description:eventDescription,place:eventPlace,startsAt:eventStart,endsAt:eventEnd});
              setEventName("");setEventStart("");setEventEnd("");setEventDescription("");setEventPlace("");
            })}/>
          <Button label={t("tm.bookVenue")} variant="secondary" onPress={()=>router.push("/venues")}/>
        </Card>
      </>:null}

      {tab==="media"?<>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.createPost")}</AppText>
          <TextField label={t("tm.postBody")} value={postBody} onChangeText={setPostBody} multiline/>
          {postImage?<Image source={{uri:resolveMediaImageUrl(postImage)??postImage}} style={{width:"100%",height:190,borderRadius:radius.md}} resizeMode="cover"/>:null}
          <Button label={t("tm.choosePhoto")} variant="secondary" loading={imageUploading} disabled={!canWrite}
            onPress={()=>void (async()=>{
              try{
                const picked=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],quality:0.85,allowsEditing:false});
                if(picked.canceled||!picked.assets[0]||!token)return;
                setImageUploading(true);setError(null);
                const asset=picked.assets[0];
                const result=await marketingApi.uploadUserPostImage(token,{
                  uri:asset.uri,mimeType:asset.mimeType??"image/jpeg",
                  ...(asset.fileSize!==undefined?{size:asset.fileSize}:{})
                });
                setPostImage(result.imageUrl);
              }catch(e){setError(e instanceof ApiRequestError?e.message:t("tm.actionFailed"));}
              finally{setImageUploading(false);}
            })()}/>
          <Button label={t("tm.publish")} disabled={!canWrite||busy||imageUploading||(!postBody.trim()&&!postImage)}
            loading={busy} onPress={()=>void act(async()=>{
              await teamManagerApi.createPost(token!,teamId!,{body:postBody,...(postImage?{imageUrl:postImage}:{})});
              setPostBody("");setPostImage("");
            })}/>
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.teamPosts")}</AppText>
          {workspace.posts.length===0?<AppText muted>{t("tm.noPosts")}</AppText>:null}
          {workspace.posts.map(post=><View key={post.id} style={styles.divider}>
            <AppText variant="caption" muted>{date(post.publishedAt)}</AppText>
            <AppText>{post.body}</AppText>
            {post.imageUrl?<Image source={{uri:resolveMediaImageUrl(post.imageUrl)??post.imageUrl}} style={{height:160,borderRadius:radius.md}} resizeMode="cover"/>:null}
            <View style={styles.actions}>
              <Button label={t("tm.viewPost")} variant="secondary" style={styles.action}
                onPress={()=>router.push({pathname:"/posts/[postId]",params:{postId:post.id}})}/>
              <Button label={t("tm.remove")} disabled={!canWrite||busy} variant="ghost" style={styles.action}
                onPress={()=>void act(()=>teamManagerApi.deletePost(token!,teamId!,post.id))}/>
            </View>
          </View>)}
        </Card>
      </>:null}

      {tab==="statistics"?<>
        <View style={styles.stats}><Tile label={t("tm.played")} value={scores.length}/>
          <Tile label={t("tm.wins")} value={stats.wins}/>
          <Tile label={t("tm.draws")} value={stats.draws}/>
          <Tile label={t("tm.losses")} value={stats.losses}/></View>
        <View style={styles.stats}><Tile label={t("tm.goalsFor")} value={stats.scored}/>
          <Tile label={t("tm.goalsAgainst")} value={stats.conceded}/>
          <Tile label={t("tm.goalDiff")} value={stats.scored-stats.conceded}/>
          <Tile label={t("tm.winRate")} value={scores.length?`${Math.round(stats.wins/scores.length*100)}%`:"0%"}/></View>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.competitionHistory")}</AppText>
          {competitions.map(comp=><View key={comp.id} style={styles.divider}>
            <AppText weight="semibold">{comp.name}</AppText>
            <AppText variant="caption" muted>{badgeStatus(comp.competitionStatus)} · {badgeStatus(comp.registrationStatus)} · {date(comp.startsAt)}</AppText>
            <Button label={t("tm.details")} variant="ghost" onPress={()=>openCompetition(comp.id,"STATS")}/>
          </View>)}
          <AppText variant="caption" muted>{t("tm.statsOfficial")}</AppText>
        </Card>
      </>:null}

      {tab==="settings"?<>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.subscription")}</AppText>
          <AppText>{t("tm.status")}: {offer?.status??"—"}</AppText>
          <AppText muted>{t("tm.expiry")}: {date(offer?.activeUntil??null)}</AppText>
          <Button label={t("tm.manageSubscription")} onPress={()=>router.push("/role-subscriptions/team-owner")}/>
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.teamPermissions")}</AppText>
          <AppText muted>{t("tm.managerPermissions")}</AppText>
          <Button label={t("tm.manageRoster")} variant="secondary"
            onPress={()=>router.push({pathname:"/teams/[teamId]/manage",params:{teamId:team.id}})}/>
          <AppText variant="caption" muted>{t("tm.ownershipNotice")}</AppText>
        </Card>
        <Card><AppText variant="bodyLarge" weight="bold">{t("tm.preferences")}</AppText>
          <Button label={t("tm.notifications")} variant="secondary" onPress={()=>router.push("/settings")}/>
          <Button label={t("tm.publicProfile")} variant="secondary"
            onPress={()=>router.push({pathname:"/teams/[teamId]",params:{teamId:team.id}})}/>
        </Card>
      </>:null}
    </>:null}
  </Screen>;
}
const styles=StyleSheet.create({
  nav:{flexGrow:0,flexShrink:0,borderTopWidth:1,borderBottomWidth:1,borderColor:colors.border,backgroundColor:colors.background,
    marginHorizontal:-spacing.xs},
  navItem:{height:46,paddingHorizontal:spacing.md,borderRadius:radius.pill,borderWidth:1,borderColor:"transparent",
    backgroundColor:colors.surface,flexDirection:"row",alignItems:"center",gap:spacing.xs},
  navActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  chip:{paddingHorizontal:spacing.md,paddingVertical:spacing.sm,borderWidth:1,borderColor:colors.border,borderRadius:radius.pill,
    backgroundColor:colors.surface,minHeight:38,justifyContent:"center"},
  chipOn:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  teamSelect:{flexDirection:"row",alignItems:"center",gap:spacing.sm,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.pill,padding:spacing.sm,backgroundColor:colors.surface},
  teamSelectOn:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  row:{flexDirection:"row",alignItems:"center",gap:spacing.md},
  divider:{paddingTop:spacing.md,marginTop:spacing.sm,borderTopWidth:1,borderColor:colors.border,gap:spacing.xs},
  hero:{backgroundColor:colors.surface},
  logo:{width:64,height:64,borderRadius:radius.lg,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  avatar:{width:42,height:42,borderRadius:21,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  stats:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  stat:{flexGrow:1,flexBasis:"21%",minWidth:70,padding:spacing.md,backgroundColor:colors.surface,
    borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,alignItems:"center",gap:spacing.xs},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm,alignItems:"center"},
  action:{flexGrow:1,flexBasis:"42%"},
});
