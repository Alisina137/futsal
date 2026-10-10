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
  return <ScrollView horizontal showsHorizontalScrollIndicator={false}
    contentContainerStyle={{flexDirection:"row",gap:spacing.sm,paddingVertical:spacing.xs}}>
    {items.map(item=><Pressable key={item.id} accessibilityRole="button"
      accessibilityState={{selected:item.id===selected}} onPress={()=>onSelect(item.id)}
      style={[styles.option,selected===item.id&&styles.optionActive]}>
      <AppText variant="caption" weight="semibold"
        style={selected===item.id?{color:colors.primary}:undefined}>{item.label}</AppText>
    </Pressable>)}
  </ScrollView>;
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
              <WhatsAppGroupButton url={data.whatsappGroups[selected.id]}/>:null}
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
          {!teams.length?<Card><AppText muted>{tr("noTeams")}</AppText>
            <Button label={tr("findTeam")} onPress={()=>setTeamPanel("FIND")}/></Card>:null}
          {teams.map(team=>{
            const member=data.profile.teams.find(x=>x.id===team.id);
            return <Card key={team.id}>
              <View style={[styles.identityRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <View style={styles.teamLogo}>
                  {team.logoUrl?<Image source={{uri:resolveMediaImageUrl(team.logoUrl)??team.logoUrl}}
                    style={styles.avatarImage}/>:
                    <Ionicons name="shield-outline" size={24} color={colors.primary}/>}
                </View>
                <View style={{flex:1,alignItems:isRTL?"flex-end":"flex-start"}}>
                  <AppText weight="bold">{team.name}</AppText>
                  <AppText variant="caption" muted>{team.city} · {member?.role?t(`teams.role.${member.role}` as never):tr("member")}</AppText>
                </View>
              </View>
              {team.id===selected?.id?<AppText variant="caption" style={{color:colors.primary}}>
                {tr("defaultTeam")}</AppText>:null}
              <View style={styles.actions}>
                <Button label={tr("viewTeam")} variant="secondary" onPress={()=>router.push({
                  pathname:"/teams/[teamId]",params:{teamId:team.id}})}/>
                {team.id!==selected?.id?<Button label={tr("makeDefault")} disabled={busy!==null}
                  onPress={()=>void perform("default:"+team.id,()=>playerDashboardApi.updatePreferences(token!,{
                    defaultTeamId:team.id,
                  }))}/>:null}
                <Button label={tr("teamActivities")} variant="secondary" onPress={()=>router.push({
                  pathname:"/teams/[teamId]/activities",params:{teamId:team.id}})}/>
                {data.whatsappGroups?.[team.id]?<WhatsAppGroupButton url={data.whatsappGroups[team.id]}/>:null}
              </View>
              {team.managerUserId!==session?.user.id?<View>
                {confirmLeave===team.id?<View style={styles.actions}>
                  <AppText style={{color:colors.danger}}>{tr("confirmLeave")}</AppText>
                  <Button variant="danger" label={tr("leaveTeam")} loading={busy==="leave:"+team.id}
                    onPress={()=>void perform("leave:"+team.id,()=>playerDashboardApi.leaveTeam(token!,team.id),
                      ()=>setConfirmLeave(null))}/>
                  <Button variant="secondary" label={t("common.cancel")} onPress={()=>setConfirmLeave(null)}/>
                </View>:<Button label={tr("leaveTeam")} variant="ghost" disabled={busy!==null}
                  onPress={()=>setConfirmLeave(team.id)}/>}
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
          {discover.map(team=><Card key={team.id}>
            <AppText weight="bold">{team.name}</AppText>
            <AppText variant="caption" muted>{team.city} · {tr("members")}: {team.rosterCount}</AppText>
            <View style={styles.actions}>
              <Button label={tr("viewTeam")} variant="secondary" onPress={()=>router.push({
                pathname:"/teams/[teamId]",params:{teamId:team.id}})}/>
              <Button label={team.myMembershipRole?tr("alreadyMember"):
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
  option:{borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,
    paddingHorizontal:spacing.md,paddingVertical:spacing.sm,borderRadius:radius.pill},
  optionActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  playerPhoto:{width:76,height:76,borderRadius:radius.lg},
  teamLogo:{width:54,height:54,borderRadius:radius.md,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center",overflow:"hidden"},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm,alignItems:"center"},
  stats:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  stat:{flexGrow:1,minWidth:70,flexBasis:"21%",backgroundColor:colors.surface,
    borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,
    alignItems:"center",gap:spacing.xs,padding:spacing.md},
  item:{borderTopWidth:1,borderColor:colors.border,marginTop:spacing.sm,paddingTop:spacing.sm,
    gap:spacing.sm},
});
