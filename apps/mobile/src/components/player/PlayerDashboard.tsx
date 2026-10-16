import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {TeamDirectoryItemDto,TeamInvitationDto,TeamListItemDto,PlayerPosition} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useEffect,useRef,useState} from "react";
import {Image,Pressable,ScrollView,StyleSheet,View,useWindowDimensions,type LayoutChangeEvent} from "react-native";
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

type Section="overview"|"teams"|"activity"|"career"|"settings";
type ActivityTab="competitions"|"matches"|"schedule"|"bookings";
type CareerTab="statistics"|"achievements"|"history";
type NestedTab=ActivityTab|CareerTab;
const activityTabs:{id:ActivityTab;icon:keyof typeof Ionicons.glyphMap}[]=[
  {id:"competitions",icon:"trophy-outline"},{id:"matches",icon:"football-outline"},
  {id:"schedule",icon:"calendar-outline"},{id:"bookings",icon:"location-outline"},
];
const careerTabs:{id:CareerTab;icon:keyof typeof Ionicons.glyphMap}[]=[
  {id:"statistics",icon:"stats-chart-outline"},{id:"achievements",icon:"ribbon-outline"},
  {id:"history",icon:"time-outline"},
];
const sections:{id:Section;icon:keyof typeof Ionicons.glyphMap}[]=[
  {id:"overview",icon:"grid-outline"},{id:"teams",icon:"shield-outline"},
  {id:"activity",icon:"calendar-outline"},{id:"career",icon:"bar-chart-outline"},
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
function SectionNavigation<T extends NestedTab>({kind,items,selected,onSelect}:{
  kind:"activity"|"career";items:{id:T;icon:keyof typeof Ionicons.glyphMap}[];
  selected:T;onSelect:(id:T)=>void;
}){
  const {t,isRTL}=useLocale();
  const nav=useVisibleTab<T>(selected);
  return <View testID={"player-"+kind+"-subnavigation"} style={styles.moreNavFrame}>
    <ScrollView ref={nav.scrollRef} onLayout={nav.onViewport}
      onContentSizeChange={nav.onContentSize} horizontal nestedScrollEnabled
      showsHorizontalScrollIndicator={false} style={styles.moreNavScroll}
      contentContainerStyle={[styles.moreNavRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {items.map(item=><Pressable key={item.id}
        testID={"player-"+kind+"-subtab-"+item.id} accessibilityRole="tab"
        accessibilityLabel={t(`pd1.tab.${item.id}` as never)}
        accessibilityState={{selected:selected===item.id}}
        onLayout={event=>nav.cellLayout(item.id,event)}
        onPress={()=>{onSelect(item.id);nav.focus(item.id,true);}}
        style={({pressed})=>[styles.moreNavItem,selected===item.id&&styles.moreNavActive,
          pressed&&styles.optionPressed]}>
        <Ionicons name={item.icon} color={selected===item.id?colors.primary:colors.textMuted} size={18}/>
        <AppText variant="caption" weight="semibold" numberOfLines={2}
          style={{color:selected===item.id?colors.primary:colors.text,textAlign:"center"}}>
          {t(`pd1.tab.${item.id}` as never)}
        </AppText>
      </Pressable>)}
    </ScrollView>
  </View>;
}
function Stat({value,label,icon}:{value:number;label:string;icon:keyof typeof Ionicons.glyphMap}){
  return <View style={styles.stat}>
    <View style={styles.statIcon}><Ionicons name={icon} size={19} color={colors.primary}/></View>
    <AppText variant="title" weight="bold" forceLtr style={styles.statValue}>{value}</AppText>
    <AppText variant="caption" muted weight="medium" style={styles.statLabel}>{label}</AppText>
  </View>;
}
function OverviewTitle({icon,label}:{icon:keyof typeof Ionicons.glyphMap;label:string}){
  const {isRTL}=useLocale();
  return <View style={[styles.overviewHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
    <View style={styles.headingIcon}><Ionicons name={icon} color={colors.primary} size={20}/></View>
    <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>{label}</AppText>
  </View>;
}
export function PlayerDashboard(){
  const {session}=useAuth(),{t,isRTL,language}=useLocale();
  const {height:viewportHeight}=useWindowDimensions();
  const token=session?.accessToken;
  const tr=(key:string)=>t(`pd1.${key}` as never);
  const date=(s:string)=>formatCompetitionDateTime(s,language);
  const [tab,setTab]=useState<Section>("overview");
  const [activityTab,setActivityTab]=useState<ActivityTab>("competitions");
  const [careerTab,setCareerTab]=useState<CareerTab>("statistics");
  const [storedData,setData]=useState<PlayerDashboardOverview|null>(null);
  const [loadedActor,setLoadedActor]=useState<string|null>(null);
  const data=loadedActor===session?.user.id?storedData:null;
  const [preferences,setPreferences]=useState<PlayerDashboardPreferences>(emptyPreferences);
  const [directory,setDirectory]=useState<TeamDirectoryItemDto[]>([]);
  const [teamQuery,setTeamQuery]=useState("");
  const [memberQuery,setMemberQuery]=useState("");
  const [requestFilter,setRequestFilter]=useState<"ALL"|"PENDING"|"RESOLVED">("ALL");
  const [directoryLoading,setDirectoryLoading]=useState(false);
  const [directoryError,setDirectoryError]=useState<string|null>(null);
  const [provinceFilter,setProvinceFilter]=useState("");
  const [teamPanel,setTeamPanel]=useState<"MINE"|"INVITES"|"REQUESTS"|"FIND">("MINE");
  const [busy,setBusy]=useState<string|null>(null),[loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null);
  const [confirmLeave,setConfirmLeave]=useState<string|null>(null);
  const [confirmDecline,setConfirmDecline]=useState<string|null>(null);
  const [confirmCancelRequest,setConfirmCancelRequest]=useState<string|null>(null);
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
  const choose=(id:Section)=>{
    if(id!==tab)setTab(id);
    focusTab(id,true);setConfirmLeave(null);
  };
  // Restore the previous nested section when returning from another tab.
  useEffect(()=>{
    setLoadedActor(null);setData(null);setDirectory([]);
    setPreferences(emptyPreferences);setTeamPanel("MINE");
    setTeamQuery("");setMemberQuery("");setRequestFilter("ALL");
    setProvinceFilter("");setConfirmLeave(null);setConfirmDecline(null);
    setConfirmCancelRequest(null);setDirectoryError(null);setDirectoryLoading(false);
    setActivityTab("competitions");setCareerTab("statistics");
    setError(null);setMessage(null);
  },[session?.user.id]);

  useFocusEffect(useCallback(()=>{
    let mounted=true;
    if(!token){setLoading(false);return()=>{mounted=false;};}
    setLoading(true);setError(null);
    void playerDashboardApi.overview(token).then(v=>{
      if(mounted){setData(v);setLoadedActor(session?.user.id??null);setPreferences(v.preferences);}
    }).catch(e=>{if(mounted){setData(null);setError(e instanceof ApiRequestError?e.message:t("pd1.loadError"));}})
      .finally(()=>{if(mounted)setLoading(false);});
    return()=>{mounted=false;};
  },[token,session?.user.id,refresh,t]));

  useEffect(()=>{
    if(tab!=="teams"||teamPanel!=="FIND"||!token)return;
    let mounted=true;setDirectoryLoading(true);setDirectoryError(null);
    void teamApi.directory(token).then(v=>{if(mounted)setDirectory(v.teams);})
      .catch(e=>{if(mounted){setDirectory([]);setDirectoryError(
        e instanceof ApiRequestError?e.message:t("pd1.teamLoadError"));}})
      .finally(()=>{if(mounted)setDirectoryLoading(false);});
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
  const pendingInvites=(data?.invitations??[])
    .filter(x=>x.status==="PENDING"&&Date.parse(x.expiresAt)>Date.now())
    .sort((a,b)=>Date.parse(a.expiresAt)-Date.parse(b.expiresAt));
  const pendingRequests=data?.requests.filter(x=>x.status==="PENDING")??[];
  const memberTeams=teams.filter(x=>[x.name,x.city].some(v=>
    (v??"").toLocaleLowerCase().includes(memberQuery.trim().toLocaleLowerCase())))
    .sort((a,b)=>Number(b.id===selected?.id)-Number(a.id===selected?.id));
  const visibleRequests=(data?.requests??[]).filter(x=>
    requestFilter==="ALL"||(requestFilter==="PENDING"?x.status==="PENDING":x.status!=="PENDING"));
  // The API permits a new join request only for verified basic accounts without a role.
  const canRequestJoin=session?.user.emailVerified===true&&(session?.user.roles.length??0)===0;
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
    {tab==="activity"?<SectionNavigation kind="activity" items={activityTabs}
      selected={activityTab} onSelect={setActivityTab}/>:null}
    {tab==="career"?<SectionNavigation kind="career" items={careerTabs}
      selected={careerTab} onSelect={setCareerTab}/>:null}

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary" onPress={()=>setRefresh(x=>x+1)}/></Card>:null}
    {message?<Card style={{backgroundColor:colors.primarySoft}}>
      <AppText style={{color:colors.primary}}>{message}</AppText></Card>:null}
    {/* Keep the outer ScrollView from clamping upward when switching between
        tabs with very different content heights. */}
    <View testID="player-dashboard-tab-content" style={{minHeight:viewportHeight,gap:spacing.md}}>
    {loading?<DataLoadingState variant="dashboard" minHeight={440}/>:data?<>
      {tab==="overview"?<View testID="player-overview-content" style={styles.overview}>
        <View style={styles.overviewHero}>
          <View style={[styles.overviewIdentity,{flexDirection:isRTL?"row-reverse":"row"}]}>
            {profile?.imageUrl?<Image source={{uri:resolveMediaImageUrl(profile.imageUrl)??profile.imageUrl}}
              style={styles.overviewAvatar}/>:
              <View style={[styles.overviewAvatar,styles.overviewAvatarEmpty]}>
                <Ionicons name="person-outline" size={30} color={colors.primary}/>
              </View>}
            <View style={styles.overviewIdentityText}>
              <AppText variant="caption" muted>{tr("playerDashboard")}</AppText>
              <AppText variant="title" weight="bold" numberOfLines={2}>
                {profile?.publicDisplayName??session?.user.displayName??tr("playerDashboard")}
              </AppText>
              <View style={[styles.overviewLine,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <Ionicons name="shield-checkmark-outline" size={17} color={colors.primary}/>
                <AppText weight="semibold" numberOfLines={2} style={{flex:1}}>
                  {selected?.name??tr("noCurrentTeam")}</AppText>
              </View>
            </View>
          </View>
          <View style={[styles.overviewChips,{flexDirection:isRTL?"row-reverse":"row"}]}>
            {profile?.position?<View style={styles.overviewChip}>
              <Ionicons name="football-outline" size={14} color={colors.primary}/>
              <AppText variant="caption" weight="semibold">
                {t(`teams.position.${profile.position}` as never)}</AppText>
            </View>:null}
            {selectedRole?<View style={styles.overviewChip}>
              <Ionicons name="person-outline" size={14} color={colors.primary}/>
              <AppText variant="caption" weight="semibold">
                {t(`teams.role.${selectedRole}` as never)}</AppText>
            </View>:null}
          </View>
          <View style={[styles.overviewActions,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Button label={tr("editProfile")} style={styles.overviewAction}
              variant="secondary" icon={<Ionicons name="create-outline" size={18} color={colors.primary}/>}
              onPress={()=>router.push("/profile/player")}/>
            <Button label={tr("myTeams")} style={styles.overviewAction}
              variant="secondary" icon={<Ionicons name="people-outline" size={18} color={colors.primary}/>}
              onPress={()=>choose("teams")}/>
          </View>
          {selected&&data.whatsappGroups?.[selected.id]?
            <WhatsAppGroupButton url={data.whatsappGroups[selected.id]!}/>:null}
        </View>
        <View testID="player-overview-stats" style={styles.stats}>
          <Stat label={tr("matchesPlayed")} value={data.stats.matches} icon="football-outline"/>
          <Stat label={tr("goals")} value={data.stats.goals} icon="radio-button-on-outline"/>
          <Stat label={tr("assists")} value={data.stats.assists} icon="git-merge-outline"/>
          <Stat label={tr("awards")} value={data.stats.awards} icon="trophy-outline"/>
        </View>
        <Card style={styles.overviewSection}>
          <OverviewTitle icon="calendar-outline" label={tr("nextMatch")}/>
          {data.nextMatch?<View style={styles.sectionBody}>
            <View style={styles.matchBanner}>
              <AppText variant="bodyLarge" weight="bold" numberOfLines={2}
                style={styles.matchTeamName}>{data.nextMatch.homeTeamName}</AppText>
              <View style={styles.vsCircle}><AppText weight="bold" forceLtr
                style={styles.vsLabel}>VS</AppText></View>
              <AppText variant="bodyLarge" weight="bold" numberOfLines={2}
                style={styles.matchTeamName}>{data.nextMatch.awayTeamName}</AppText>
            </View>
            {data.nextMatch.startsAt?<View style={[styles.overviewLine,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Ionicons name="time-outline" size={17} color={colors.textMuted}/>
              <AppText muted variant="caption">{date(data.nextMatch.startsAt)}</AppText>
            </View>:null}
            <Button label={tr("matchDetails")} onPress={()=>router.push({
              pathname:"/competitions/[competitionId]/matches/[matchId]",
              params:{competitionId:data.nextMatch!.competitionId,matchId:data.nextMatch!.id},
            })}/>
          </View>:<View style={[styles.overviewEmpty,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Ionicons name="calendar-clear-outline" size={22} color={colors.textMuted}/>
            <AppText muted style={{flex:1}}>{tr("noNextMatch")}</AppText>
          </View>}
        </Card>
        <Card style={styles.overviewSection}>
          <OverviewTitle icon="notifications-outline" label={tr("needsAttention")}/>
          {pendingInvites.length===0&&pendingRequests.length===0&&
            data.activities.filter(a=>!a.availability).length===0?
            <View style={[styles.overviewEmpty,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Ionicons name="checkmark-circle-outline" size={22} color={colors.success}/>
              <AppText muted style={{flex:1}}>{tr("noUrgentItems")}</AppText>
            </View>:null}
          {pendingInvites.length>0?<Button variant="secondary"
            label={tr("pendingInvitations")+" ("+pendingInvites.length+")"}
            onPress={()=>{setTeamPanel("INVITES");choose("teams");}}/>:null}
          {pendingRequests.length>0?<Button variant="secondary"
            label={tr("pendingRequestsCount")+" ("+pendingRequests.length+")"}
            onPress={()=>{setTeamPanel("REQUESTS");choose("teams");}}/>:null}
          {data.activities.filter(a=>!a.availability).slice(0,3).map(a=>
            <View key={a.id} style={styles.overviewItem}>
              <AppText weight="semibold">{a.title}</AppText>
              <View style={[styles.overviewLine,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <Ionicons name="time-outline" size={15} color={colors.textMuted}/>
                <AppText variant="caption" muted>{date(a.startsAt)}</AppText>
              </View>
              <Button label={tr("respondToActivity")} variant="secondary"
                onPress={()=>router.push({pathname:"/teams/[teamId]/activities",
                  params:{teamId:a.teamId}})}/>
            </View>)}
        </Card>
        <Card style={styles.overviewSection}>
          <OverviewTitle icon="calendar-number-outline" label={tr("upcomingActivities")}/>
          {data.activities.length===0?<View style={[styles.overviewEmpty,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Ionicons name="calendar-outline" size={22} color={colors.textMuted}/>
            <AppText muted style={{flex:1}}>{tr("noUpcomingActivities")}</AppText>
          </View>:null}
          {data.activities.slice(0,3).map(a=><View key={a.id} style={styles.overviewItem}>
            <AppText weight="semibold">{a.title}</AppText>
            <View style={[styles.overviewLine,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Ionicons name="time-outline" size={15} color={colors.textMuted}/>
              <AppText variant="caption" muted>{date(a.startsAt)}</AppText>
            </View>
            <Button label={tr("openActivity")} variant="secondary"
              onPress={()=>router.push({pathname:"/teams/[teamId]/activities",
                params:{teamId:a.teamId}})}/>
          </View>)}
        </Card>
        <Card style={styles.overviewSection}>
          <OverviewTitle icon="stats-chart-outline" label={tr("recentPerformance")}/>
          {matches.length===0?<View style={[styles.overviewEmpty,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Ionicons name="stats-chart-outline" size={22} color={colors.textMuted}/>
            <AppText muted style={{flex:1}}>{tr("noRecentMatches")}</AppText>
          </View>:null}
          {matches.map(match=><View key={match.matchId} style={styles.overviewItem}>
            <AppText variant="caption" muted>
              {match.startsAt?date(match.startsAt):tr("unscheduled")}</AppText>
            <View style={[styles.performanceRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <View style={styles.performancePill}>
                <Ionicons name="football-outline" size={15} color={colors.primary}/>
                <AppText weight="semibold">{tr("goals")}: {match.goals}</AppText>
              </View>
              <View style={styles.performancePill}>
                <Ionicons name="git-merge-outline" size={15} color={colors.primary}/>
                <AppText weight="semibold">{tr("assists")}: {match.assists}</AppText>
              </View>
            </View>
          </View>)}
        </Card>
      </View>:null}

      {tab==="teams"?<>
        <Choice selected={teamPanel} onSelect={v=>{
            setTeamPanel(v as typeof teamPanel);setConfirmDecline(null);setConfirmCancelRequest(null);
          }}
          items={["MINE","INVITES","REQUESTS","FIND"].map(id=>({id,label:tr("teamPanel."+id)}))}/>
        <View testID="player-team-summary" style={[styles.teamSummary,
          {flexDirection:isRTL?"row-reverse":"row"}]}>
          {([
            {id:"MINE",count:teams.length,icon:"shield-outline"},
            {id:"INVITES",count:pendingInvites.length,icon:"mail-unread-outline"},
            {id:"REQUESTS",count:pendingRequests.length,icon:"hourglass-outline"},
          ] as const).map(item=><Pressable key={item.id} accessibilityRole="button"
            accessibilityLabel={tr("teamPanel."+item.id)+": "+item.count}
            accessibilityState={{selected:teamPanel===item.id}}
            onPress={()=>setTeamPanel(item.id)}
            style={[styles.teamSummaryCard,teamPanel===item.id&&styles.teamSummaryActive]}>
            <Ionicons name={item.icon} size={20} color={colors.primary}/>
            <AppText forceLtr variant="bodyLarge" weight="bold"
              style={styles.teamSummaryNumber}>{item.count}</AppText>
            <AppText variant="caption" numberOfLines={2}
              style={styles.teamSummaryLabel}>{tr("teamPanel."+item.id)}</AppText>
          </Pressable>)}
        </View>
        {teamPanel==="MINE"?<>
          <View style={[styles.teamListHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <AppText variant="bodyLarge" weight="bold">{tr("myTeams")}</AppText>
            <View style={styles.teamCountBadge}><AppText forceLtr weight="bold"
              style={styles.teamCountText}>{teams.length}</AppText></View>
          </View>
          {teams.length>1?<TextField label={tr("filterMyTeams")}
            value={memberQuery} onChangeText={setMemberQuery}/>:null}
          {teams.length>0&&memberTeams.length===0?<Card>
            <AppText muted>{tr("noFilteredTeams")}</AppText>
          </Card>:null}
          {!teams.length?<Card><AppText muted>{tr("noTeams")}</AppText>
            <Button label={tr("findTeam")} onPress={()=>setTeamPanel("FIND")}/></Card>:null}
          {memberTeams.map(team=>{
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
              {confirmDecline===invite.id?<View style={styles.teamConfirmBox}>
                <AppText>{tr("confirmDecline")}</AppText>
                <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
                  <Button label={t("teams.decline")} variant="danger"
                    disabled={busy!==null} loading={busy===invite.id}
                    onPress={()=>void perform(invite.id,
                      ()=>teamApi.declineInvitation(token!,invite.id),()=>setConfirmDecline(null))}/>
                  <Button label={t("common.cancel")} variant="secondary"
                    disabled={busy!==null} onPress={()=>setConfirmDecline(null)}/>
                </View>
              </View>:<Button label={t("teams.decline")} variant="secondary"
                disabled={busy!==null} onPress={()=>setConfirmDecline(invite.id)}/>}

            </View>
          </Card>)}
        </>:null}
        {teamPanel==="REQUESTS"?<>
          <Choice selected={requestFilter} onSelect={v=>{
            setRequestFilter(v as typeof requestFilter);setConfirmCancelRequest(null);
          }} items={[
            {id:"ALL",label:tr("filterAll")},
            {id:"PENDING",label:tr("filterPending")},
            {id:"RESOLVED",label:tr("filterHistory")},
          ]}/>
          {!data.requests.length?<Card><AppText muted>{tr("noRequests")}</AppText></Card>:null}
          {data.requests.length>0&&visibleRequests.length===0?<Card>
            <AppText muted>{tr("noFilteredRequests")}</AppText>
          </Card>:null}
          {visibleRequests.map(req=><Card key={req.id}>
            <AppText weight="bold">{req.teamName}</AppText>
            <View style={[styles.requestStatusRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <View style={[styles.requestStatusBadge,
                req.status==="PENDING"&&styles.requestStatusPending]}>
                <AppText variant="caption" weight="semibold"
                  style={{color:req.status==="PENDING"?colors.primary:colors.textMuted}}>
                  {tr("requestStatus."+req.status)}</AppText>
              </View>
              <AppText variant="caption" muted>{date(req.createdAt)}</AppText>
            </View>
            {req.respondedAt?<AppText variant="caption" muted>
              {tr("respondedAt")}: {date(req.respondedAt)}</AppText>:null}
            <View style={styles.actions}>
              <Button label={tr("viewTeam")} variant="secondary" onPress={()=>router.push({
                pathname:"/teams/[teamId]",params:{teamId:req.teamId}})}/>
              {req.status==="PENDING"?(confirmCancelRequest===req.id?
                <View style={styles.teamConfirmBox}>
                  <AppText>{tr("confirmCancelRequest")}</AppText>
                  <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
                    <Button label={tr("cancelRequest")} variant="danger"
                      disabled={busy!==null} loading={busy===req.id}
                      onPress={()=>void perform(req.id,
                        ()=>playerDashboardApi.cancelRequest(token!,req.id),
                        ()=>setConfirmCancelRequest(null))}/>
                    <Button label={t("common.cancel")} variant="secondary"
                      disabled={busy!==null} onPress={()=>setConfirmCancelRequest(null)}/>
                  </View>
                </View>:
                <Button label={tr("cancelRequest")} variant="ghost"
                  disabled={busy!==null} onPress={()=>setConfirmCancelRequest(req.id)}/>):null}
            </View>
          </Card>)}
        </>:null}
        {teamPanel==="FIND"?<>
          <Card>
            <TextField label={tr("searchTeams")} value={teamQuery} onChangeText={setTeamQuery}/>
            <Choice selected={provinceFilter} onSelect={setProvinceFilter}
              items={[{id:"",label:tr("allProvinces")},...cities.map(city=>({id:city,label:city}))]}/>
            <AppText variant="caption" muted>{tr("findHint")}</AppText>
            {!canRequestJoin?<View style={styles.teamNotice}>
              <Ionicons name="information-circle-outline" color={colors.primary} size={20}/>
              <AppText variant="caption" style={{flex:1}}>{tr("findPlayerNotice")}</AppText>
            </View>:null}
          </Card>
          {directoryError?<Card>
            <AppText style={{color:colors.danger}}>{directoryError}</AppText>
            <Button variant="secondary" label={t("common.retry")}
              onPress={()=>setRefresh(x=>x+1)}/>
          </Card>:null}
          {directoryLoading?<DataLoadingState variant="list" minHeight={180}/>:null}
          {!directoryLoading&&!directoryError&&!discover.length?
            <Card><AppText muted>{tr("noResults")}</AppText></Card>:null}
          {!directoryLoading&&!directoryError?discover.map(team=><Card key={team.id} style={styles.memberTeamCard}>
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
              {canRequestJoin?<Button style={styles.teamActionButton}
                label={team.myMembershipRole?tr("alreadyMember"):
                  team.joinRequestStatus==="PENDING"?tr("requested"):
                  !team.allowJoinRequests?tr("requestClosed"):tr("requestJoin")}
                disabled={busy!==null||Boolean(team.myMembershipRole)||
                  team.joinRequestStatus==="PENDING"||!team.allowJoinRequests}
                loading={busy===team.id} onPress={()=>void perform(team.id,
                  ()=>teamApi.requestJoin(token!,team.id))}/>:null}
            </View>
          </Card>):null}
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

      {tab==="activity"?<PlayerActivityTabs tab={activityTab} token={token!} teams={teams}/>:null}
      {tab==="career"?<PlayerCareerTabs tab={careerTab} token={token!}/>:null}
    </>:null}
    </View>
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
  navTab:{alignItems:"center",gap:spacing.xs,paddingVertical:spacing.sm,paddingHorizontal:spacing.md,
    borderBottomWidth:3,borderBottomColor:"transparent",minWidth:83,minHeight:55,
    borderTopLeftRadius:radius.sm,borderTopRightRadius:radius.sm},
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
  teamSummary:{gap:spacing.sm,flexWrap:"wrap"},
  teamSummaryCard:{flex:1,flexBasis:"28%",minWidth:92,alignItems:"center",
    justifyContent:"center",gap:spacing.xs,minHeight:94,padding:spacing.sm,
    borderRadius:radius.md,backgroundColor:colors.surface,
    borderWidth:1,borderColor:colors.border},
  teamSummaryActive:{backgroundColor:colors.primarySoft,borderColor:colors.primary},
  teamSummaryNumber:{color:colors.primary,textAlign:"center"},
  teamSummaryLabel:{textAlign:"center"},
  teamConfirmBox:{flex:1,gap:spacing.sm,width:"100%",padding:spacing.sm,
    borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
  requestStatusRow:{gap:spacing.sm,alignItems:"center",flexWrap:"wrap"},
  requestStatusBadge:{borderRadius:radius.pill,paddingVertical:spacing.xs,
    paddingHorizontal:spacing.md,backgroundColor:colors.surfaceMuted},
  requestStatusPending:{backgroundColor:colors.primarySoft},
  teamNotice:{flexDirection:"row",alignItems:"center",gap:spacing.sm,
    padding:spacing.sm,backgroundColor:colors.primarySoft,borderRadius:radius.md},
  moreNavFrame:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.md,overflow:"hidden"},
  moreNavScroll:{flexGrow:0,minHeight:56},
  moreNavRow:{alignItems:"center",gap:spacing.xs,padding:spacing.xs},
  moreNavItem:{flexShrink:0,minWidth:105,minHeight:48,alignItems:"center",justifyContent:"center",
    gap:3,borderRadius:radius.sm,borderWidth:1,borderColor:colors.border,
    backgroundColor:colors.surface,paddingHorizontal:spacing.md,paddingVertical:spacing.xs},
  moreNavActive:{backgroundColor:colors.primarySoft,borderColor:colors.primary},
  overview:{gap:spacing.md},
  overviewHero:{gap:spacing.md,padding:spacing.md,
    backgroundColor:"#EDF4FF",borderWidth:1,borderColor:"#C8D9F8",
    borderRadius:radius.lg},
  overviewIdentity:{alignItems:"center",gap:spacing.md},
  overviewAvatar:{height:72,width:72,borderRadius:radius.lg,overflow:"hidden"},
  overviewAvatarEmpty:{alignItems:"center",justifyContent:"center",backgroundColor:colors.surface,
    borderWidth:1,borderColor:colors.border},
  overviewIdentityText:{flex:1,minWidth:0,gap:spacing.xs},
  overviewLine:{flexDirection:"row",alignItems:"center",gap:spacing.xs,flexWrap:"wrap"},
  overviewChips:{gap:spacing.xs,flexWrap:"wrap"},
  overviewChip:{flexDirection:"row",alignItems:"center",gap:spacing.xs,
    backgroundColor:colors.surface,borderColor:colors.border,borderWidth:1,
    borderRadius:radius.sm,paddingVertical:spacing.xs,paddingHorizontal:spacing.sm},
  overviewActions:{gap:spacing.sm,flexWrap:"wrap"},
  overviewAction:{flexGrow:1,flexBasis:185,minWidth:155,paddingHorizontal:spacing.sm},
  stats:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  stat:{flexGrow:1,flexBasis:"40%",minWidth:125,backgroundColor:colors.surface,
    borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,minHeight:130,
    alignItems:"center",gap:spacing.xs,padding:spacing.md},
  statIcon:{width:35,height:35,backgroundColor:colors.primarySoft,
    borderRadius:radius.md,alignItems:"center",justifyContent:"center"},
  statValue:{color:colors.primary,textAlign:"center"},
  statLabel:{textAlign:"center"},
  overviewSection:{gap:spacing.md},
  overviewHeading:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  headingIcon:{width:36,height:36,alignItems:"center",justifyContent:"center",
    backgroundColor:colors.primarySoft,borderRadius:radius.md},
  sectionBody:{gap:spacing.md},
  matchBanner:{flexDirection:"row",alignItems:"center",gap:spacing.sm,padding:spacing.sm,
    backgroundColor:"#F4F7FF",borderRadius:radius.md},
  matchTeamName:{flex:1,minWidth:0,textAlign:"center"},
  vsCircle:{width:37,height:37,borderRadius:radius.pill,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  vsLabel:{fontSize:12,color:colors.primary},
  overviewEmpty:{flexDirection:"row",alignItems:"center",gap:spacing.sm,padding:spacing.md,
    borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
  overviewItem:{borderTopWidth:1,borderColor:colors.border,paddingTop:spacing.md,
    gap:spacing.sm},
  performanceRow:{gap:spacing.sm,flexWrap:"wrap"},
  performancePill:{flexDirection:"row",gap:spacing.xs,alignItems:"center",
    backgroundColor:colors.primarySoft,borderRadius:radius.sm,
    paddingHorizontal:spacing.sm,paddingVertical:spacing.xs},
  item:{borderTopWidth:1,borderColor:colors.border,marginTop:spacing.sm,paddingTop:spacing.sm,
    gap:spacing.sm},
});
