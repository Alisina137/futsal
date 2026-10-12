import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {TeamDirectoryItemDto,TeamInvitationDto,TeamListItemDto,PlayerPosition} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useEffect,useRef,useState} from "react";
import {Image,Pressable,ScrollView,StyleSheet,View,type LayoutChangeEvent} from "react-native";
import {ApiRequestError,playerDashboardApi,teamApi,resolveMediaImageUrl,
  type PlayerDashboardOverview,type PlayerDashboardPreferences} from "../../lib/api";
import {formatCompetitionDateTime} from "../../lib/date-time";
import {useAuth} from "../../providers/AuthProvider";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";
import {Screen} from "../ui/Screen";
import {TextField} from "../ui/TextField";
import {PlayerActivityTabs} from "./PlayerActivityTabs";
import {PlayerCareerTabs} from "./PlayerCareerTabs";
import {WhatsAppGroupButton} from "../ui/WhatsAppGroupButton";
import {useVisibleTab} from "../../hooks/useVisibleTab";

type Section="overview"|"teams"|"competitions"|"matches"|"schedule"|"statistics"|"achievements"|"bookings"|"settings";
const sections:{id:Section;icon:keyof typeof Ionicons.glyphMap}[]=[
  {id:"overview",icon:"grid-outline"},
  {id:"teams",icon:"shield-outline"},
  {id:"competitions",icon:"trophy-outline"},
  {id:"matches",icon:"football-outline"},
  {id:"schedule",icon:"calendar-outline"},
  {id:"statistics",icon:"stats-chart-outline"},
  {id:"achievements",icon:"ribbon-outline"},
  {id:"bookings",icon:"location-outline"},
  {id:"settings",icon:"settings-outline"},
];
const emptyPreferences:PlayerDashboardPreferences={
  defaultTeamId:null,biography:null,province:null,district:null,secondaryPosition:null,preferredFoot:null,
};
const positions:PlayerPosition[]=["UNSPECIFIED","GOALKEEPER","FIXO","ALA","PIVO","UNIVERSAL"];
function Choice({items,selected,onSelect}:{items:{id:string;label:string}[];selected:string;onSelect:(value:string)=>void}){
  const {isRTL}=useLocale();
  const nav=useVisibleTab<string>(selected);
  // A horizontal ScrollView without flexGrow:0 stretched its options to the
  // page's remaining height, creating oversized oval buttons on Android.
  return <View style={styles.choiceFrame}>
    <ScrollView ref={nav.scrollRef} horizontal nestedScrollEnabled
      testID="player-team-panel-scroll" accessibilityRole="tablist"
      onLayout={nav.onViewport} onContentSizeChange={nav.onContentSize}
      showsHorizontalScrollIndicator={false} style={styles.choiceScroll}
      contentContainerStyle={[styles.choiceRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {items.map(item=><Pressable key={item.id} accessibilityRole="tab"
        onLayout={event=>nav.cellLayout(item.id,event)}
        accessibilityState={{selected:item.id===selected}}
        onPress={()=>{onSelect(item.id);nav.focus(item.id,true);}}
        style={({pressed})=>[styles.option,selected===item.id&&styles.optionActive,
          pressed&&styles.optionPressed]}>
        <AppText variant="body" weight="semibold" numberOfLines={1}
          style={{color:selected===item.id?colors.surface:colors.text,
            textAlign:"center"}}>{item.label}</AppText>
      </Pressable>)}
    </ScrollView>
  </View>;
}
function Stat({value,label}:{value:number;label:string}){
  return <View style={styles.stat}><AppText variant="title" weight="bold" style={{color:colors.primary}}>{value}</AppText>
    <AppText variant="caption" muted style={{textAlign:"center"}}>{label}</AppText></View>;
}
export function PlayerDashboard(){
  const {session}=useAuth(),{t,isRTL,language}=useLocale();
  const token=session?.accessToken;
  const tr=(key:string)=>t(`pd1.${key}` as never);
  const date=(s:string)=>formatCompetitionDateTime(s,language);
  const [tab,setTab]=useState<Section>("overview");
  const [data,setData]=useState<PlayerDashboardOverview|null>(null);
  const [preferences,setPreferences]=useState<PlayerDashboardPreferences>(emptyPreferences);
  const [directory,setDirectory]=useState<TeamDirectoryItemDto[]>([]);
  const [teamQuery,setTeamQuery]=useState("");
  const [provinceFilter,setProvinceFilter]=useState("");
  const [teamPanel,setTeamPanel]=useState<"MINE"|"INVITES"|"REQUESTS"|"FIND">("MINE");
  const [busy,setBusy]=useState<string|null>(null),[loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null);
  const [confirmLeave,setConfirmLeave]=useState<string|null>(null);
  const [refresh,setRefresh]=useState(0);
  const navRef=useRef<ScrollView|null>(null),navViewport=useRef(0),navWidth=useRef(0);
  const cells=useRef<Partial<Record<Section,{x:number;width:number}>>>({});
  const focusTab=useCallback((id:Section,animated=false)=>{
    const layout=cells.current[id];if(!layout||!navViewport.current)return;
    const x=Math.max(0,Math.min(Math.max(0,navWidth.current-navViewport.current),
      layout.x+layout.width/2-navViewport.current/2));
    navRef.current?.scrollTo({x,y:0,animated});
  },[]);
  useEffect(()=>{const id=requestAnimationFrame(()=>focusTab(tab));return()=>cancelAnimationFrame(id);},[tab,focusTab]);
  const choose=(id:Section)=>{setTab(id);focusTab(id,true);setConfirmLeave(null);};

  useFocusEffect(useCallback(()=>{
    let mounted=true;
    if(!token){setLoading(false);return()=>{mounted=false;};}
    setLoading(true);setError(null);
    void playerDashboardApi.overview(token).then(v=>{
      if(mounted){setData(v);setPreferences(v.preferences);}
    }).catch(e=>{if(mounted){setData(null);setError(e instanceof ApiRequestError?e.message:t("pd1.loadError"));}})
      .finally(()=>{if(mounted)setLoading(false);});
    return()=>{mounted=false;};
  },[token,refresh,t]));

  useEffect(()=>{
    if(tab!=="teams"||teamPanel!=="FIND"||!token)return;
    let mounted=true;
    void teamApi.directory(token).then(v=>{if(mounted)setDirectory(v.teams);})
      .catch(e=>{if(mounted)setError(e instanceof ApiRequestError?e.message:t("pd1.teamLoadError"));});
    return()=>{mounted=false;};
  },[tab,teamPanel,token,refresh,t]);

  async function perform(key:string,operation:()=>Promise<unknown>,after?:()=>void){
    if(busy||!token)return;
    setBusy(key);setError(null);setMessage(null);
    try{await operation();after?.();setMessage(t("pd1.saved"));setRefresh(v=>v+1);}
    catch(e){setError(e instanceof ApiRequestError?e.message:t("pd1.actionFailed"));}
    finally{setBusy(null);}
  }
  const teams=data?.teams??[];
  const selected=teams.find(x=>x.id===data?.selectedTeamId)??teams[0]??null;
  const selectedRole=data?.profile.teams.find(x=>x.id===selected?.id)?.role??null;
  const pendingInvites=data?.invitations.filter(x=>x.status==="PENDING"&&Date.parse(x.expiresAt)>Date.now())??[];
  const pendingRequests=data?.requests.filter(x=>x.status==="PENDING")??[];
  const matches=data?.recentMatches??[];
  const discover=directory.filter(x=>x.status==="ACTIVE"&&
    (!provinceFilter||x.city===provinceFilter)&&
    (!teamQuery.trim()||[x.name,x.city].some(v=>v.toLowerCase().includes(teamQuery.trim().toLowerCase()))))
    .slice(0,50);
  const cities=[...new Set(directory.map(x=>x.city).filter(Boolean))].sort();
  const profile=data?.profile;
  const hasManager=session?.user.roles.includes("TEAM_MANAGER")??false;
  const hasOwner=session?.user.roles.includes("VENUE_OWNER")??false;

  return <Screen showHeader>
    <View style={[styles.identityRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.identityAvatar}>
        {profile?.imageUrl?<Image source={{uri:resolveMediaImageUrl(profile.imageUrl)??profile.imageUrl}} style={styles.avatarImage}/>:
          <Ionicons name="person-outline" size={24} color={colors.primary}/>}
      </View>
      <View style={{flex:1,alignItems:isRTL?"flex-end":"flex-start"}}>
        <AppText weight="bold" numberOfLines={1}>{profile?.publicDisplayName??session?.user.displayName??tr("playerDashboard")}</AppText>
        <AppText variant="caption" muted>{selected?.name??tr("noCurrentTeam")}</AppText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t("notifications.title")}
        onPress={()=>router.push("/notifications")} style={styles.alertButton}>
        <Ionicons name="notifications-outline" size={24} color={colors.primary}/>
        {pendingInvites.length>0?<View style={styles.badge}/>:null}
      </Pressable>
    </View>

    <ScrollView ref={navRef} horizontal showsHorizontalScrollIndicator={false} style={styles.nav}
      onLayout={e=>{navViewport.current=e.nativeEvent.layout.width;focusTab(tab);}}
      onContentSizeChange={width=>{navWidth.current=width;focusTab(tab);}}
      contentContainerStyle={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,
        paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,alignItems:"center"}}>
      {sections.map(item=><Pressable key={item.id} accessibilityRole="tab"
        accessibilityState={{selected:tab===item.id}}
        onLayout={(e:LayoutChangeEvent)=>{cells.current[item.id]=e.nativeEvent.layout;if(tab===item.id)focusTab(tab);}}
        onPress={()=>choose(item.id)} style={[styles.navTab,tab===item.id&&styles.navActive]}>
        <Ionicons name={item.icon} color={tab===item.id?colors.primary:colors.textMuted} size={18}/>
        <AppText variant="caption" weight="semibold" style={tab===item.id?{color:colors.primary}:undefined}>
          {tr("tab."+item.id)}
        </AppText>
      </Pressable>)}
    </ScrollView>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary" onPress={()=>setRefresh(x=>x+1)}/></Card>:null}
    {message?<Card style={{backgroundColor:colors.primarySoft}}>
      <AppText style={{color:colors.primary}}>{message}</AppText></Card>:null}
    {loading?<DataLoadingState variant="dashboard" minHeight={440}/>:data?<>
      {tab==="overview"?<>
        <Card>
          <View style={[styles.identityRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
            {profile?.imageUrl?<Image source={{uri:resolveMediaImageUrl(profile.imageUrl)??profile.imageUrl}}
              style={styles.playerPhoto}/>:
              <View style={[styles.playerPhoto,{backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"}]}>
                <Ionicons name="football-outline" size={35} color={colors.primary}/>
              </View>}
            <View style={{flex:1,gap:spacing.xs,alignItems:isRTL?"flex-end":"flex-start"}}>
              <AppText variant="bodyLarge" weight="bold">{profile?.publicDisplayName}</AppText>
              <AppText variant="caption" muted>{t(`teams.position.${profile?.position}` as never)}</AppText>
              <AppText variant="caption" muted>{selected?.name??tr("noCurrentTeam")}
                {selectedRole?" · "+t(`teams.role.${selectedRole}` as never):""}</AppText>
            </View>
          </View>
          <View style={styles.actions}>
            <Button label={tr("editProfile")} variant="secondary" onPress={()=>router.push("/profile/player")}/>
            <Button label={tr("myTeams")} variant="secondary" onPress={()=>choose("teams")}/>
            {selected&&data.whatsappGroups?.[selected.id]?
              <WhatsAppGroupButton url={data.whatsappGroups[selected.id]!}/>:null}
          </View>
        </Card>
        <View style={styles.stats}>
          <Stat label={tr("matchesPlayed")} value={data.stats.matches}/>
          <Stat label={tr("goals")} value={data.stats.goals}/>
          <Stat label={tr("assists")} value={data.stats.assists}/>
          <Stat label={tr("awards")} value={data.stats.awards}/>
        </View>
        <Card>
          <AppText variant="bodyLarge" weight="bold">{tr("nextMatch")}</AppText>
          {data.nextMatch?<View style={{gap:spacing.sm}}>
            <AppText weight="semibold">{data.nextMatch.homeTeamName}  VS  {data.nextMatch.awayTeamName}</AppText>
            {data.nextMatch.startsAt?<AppText muted>{date(data.nextMatch.startsAt)}</AppText>:null}
            <Button label={tr("matchDetails")} onPress={()=>router.push({
              pathname:"/competitions/[competitionId]/matches/[matchId]",
              params:{competitionId:data.nextMatch!.competitionId,matchId:data.nextMatch!.id},
            })}/>
          </View>:<AppText muted>{tr("noNextMatch")}</AppText>}
        </Card>
        <Card>
          <AppText variant="bodyLarge" weight="bold">{tr("needsAttention")}</AppText>
          {pendingInvites.length===0&&pendingRequests.length===0&&data.activities.filter(a=>!a.availability).length===0?
            <AppText muted>{tr("noUrgentItems")}</AppText>:null}
          {pendingInvites.length>0?<Button label={tr("pendingInvitations")+" ("+pendingInvites.length+")"}
            variant="secondary" onPress={()=>{setTeamPanel("INVITES");choose("teams");}}/>:null}
          {pendingRequests.length>0?<Button label={tr("pendingRequestsCount")+" ("+pendingRequests.length+")"}
            variant="secondary" onPress={()=>{setTeamPanel("REQUESTS");choose("teams");}}/>:null}
          {data.activities.filter(a=>!a.availability).slice(0,3).map(a=><View key={a.id} style={styles.item}>
            <AppText weight="semibold">{a.title}</AppText>
            <AppText variant="caption" muted>{date(a.startsAt)}</AppText>
            <Button label={tr("respondToActivity")} variant="secondary"
              onPress={()=>router.push({pathname:"/teams/[teamId]/activities",params:{teamId:a.teamId}})}/>
          </View>)}
        </Card>
        <Card>
          <AppText variant="bodyLarge" weight="bold">{tr("upcomingActivities")}</AppText>
          {data.activities.length===0?<AppText muted>{tr("noUpcomingActivities")}</AppText>:null}
          {data.activities.slice(0,3).map(a=><View key={a.id} style={styles.item}>
            <AppText weight="semibold">{a.title}</AppText>
            <AppText variant="caption" muted>{date(a.startsAt)}</AppText>
            <Button label={tr("openActivity")} variant="secondary"
              onPress={()=>router.push({pathname:"/teams/[teamId]/activities",params:{teamId:a.teamId}})}/>
          </View>)}
        </Card>
        <Card>
          <AppText variant="bodyLarge" weight="bold">{tr("recentPerformance")}</AppText>
          {matches.length===0?<AppText muted>{tr("noRecentMatches")}</AppText>:null}
          {matches.map(match=><View key={match.matchId} style={styles.item}>
            <AppText variant="caption" muted>{match.startsAt?date(match.startsAt):tr("unscheduled")}</AppText>
            <AppText>{tr("goals")}: {match.goals} · {tr("assists")}: {match.assists}</AppText>
          </View>)}
        </Card>
      </>:null}

      {tab==="teams"?<>
        <Choice selected={teamPanel} onSelect={v=>setTeamPanel(v as typeof teamPanel)}
          items={["MINE","INVITES","REQUESTS","FIND"].map(id=>({id,label:tr("teamPanel."+id)}))}/>
        {teamPanel==="MINE"?<>
          <View style={[styles.teamListHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <AppText variant="bodyLarge" weight="bold">{tr("myTeams")}</AppText>
            <View style={styles.teamCountBadge}><AppText forceLtr weight="bold"
              style={styles.teamCountText}>{teams.length}</AppText></View>
          </View>
          {!teams.length?<Card><AppText muted>{tr("noTeams")}</AppText>
            <Button label={tr("findTeam")} onPress={()=>setTeamPanel("FIND")}/></Card>:null}
          {teams.map(team=>{
            const member=data.profile.teams.find(x=>x.id===team.id);
            const isDefault=team.id===selected?.id;
            return <Card key={team.id} testID={"player-team-card-"+team.id}
              style={styles.memberTeamCard}>
              <View style={[styles.memberTeamHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <View style={styles.memberTeamLogo}>
                  {team.logoUrl?<Image source={{uri:resolveMediaImageUrl(team.logoUrl)??team.logoUrl}}
                    style={styles.avatarImage} resizeMode="cover"/>:
                    <Ionicons name="shield-outline" size={29} color={colors.primary}/>}
                </View>
                <View style={styles.memberTeamInfo}>
                  <AppText variant="bodyLarge" weight="bold" numberOfLines={2}>
                    {team.name}</AppText>
                  <View style={[styles.memberTeamLocation,{flexDirection:isRTL?"row-reverse":"row"}]}>
                    <Ionicons name="location-outline" size={15} color={colors.textMuted}/>
                    <AppText variant="caption" muted numberOfLines={1} style={{flexShrink:1}}>
                      {team.city}</AppText>
                  </View>
                </View>
              </View>
              <View style={[styles.teamBadges,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <View style={styles.memberRoleBadge}>
                  <Ionicons name="person-outline" size={14} color={colors.textMuted}/>
                  <AppText variant="caption" weight="semibold">
                    {member?.role?t(`teams.role.${member.role}` as never):tr("member")}
                  </AppText>
                </View>
                {isDefault?<View testID="player-default-team-badge" style={styles.defaultTeamBadge}>
                  <Ionicons name="checkmark-circle" size={15} color={colors.primary}/>
                  <AppText variant="caption" weight="semibold" style={styles.defaultTeamText}>
                    {tr("defaultTeam")}</AppText>
                </View>:null}
              </View>
              <View style={styles.teamDivider}/>
              <View style={[styles.teamActionGrid,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <Button style={styles.teamActionButton} label={tr("viewTeam")}
                  variant="secondary"
                  icon={<Ionicons name="eye-outline" size={18} color={colors.primary}/>}
                  onPress={()=>router.push({pathname:"/teams/[teamId]",params:{teamId:team.id}})}/>
                <Button style={styles.teamActionButton} label={tr("teamActivities")}
                  variant="secondary"
                  icon={<Ionicons name="calendar-outline" size={18} color={colors.primary}/>}
                  onPress={()=>router.push({pathname:"/teams/[teamId]/activities",params:{teamId:team.id}})}/>
              </View>
              {!isDefault?<Button label={tr("makeDefault")} variant="secondary"
                style={styles.teamFullButton} icon={<Ionicons name="star-outline" size={18}
                  color={colors.primary}/>} disabled={busy!==null}
                loading={busy==="default:"+team.id}
                onPress={()=>void perform("default:"+team.id,()=>playerDashboardApi.updatePreferences(token!,{
                  defaultTeamId:team.id,
                }))}/>:null}
              {data.whatsappGroups?.[team.id]?<View style={[styles.teamWhatsAppRow,{alignItems:isRTL?"flex-end":"flex-start"}]}>
                <WhatsAppGroupButton url={data.whatsappGroups[team.id]!}/>
              </View>:null}
              {team.managerUserId!==session?.user.id?<View style={styles.teamFooter}>
                {confirmLeave===team.id?<View style={styles.leaveConfirm}>
                  <AppText style={{color:colors.danger}}>{tr("confirmLeave")}</AppText>
                  <View style={[styles.teamActionGrid,{flexDirection:isRTL?"row-reverse":"row"}]}>
                    <Button style={styles.teamActionButton} variant="danger"
                      label={tr("leaveTeam")} loading={busy==="leave:"+team.id}
                      disabled={busy!==null}
                      onPress={()=>void perform("leave:"+team.id,
                        ()=>playerDashboardApi.leaveTeam(token!,team.id),
                        ()=>setConfirmLeave(null))}/>
                    <Button style={styles.teamActionButton} variant="secondary"
                      label={t("common.cancel")} disabled={busy!==null}
                      onPress={()=>setConfirmLeave(null)}/>
                  </View>
                </View>:<Pressable accessibilityRole="button"
                  testID="player-leave-team-trigger"
                  accessibilityLabel={tr("leaveTeam")}
                  accessibilityState={{disabled:busy!==null}}
                  disabled={busy!==null}
                  style={({pressed})=>[styles.leaveControl,pressed&&styles.optionPressed]}
                  onPress={()=>setConfirmLeave(team.id)}>
                  <Ionicons name="exit-outline" size={17} color={colors.danger}/>
                  <AppText weight="semibold" style={styles.leaveText}>
                    {tr("leaveTeam")}</AppText>
                </Pressable>}
              </View>:null}
            </Card>;
          })}
        </>:null}
        {teamPanel==="INVITES"?<>
          {!pendingInvites.length?<Card><AppText muted>{tr("noInvites")}</AppText></Card>:null}
          {pendingInvites.map(invite=><Card key={invite.id}>
            <AppText weight="bold">{invite.teamName}</AppText>
            <AppText variant="caption" muted>{t("teams.invitedAs",{role:t(`teams.role.${invite.role}` as never)})}</AppText>
            <AppText variant="caption" muted>{tr("expires")}: {date(invite.expiresAt)}</AppText>
            <View style={styles.actions}>
              <Button label={t("teams.accept")} loading={busy===invite.id}
                disabled={busy!==null} onPress={()=>void perform(invite.id,
                  ()=>teamApi.acceptInvitation(token!,invite.id),()=>setTeamPanel("MINE"))}/>
              <Button label={t("teams.decline")} variant="secondary" disabled={busy!==null}
                onPress={()=>void perform(invite.id,()=>teamApi.declineInvitation(token!,invite.id))}/>
            </View>
          </Card>)}
        </>:null}
        {teamPanel==="REQUESTS"?<>
          {!data.requests.length?<Card><AppText muted>{tr("noRequests")}</AppText></Card>:null}
          {data.requests.map(req=><Card key={req.id}>
            <AppText weight="bold">{req.teamName}</AppText>
            <AppText variant="caption" muted>{date(req.createdAt)} · {tr("requestStatus."+req.status)}</AppText>
            <View style={styles.actions}>
              <Button label={tr("viewTeam")} variant="secondary" onPress={()=>router.push({
                pathname:"/teams/[teamId]",params:{teamId:req.teamId}})}/>
              {req.status==="PENDING"?<Button label={tr("cancelRequest")} variant="ghost"
                disabled={busy!==null} loading={busy===req.id}
                onPress={()=>void perform(req.id,()=>playerDashboardApi.cancelRequest(token!,req.id))}/>:null}
            </View>
          </Card>)}
        </>:null}
        {teamPanel==="FIND"?<>
          <Card>
            <TextField label={tr("searchTeams")} value={teamQuery} onChangeText={setTeamQuery}/>
            <Choice selected={provinceFilter} onSelect={setProvinceFilter}
              items={[{id:"",label:tr("allProvinces")},...cities.map(city=>({id:city,label:city}))]}/>
            <AppText variant="caption" muted>{tr("findHint")}</AppText>
          </Card>
          {!discover.length?<Card><AppText muted>{tr("noResults")}</AppText></Card>:null}
          {discover.map(team=><Card key={team.id} style={styles.memberTeamCard}>
            <View style={[styles.memberTeamHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <View style={styles.directoryTeamLogo}>
                <Ionicons name="shield-outline" size={25} color={colors.primary}/>
              </View>
              <View style={styles.memberTeamInfo}>
                <AppText variant="bodyLarge" weight="bold" numberOfLines={2}>{team.name}</AppText>
                <View style={[styles.memberTeamLocation,{flexDirection:isRTL?"row-reverse":"row"}]}>
                  <Ionicons name="location-outline" size={15} color={colors.textMuted}/>
                  <AppText variant="caption" muted numberOfLines={1}>
                    {team.city}</AppText>
                </View>
                <AppText variant="caption" muted>
                  {tr("members")}: {team.rosterCount}</AppText>
              </View>
            </View>
            <View style={styles.teamDivider}/>
            <View style={[styles.teamActionGrid,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Button style={styles.teamActionButton} label={tr("viewTeam")}
                variant="secondary"
                onPress={()=>router.push({pathname:"/teams/[teamId]",params:{teamId:team.id}})}/>
              <Button style={styles.teamActionButton}
                label={team.myMembershipRole?tr("alreadyMember"):
                  team.joinRequestStatus==="PENDING"?tr("requested"):tr("requestJoin")}
                disabled={busy!==null||Boolean(team.myMembershipRole)||team.joinRequestStatus==="PENDING"}
                loading={busy===team.id} onPress={()=>void perform(team.id,
                  ()=>teamApi.requestJoin(token!,team.id))}/>
            </View>
          </Card>)}
        </>:null}
      </>:null}

      {tab==="settings"?<>
        <Card>
          <AppText variant="bodyLarge" weight="bold">{tr("playerProfile")}</AppText>
          <AppText variant="caption" muted>{tr("profileHint")}</AppText>
          <Button label={tr("editProfile")} onPress={()=>router.push("/profile/player")}/>
        </Card>
        <Card>
          <AppText variant="bodyLarge" weight="bold">{tr("careerPreferences")}</AppText>
          <TextField label={tr("biography")} multiline value={preferences.biography??""}
            onChangeText={v=>setPreferences(p=>({...p,biography:v}))} maxLength={500}/>
          <TextField label={tr("province")} value={preferences.province??""} maxLength={80}
            onChangeText={v=>setPreferences(p=>({...p,province:v}))}/>
          <TextField label={tr("district")} value={preferences.district??""} maxLength={80}
            onChangeText={v=>setPreferences(p=>({...p,district:v}))}/>
          <AppText weight="semibold">{tr("secondaryPosition")}</AppText>
          <Choice selected={preferences.secondaryPosition??""} onSelect={value=>
            setPreferences(p=>({...p,secondaryPosition:value?value as PlayerPosition:null}))}
            items={[{id:"",label:tr("none")},
              ...positions.map(id=>({id,label:t(`teams.position.${id}` as never)}))]}/>
          <AppText weight="semibold">{tr("preferredFoot")}</AppText>
          <Choice selected={preferences.preferredFoot??""} onSelect={value=>
            setPreferences(p=>({...p,preferredFoot:value?value as "LEFT"|"RIGHT"|"BOTH":null}))}
            items={["","LEFT","RIGHT","BOTH"].map(id=>({id,label:tr(id?"foot."+id:"none")}))}/>
          <AppText variant="caption" muted>{tr("privacyHint")}</AppText>
          <Button label={tr("savePreferences")} loading={busy==="preferences"} disabled={busy!==null}
            onPress={()=>void perform("preferences",()=>playerDashboardApi.updatePreferences(token!,preferences))}/>
        </Card>
        <Card>
          <AppText weight="semibold">{tr("defaultTeam")}</AppText>
          <Choice selected={data.selectedTeamId??""} onSelect={id=>void perform("default:"+id,
            ()=>playerDashboardApi.updatePreferences(token!,{defaultTeamId:id||null}))}
            items={[{id:"",label:tr("automatic")},...teams.map(x=>({id:x.id,label:x.name}))]}/>
        </Card>
        <Button label={tr("notificationSettings")} variant="secondary" onPress={()=>router.push("/settings")}/>
        {(hasManager||hasOwner)?<Button label={tr("otherRoleDashboard")} variant="secondary"
          onPress={()=>router.push(hasManager?"/dashboard":"/owner/competitions")}/>:null}
      </>:null}

      {(["competitions","matches","schedule","bookings"] as Section[]).includes(tab)?
        <PlayerActivityTabs tab={tab as "competitions"|"matches"|"schedule"|"bookings"}
          token={token!} teams={teams}/>:null}

      {(tab==="statistics"||tab==="achievements")?
        <PlayerCareerTabs tab={tab} token={token!}/>:null}
    </>:null}
  </Screen>;
}
const styles=StyleSheet.create({
  identityRow:{alignItems:"center",gap:spacing.md},
  identityAvatar:{height:44,width:44,borderRadius:22,alignItems:"center",
    justifyContent:"center",backgroundColor:colors.primarySoft,overflow:"hidden"},
  avatarImage:{width:"100%",height:"100%"},
  alertButton:{width:44,height:44,alignItems:"center",justifyContent:"center"},
  badge:{position:"absolute",top:5,right:6,width:8,height:8,borderRadius:4,backgroundColor:colors.danger},
  nav:{borderTopWidth:1,borderBottomWidth:1,borderColor:colors.border,flexGrow:0},
  navTab:{alignItems:"center",gap:3,paddingVertical:spacing.sm,paddingHorizontal:spacing.sm,
    borderBottomWidth:3,borderBottomColor:"transparent",minWidth:73},
  navActive:{backgroundColor:colors.primarySoft,borderBottomColor:colors.primary,borderRadius:radius.sm},
  // The selector stays 56px tall; Pressables never inherit screen height.
  choiceFrame:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.md,overflow:"hidden"},
  choiceScroll:{flexGrow:0,flexShrink:0,width:"100%"},
  choiceRow:{minHeight:56,paddingHorizontal:spacing.xs,paddingVertical:spacing.xs,
    gap:spacing.xs,alignItems:"center"},
  option:{minHeight:46,minWidth:86,flexShrink:0,alignItems:"center",justifyContent:"center",
    borderWidth:1,borderColor:colors.border,backgroundColor:colors.surfaceMuted,
    paddingHorizontal:spacing.md,paddingVertical:spacing.sm,borderRadius:radius.sm},
  optionActive:{borderColor:colors.primary,backgroundColor:colors.primary},
  optionPressed:{opacity:.78},
  playerPhoto:{width:76,height:76,borderRadius:radius.lg},
  teamListHeading:{alignItems:"center",justifyContent:"space-between",
    paddingHorizontal:spacing.xs},
  teamCountBadge:{minWidth:30,height:30,paddingHorizontal:spacing.sm,borderRadius:radius.pill,
    backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"},
  teamCountText:{color:colors.primary,textAlign:"center"},
  memberTeamCard:{gap:spacing.md,padding:spacing.md,borderRadius:radius.lg},
  memberTeamHeader:{alignItems:"center",gap:spacing.md},
  memberTeamLogo:{width:70,height:70,borderRadius:radius.md,
    backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center",
    overflow:"hidden",borderWidth:1,borderColor:colors.border},
  directoryTeamLogo:{width:60,height:60,borderRadius:radius.md,
    backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"},
  memberTeamInfo:{flex:1,minWidth:0,gap:spacing.xs},
  memberTeamLocation:{alignItems:"center",gap:spacing.xs},
  teamBadges:{alignItems:"center",gap:spacing.sm,flexWrap:"wrap"},
  memberRoleBadge:{minHeight:30,flexDirection:"row",alignItems:"center",gap:5,
    borderRadius:radius.sm,paddingHorizontal:spacing.sm,paddingVertical:3,
    backgroundColor:colors.surfaceMuted},
  defaultTeamBadge:{minHeight:30,flexDirection:"row",alignItems:"center",gap:5,
    borderRadius:radius.sm,paddingHorizontal:spacing.sm,paddingVertical:3,
    borderWidth:1,borderColor:"#B9CEF8",backgroundColor:colors.primarySoft},
  defaultTeamText:{color:colors.primary},
  teamDivider:{height:1,backgroundColor:colors.border},
  teamActionGrid:{gap:spacing.sm,flexWrap:"wrap",alignItems:"stretch"},
  teamActionButton:{flexGrow:1,flexBasis:137,minWidth:120,minHeight:54,
    paddingHorizontal:spacing.sm},
  teamFullButton:{width:"100%",minHeight:50},
  teamWhatsAppRow:{width:"100%"},
  teamFooter:{borderTopWidth:1,borderTopColor:colors.border,paddingTop:spacing.xs},
  leaveControl:{alignSelf:"center",minHeight:44,flexDirection:"row",gap:spacing.xs,
    alignItems:"center",justifyContent:"center",paddingHorizontal:spacing.md},
  leaveText:{color:colors.danger},
  leaveConfirm:{gap:spacing.sm,paddingTop:spacing.sm},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm,alignItems:"center"},
  stats:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  stat:{flexGrow:1,minWidth:70,flexBasis:"21%",backgroundColor:colors.surface,
    borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,
    alignItems:"center",gap:spacing.xs,padding:spacing.md},
  item:{borderTopWidth:1,borderColor:colors.border,marginTop:spacing.sm,paddingTop:spacing.sm,
    gap:spacing.sm},
});
