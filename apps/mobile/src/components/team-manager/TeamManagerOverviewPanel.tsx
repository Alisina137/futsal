import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {TeamDto} from "@leaguekick/contracts";
import {router} from "expo-router";
import {Image,Pressable,StyleSheet,View} from "react-native";
import {formatCompetitionDateTime} from "../../lib/date-time";
import {resolveMediaImageUrl,type TeamManagerOverview,type TeamOperations} from "../../lib/api";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";

type Destination="players"|"competitions"|"matches"|"schedule"|"media"|"statistics"|"settings";
type Props={
  team:TeamDto;overview:TeamManagerOverview;
  operations:TeamOperations|null;operationsReady:boolean;operationsFailed:boolean;
  onRetryOperations:()=>void;
  pendingRequests:number|null;pendingInvites:number|null;unreadNotifications:number|null;
  canWrite:boolean;subscriptionStatus:string|null;subscriptionUntil:string|null;
  onOpen:(tab:Destination)=>void;onLineup:(id:string)=>void;
  onPlayersSection:(section:"REQUESTS"|"INVITATIONS")=>void;
  onCompetitionSection:(section:"MINE"|"INVITATIONS")=>void;
};
type Attention={key:string;icon:keyof typeof Ionicons.glyphMap;count:number;
  label:string;destination:Destination|"notifications"|"subscription";matchId?:string};
const FUTURE_MATCH=(status:string)=>status==="SCHEDULED";
const endOfWindow=(hours:number)=>Date.now()+hours*60*60*1000;

function Metric({icon,value,label}:{icon:keyof typeof Ionicons.glyphMap;value:number|string;label:string}){
  return <View style={styles.metric}>
    <Ionicons name={icon} size={20} color={colors.primary}/>
    <AppText variant="title" weight="bold" style={{color:colors.primary}}>{value}</AppText>
    <AppText variant="caption" muted style={{textAlign:"center"}}>{label}</AppText>
  </View>;
}

export function TeamManagerOverviewPanel({
  team,overview,operations,operationsReady,operationsFailed,onRetryOperations,
  pendingRequests,pendingInvites,unreadNotifications,canWrite,
  subscriptionStatus,subscriptionUntil,onOpen,onLineup,onPlayersSection,onCompetitionSection,
}:Props){
  const {t,language,isRTL}=useLocale();
  const tr=(key:string)=>t(`tmOverview.${key}` as never);
  const now=Date.now();
  const upcoming=operationsReady?operations?.matches.filter(m=>m.startsAt&&
    Date.parse(m.startsAt)>now&&FUTURE_MATCH(m.status))??[]:[];
  const missingLineups=upcoming.filter(m=>!m.lineup||m.lineup.starters.length<5);
  const competitionInvites=operationsReady?operations?.competitions.filter(c=>c.registrationStatus==="INVITED")??[]:[];
  const missingRosters=operationsReady?operations?.competitions.filter(c=>
    c.registrationStatus==="ACCEPTED"&&!c.rosterLocked&&c.rosterUserIds.length===0)??[]:[];
  const activities=operationsReady?operations?.activities.filter(a=>
    Date.parse(a.startsAt)>now&&Date.parse(a.startsAt)<endOfWindow(168))??[]:[];
  const expiry=subscriptionUntil?Date.parse(subscriptionUntil):NaN;
  const expiresSoon=canWrite&&Number.isFinite(expiry)&&expiry>=now&&expiry<=endOfWindow(168);
  const attention:Attention[]=[];
  if(pendingRequests!==null&&pendingRequests>0)attention.push({key:"requests",icon:"person-add-outline",
    count:pendingRequests,label:tr("joinRequests"),destination:"players"});
  if(operationsReady&&competitionInvites.length)attention.push({key:"competitions",icon:"trophy-outline",
    count:competitionInvites.length,label:tr("competitionInvitations"),destination:"competitions"});
  if(operationsReady&&missingLineups.length)attention.push({key:"lineups",icon:"clipboard-outline",
    count:missingLineups.length,label:tr("missingLineups"),destination:"matches",matchId:missingLineups[0]!.id});
  if(operationsReady&&missingRosters.length)attention.push({key:"rosters",icon:"people-outline",
    count:missingRosters.length,label:tr("missingRosters"),destination:"competitions"});
  if(pendingInvites!==null&&pendingInvites>0)attention.push({key:"invitations",icon:"mail-unread-outline",
    count:pendingInvites,label:tr("pendingInvitations"),destination:"players"});
  if(operationsReady&&activities.length)attention.push({key:"program",icon:"calendar-outline",
    count:activities.length,label:tr("upcomingActivities"),destination:"schedule"});
  if(!canWrite&&subscriptionStatus!==null)attention.push({key:"billing",icon:"alert-circle-outline",
    count:1,label:tr("subscriptionRequired"),destination:"subscription"});
  else if(expiresSoon)attention.push({key:"billing",icon:"time-outline",
    count:1,label:tr("subscriptionExpiring"),destination:"subscription"});
  if(unreadNotifications!==null&&unreadNotifications>0)attention.push({key:"notifications",
    icon:"notifications-outline",count:unreadNotifications,label:tr("unreadNotifications"),destination:"notifications"});
  const attentionComplete=operationsReady&&pendingRequests!==null&&pendingInvites!==null&&unreadNotifications!==null;
  const total=attentionComplete?attention.reduce((sum,item)=>sum+item.count,0):"—";
  const next=overview.nextMatch;
  const fixture=next&&operationsReady?operations?.matches.find(m=>m.id===next.id):null;
  const lineupReady=fixture?fixture.lineup!==null&&fixture.lineup.starters.length===5:false;
  const teamImage=resolveMediaImageUrl(team.logoUrl);
  const opponentImage=resolveMediaImageUrl(next?.opponentLogoUrl??null);
  const go=(item:Attention)=>{
    if(item.matchId){onLineup(item.matchId);return;}
    if(item.key==="requests"){onPlayersSection("REQUESTS");return;}
    if(item.key==="invitations"){onPlayersSection("INVITATIONS");return;}
    if(item.key==="competitions"){onCompetitionSection("INVITATIONS");return;}
    if(item.key==="rosters"){onCompetitionSection("MINE");return;}
    if(item.destination==="notifications"){router.push("/notifications");return;}
    if(item.destination==="subscription"){router.push("/role-subscriptions/team-owner");return;}
    onOpen(item.destination);
  };

  return <View testID="team-manager-phase2-overview" style={styles.root}>
    <Card style={styles.identity}>
      <View style={[styles.identityRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {teamImage?<Image source={{uri:teamImage}} style={styles.teamLogo}/>:
          <View style={[styles.teamLogo,styles.logoEmpty]}>
            <Ionicons name="shield-checkmark-outline" size={30} color={colors.primary}/>
          </View>}
        <View style={styles.identityText}>
          <AppText variant="bodyLarge" weight="bold" numberOfLines={2}>{team.name}</AppText>
          <AppText variant="caption" muted>{team.city}</AppText>
          <AppText variant="caption" weight="semibold" style={{color:canWrite?colors.success:colors.warning}}>
            {tr("managementStatus")}: {canWrite?tr("active"):tr("readOnly")}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={tr("publicProfile")}
          onPress={()=>router.push({pathname:"/teams/[teamId]",params:{teamId:team.id}})}
          style={styles.profileIcon}>
          <Ionicons name="open-outline" size={21} color={colors.primary}/>
        </Pressable>
      </View>
    </Card>

    <View testID="team-manager-phase2-metrics" style={styles.metrics}>
      <Metric icon="people-outline" label={tr("activePlayers")} value={team.rosterCount}/>
      <Metric icon="calendar-outline" label={tr("upcomingMatches")}
        value={overview.stats.upcoming}/>
      <Metric icon="trophy-outline" label={tr("competitions")}
        value={overview.stats.competitions}/>
      <Metric icon="alert-circle-outline" label={tr("needsAttention")} value={total}/>
    </View>

    <Card style={styles.record}>
      <View style={[styles.headerRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <AppText variant="bodyLarge" weight="bold">{tr("officialRecord")}</AppText>
        <Button label={tr("viewAnalytics")} variant="ghost" onPress={()=>onOpen("statistics")}/>
      </View>
      <AppText weight="semibold">{t("tm1.wins")}: {overview.stats.wins} · {tr("draws")}: {overview.stats.draws} · {tr("losses")}: {overview.stats.losses}</AppText>
      <AppText variant="caption" muted>{tr("winRate")}: {overview.stats.winRate}% · {tr("completedMatches")}: {overview.stats.played}</AppText>
      <AppText variant="caption" muted>{tr("verifiedOnly")}</AppText>
    </Card>

    <Card testID="team-manager-phase2-next-match" style={styles.nextMatch}>
      <AppText variant="bodyLarge" weight="bold">{t("tm1.upcomingMatch")}</AppText>
      {next?<>
        <View style={[styles.fixtureTeams,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.fixtureTeam}>
            {teamImage?<Image source={{uri:teamImage}} style={styles.fixtureLogo}/>:
              <Ionicons name="shield-outline" size={30} color={colors.primary}/>}
            <AppText weight="semibold" numberOfLines={2} style={styles.fixtureName}>{team.name}</AppText>
          </View>
          <AppText weight="bold" style={{color:colors.primary}}>VS</AppText>
          <View style={styles.fixtureTeam}>
            {opponentImage?<Image source={{uri:opponentImage}} style={styles.fixtureLogo}/>:
              <Ionicons name="shield-outline" size={30} color={colors.primary}/>}
            <AppText weight="semibold" numberOfLines={2} style={styles.fixtureName}>
              {next.opponentName||t("tm1.unknownOpponent")}
            </AppText>
          </View>
        </View>
        <AppText variant="caption" muted>{next.competitionName}</AppText>
        {next.venueName?<AppText variant="caption" muted>{tr("venue")}: {next.venueName}</AppText>:null}
        <AppText weight="semibold">{formatCompetitionDateTime(next.startsAt,language)}</AppText>
        {operationsReady&&fixture?<View style={styles.lineupStatus}>
          <Ionicons name={lineupReady?"checkmark-circle-outline":"alert-circle-outline"}
            color={lineupReady?colors.success:colors.warning} size={17}/>
          <AppText variant="caption" weight="semibold">
            {lineupReady?tr("lineupReady"):tr("lineupIncomplete")}
          </AppText>
        </View>:null}
        <View style={[styles.buttons,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Button label={tr("viewMatch")} style={styles.button} variant="secondary"
            onPress={()=>router.push({pathname:"/competitions/[competitionId]/matches/[matchId]",
              params:{competitionId:next.competitionId,matchId:next.id}})}/>
          {fixture&&fixture.status==="SCHEDULED"?<Button label={tr("manageLineup")}
            style={styles.button} disabled={!canWrite} onPress={()=>onLineup(next.id)}/>:null}
        </View>
      </>:<AppText muted>{t("tm1.noUpcoming")}</AppText>}
    </Card>

    <Card testID="team-manager-phase2-action-center" style={styles.attentionCard}>
      <View style={[styles.headerRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <AppText variant="bodyLarge" weight="bold">{tr("actionCenter")}</AppText>
        <Ionicons name="flash-outline" size={22} color={colors.primary}/>
      </View>
      {!operationsReady&&!operationsFailed?<DataLoadingState variant="list" minHeight={90}/>:null}
      {operationsFailed?<View style={styles.partialError}>
        <AppText variant="caption" muted>{tr("operationsUnavailable")}</AppText>
        <Button label={t("common.retry")} variant="secondary" onPress={onRetryOperations}/>
      </View>:null}
      {attention.map(item=><Pressable key={item.key} accessibilityRole="button"
        onPress={()=>go(item)} style={({pressed})=>[
          styles.attentionRow,{flexDirection:isRTL?"row-reverse":"row"},pressed&&styles.pressed]}>
        <View style={styles.attentionIcon}>
          <Ionicons name={item.icon} size={20} color={colors.primary}/>
        </View>
        <View style={styles.attentionBody}>
          <AppText weight="semibold">{item.label}</AppText>
        </View>
        <View style={styles.countBadge}>
          <AppText weight="bold" variant="caption" style={{color:colors.primary}}>{item.count}</AppText>
        </View>
        <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={18} color={colors.textMuted}/>
      </Pressable>)}
      {attention.length===0&&attentionComplete?<View style={styles.emptyAttention}>
        <Ionicons name="checkmark-circle-outline" size={30} color={colors.success}/>
        <AppText muted>{tr("allCaughtUp")}</AppText>
      </View>:null}
    </Card>

    <Card style={styles.quickActions}>
      <AppText variant="bodyLarge" weight="bold">{t("tm1.quickActions")}</AppText>
      <View style={[styles.buttons,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Button label={t("tm1.invitePlayer")} variant="secondary" style={styles.button}
          onPress={()=>onOpen("players")}/>
        <Button label={tr("teamProgram")} variant="secondary" style={styles.button}
          onPress={()=>onOpen("schedule")}/>
      </View>
      <View style={[styles.buttons,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Button label={t("tm1.findCompetition")} variant="secondary" style={styles.button}
          onPress={()=>onOpen("competitions")}/>
        <Button label={t("tm1.bookVenue")} variant="secondary" style={styles.button}
          onPress={()=>router.push("/venues")}/>
      </View>
      <Button label={t("tm1.editTeam")} variant="ghost" onPress={()=>onOpen("settings")}/>
    </Card>
  </View>;
}

const styles=StyleSheet.create({
  root:{gap:spacing.md},
  identity:{padding:spacing.md},
  identityRow:{alignItems:"center",gap:spacing.md},
  identityText:{flex:1,minWidth:0,gap:spacing.xs},
  teamLogo:{width:62,height:62,borderRadius:radius.lg,backgroundColor:colors.surfaceMuted},
  logoEmpty:{alignItems:"center",justifyContent:"center"},
  profileIcon:{width:44,height:44,borderRadius:radius.md,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  metrics:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  metric:{flexBasis:"46%",flexGrow:1,minHeight:118,alignItems:"center",justifyContent:"center",
    padding:spacing.sm,gap:spacing.xs,backgroundColor:colors.surface,borderWidth:1,
    borderColor:colors.border,borderRadius:radius.lg},
  headerRow:{alignItems:"center",justifyContent:"space-between",gap:spacing.sm},
  record:{gap:spacing.sm},
  nextMatch:{gap:spacing.md},
  fixtureTeams:{alignItems:"center",justifyContent:"space-around",gap:spacing.sm},
  fixtureTeam:{flex:1,alignItems:"center",gap:spacing.xs,minWidth:0},
  fixtureLogo:{width:46,height:46,borderRadius:radius.md,backgroundColor:colors.primarySoft},
  fixtureName:{textAlign:"center"},
  buttons:{gap:spacing.sm,alignItems:"stretch"},
  button:{flex:1,minWidth:0,paddingHorizontal:spacing.xs},
  lineupStatus:{flexDirection:"row",gap:spacing.xs,alignItems:"center"},
  attentionCard:{gap:spacing.sm},
  attentionRow:{alignItems:"center",gap:spacing.sm,paddingVertical:spacing.sm,
    borderTopWidth:1,borderTopColor:colors.border,minHeight:55},
  attentionBody:{flex:1,minWidth:0},
  attentionIcon:{width:38,height:38,borderRadius:radius.md,
    backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"},
  countBadge:{paddingHorizontal:spacing.sm,minWidth:30,alignItems:"center",
    borderRadius:radius.pill,backgroundColor:colors.primarySoft,paddingVertical:spacing.xs},
  emptyAttention:{alignItems:"center",gap:spacing.sm,paddingVertical:spacing.lg},
  partialError:{gap:spacing.sm},
  quickActions:{gap:spacing.sm},
  pressed:{opacity:.7},
});
