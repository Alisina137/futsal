import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {
  CompetitionDto,CompetitionMatchDto,CompetitionMediaPostDto,
} from "@leaguekick/contracts";
import {router} from "expo-router";
import {useState,type ReactNode} from "react";
import {Image,Modal,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {resolveMediaImageUrl} from "../../lib/api";
import {competitionHomeSnapshot} from "../../lib/competition-detail-home";
import {formatLocalDateTimeParts,formatPostTimeAgo} from "../../lib/date-time";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {LeagueStandingsTable} from "./LeagueStandingsTable";
import {CompetitionKnockoutBracket} from "./CompetitionKnockoutBracket";
import {competitionStandingGroups,provisionalQualificationZone} from "../../lib/competition-detail-standings";
import {CompetitionMatchList,type MatchFilter} from "./CompetitionMatchList";
import type {CompetitionMatchPreferences} from "../../lib/competition-detail-match-filters";
import {Card} from "../ui/Card";

export type CompetitionProfileTab="HOME"|"MATCHES"|"STANDINGS"|"STATS"|"TEAMS"|"MEDIA"|"ABOUT";
type Stage="GROUPS"|"KNOCKOUT";
type StatMetric="goals"|"assists"|"appearances"|"cleanSheets"|"yellowCards"|"redCards"|"playerOfMatchAwards";
const STAT_METRICS:StatMetric[]=["goals","assists","appearances","cleanSheets","yellowCards","redCards","playerOfMatchAwards"];
type Props={
  competition:CompetitionDto;
  posts:CompetitionMediaPostDto[];
  activeTab:CompetitionProfileTab;
  subtab?:string;
  registration:ReactNode;
  onTabChange:(tab:CompetitionProfileTab)=>void;
  initialStage?:Stage|undefined;
  onStandingsStageChange?:((stage:Stage)=>void)|undefined;
  initialMatchFilter?:MatchFilter|undefined;
  matchPreferences?:CompetitionMatchPreferences;
  onMatchPreferencesChange?:(next:CompetitionMatchPreferences)=>void;
  onMatchStatusChange?:(next:MatchFilter)=>void;
  onMatchRefresh?:()=>void;
  matchRefreshing?:boolean;
  myAcceptedTeamId?:string|null;
};

export const COMPETITION_PROFILE_TABS:CompetitionProfileTab[]=[
  "HOME","MATCHES","STANDINGS","STATS","TEAMS","MEDIA","ABOUT",
];
export const COMPETITION_TAB_ICONS:Record<CompetitionProfileTab,keyof typeof Ionicons.glyphMap>={
  HOME:"home-outline",MATCHES:"calendar-outline",
  STANDINGS:"podium-outline",STATS:"stats-chart-outline",TEAMS:"people-outline",
  MEDIA:"images-outline",ABOUT:"information-circle-outline",
};
const isResult=(match:CompetitionMatchDto)=>match.status==="COMPLETED"||match.status==="CORRECTED";
const displayTime=(value:string|null,language:ReturnType<typeof useLocale>["language"])=>value
  ?formatLocalDateTimeParts(value,language):null;
const openTeam=(teamId:string)=>router.push({pathname:"/teams/[teamId]",params:{teamId}});

function SectionHeading({title,icon,count}:{title:string;icon:keyof typeof Ionicons.glyphMap;count?:number}){
  const {isRTL}=useLocale();
  return <View style={[styles.sectionHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
    <View style={styles.headingIcon}><Ionicons name={icon} size={20} color={colors.primary}/></View>
    <AppText weight="bold" variant="bodyLarge" style={{flex:1}}>{title}</AppText>
    {count!==undefined?<View style={styles.countPill}>
      <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>{count}</AppText>
    </View>:null}
  </View>;
}

function Placeholder({title,icon}:{title:string;icon:keyof typeof Ionicons.glyphMap}){
  return <Card style={styles.empty}>
    <View style={styles.emptyIcon}><Ionicons name={icon} size={30} color={colors.primary}/></View>
    <AppText muted style={{textAlign:"center"}}>{title}</AppText>
  </Card>;
}

function MatchCard({match,offlineIds}:{match:CompetitionMatchDto;offlineIds:Set<string>}){
  const {t,isRTL,language}=useLocale();
  const date=displayTime(match.startsAt,language);
  return <Card style={styles.matchCard}>
    <View style={[styles.matchMeta,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <AppText variant="caption" weight="semibold" style={{color:colors.primary,flex:1}}>
        {match.groupName?t("competition.group",{name:match.groupName}):
          t("competition.round",{number:match.roundNumber})}
      </AppText>
      <View style={styles.statusBadge}>
        <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
          {t(`competition.matchStatus.${match.status}` as never)}
        </AppText>
      </View>
      <Pressable accessibilityRole="button" testID={`bracket-match-detail-${match.id}`}
        onPress={()=>router.push({pathname:"/competitions/[competitionId]/matches/[matchId]",
          params:{competitionId:match.competitionId,matchId:match.id}})}
        style={styles.detailsLink}>
        <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
          {t("competition.phase4.matchDetails")}
        </AppText>
        <Ionicons name={isRTL?"arrow-back":"arrow-forward"} size={14} color={colors.primary}/>
      </Pressable>
    </View>
    <View style={[styles.scoreRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Pressable accessibilityRole={match.homeTeamId&&!offlineIds.has(match.homeTeamId)?"button":"text"}
        disabled={!match.homeTeamId||offlineIds.has(match.homeTeamId)} onPress={()=>match.homeTeamId&&!offlineIds.has(match.homeTeamId)&&openTeam(match.homeTeamId)}
        style={{flex:1,minWidth:0,paddingVertical:8}}>
        <AppText weight={match.winnerTeamId&&match.homeTeamId===match.winnerTeamId?"bold":"semibold"}
          numberOfLines={2} style={{textAlign:isRTL?"right":"left"}}>
          {match.homeTeamName??t("competition.tbd")}
        </AppText>
      </Pressable>
      <View style={styles.scoreBox}>
        <AppText variant="bodyLarge" weight="bold" forceLtr style={{color:colors.primary}}>
          {match.homeScore===null||match.awayScore===null?"–":`${match.homeScore} : ${match.awayScore}`}
        </AppText>
      </View>
      <Pressable accessibilityRole={match.awayTeamId&&!offlineIds.has(match.awayTeamId)?"button":"text"}
        disabled={!match.awayTeamId||offlineIds.has(match.awayTeamId)} onPress={()=>match.awayTeamId&&!offlineIds.has(match.awayTeamId)&&openTeam(match.awayTeamId)}
        style={{flex:1,minWidth:0,paddingVertical:8}}>
        <AppText weight={match.winnerTeamId&&match.awayTeamId===match.winnerTeamId?"bold":"semibold"}
          numberOfLines={2} style={{textAlign:isRTL?"left":"right"}}>
          {match.awayTeamName??t("competition.tbd")}
        </AppText>
      </Pressable>
    </View>
    {date?<View style={[styles.matchTime,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Ionicons name="time-outline" size={15} color={colors.textMuted}/>
      <AppText variant="caption" muted>{date.date} · {date.time}</AppText>
      {match.areaName?<AppText variant="caption" muted numberOfLines={1}>· {match.areaName}</AppText>:null}
    </View>:null}
    {match.stage==="KNOCKOUT"&&match.nextMatchId?<Pressable accessibilityRole="button"
      testID={`bracket-next-match-${match.id}`}
      onPress={()=>router.push({pathname:"/competitions/[competitionId]/matches/[matchId]",
        params:{competitionId:match.competitionId,matchId:match.nextMatchId!}})}
      style={[styles.progressionLink,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Ionicons name="git-branch-outline" size={16} color={colors.primary}/>
      <AppText variant="caption" weight="semibold" style={{color:colors.primary,flex:1}}>
        {t("competition.phase5.nextKnockoutMatch")}
      </AppText>
      <Ionicons name={isRTL?"arrow-back":"arrow-forward"} size={15} color={colors.primary}/>
    </Pressable>:null}
  </Card>;
}

function CompetitionStandings({competition,initialStage,onStageChange}:{
  competition:CompetitionDto;initialStage?:Stage|undefined;
  onStageChange?:((stage:Stage)=>void)|undefined;
}){
  const {t,isRTL}=useLocale();
  const mixed=competition.format==="GROUP_KNOCKOUT";
  const knockoutOnly=competition.format==="KNOCKOUT";
  const [stage,setStage]=useState<Stage>(initialStage??(knockoutOnly?"KNOCKOUT":"GROUPS"));
  const selectedStage=initialStage??stage;
  const [roundSelection,setRoundSelection]=useState<number|null>(null);
  const [selectedGroup,setSelectedGroup]=useState("ALL");
  const offlineIds=new Set(competition.teams.filter(team=>team.offline).map(team=>team.teamId));
  // Round 1 is the official final. We never infer a winner or an opponent.
  const knockout=competition.matches.filter(match=>match.stage==="KNOCKOUT")
    .sort((a,b)=>b.roundNumber-a.roundNumber||a.slotNumber-b.slotNumber);
  const rounds=[...new Set(knockout.map(match=>match.roundNumber))];
  const currentRound=roundSelection!==null&&rounds.includes(roundSelection)?roundSelection:rounds[0];
  const grouped=competitionStandingGroups(competition.standings,
    competition.format==="LEAGUE"?"LEAGUE":"GROUP");
  const currentGroup=grouped.some(group=>group.key===selectedGroup)?selectedGroup:"ALL";
  const visibleGroups=currentGroup==="ALL"?grouped:
    grouped.filter(group=>group.key===currentGroup);

  return <View style={styles.stack} testID="competition-phase5-standings">
    <SectionHeading title={t(mixed?"competition.profile.stages":"competition.standings")} icon="podium-outline"/>
    {mixed?<View style={[styles.stageSwitch,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {(["GROUPS","KNOCKOUT"] as const).map(option=>
        <Pressable key={option} testID={`competition-stage-${option}`} accessibilityRole="tab"
          accessibilityState={{selected:selectedStage===option}}
          onPress={()=>{setStage(option);onStageChange?.(option);}}
          style={[styles.stageButton,selectedStage===option&&styles.stageActive]}>
          <AppText weight="semibold" variant="caption"
            style={{color:selectedStage===option?"#FFFFFF":colors.primary}}>
            {t(option==="GROUPS"?"competition.profile.groupStage":"competition.profile.knockoutStage")}
          </AppText>
        </Pressable>)}
    </View>:null}
    {knockoutOnly||mixed&&selectedStage==="KNOCKOUT"?<>
      {knockout.length===0?<Placeholder title={t("competition.noBracket")} icon="git-branch-outline"/>:null}
      <CompetitionKnockoutBracket competition={competition}/>
      {rounds.length>0?<ScrollView horizontal showsHorizontalScrollIndicator={false}
        testID="competition-bracket-round-selector"
        contentContainerStyle={[styles.bracketRounds,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {rounds.map(round=><Pressable key={round} accessibilityRole="tab"
          accessibilityState={{selected:currentRound===round}}
          testID={`bracket-round-${round}`} onPress={()=>setRoundSelection(round)}
          style={[styles.roundChip,currentRound===round&&styles.roundChipActive]}>
          <AppText variant="caption" weight="semibold"
            style={{color:currentRound===round?"#FFFFFF":colors.primary}}>
            {t("competition.round",{number:round})}
          </AppText>
        </Pressable>)}
      </ScrollView>:null}
      {currentRound!==undefined?<View style={styles.stack}>
        <AppText variant="bodyLarge" weight="semibold">
          {t("competition.round",{number:currentRound})}
        </AppText>
        <AppText variant="caption" muted>{t("competition.phase5.bracketProgression")}</AppText>
        {knockout.filter(match=>match.roundNumber===currentRound).map(match=>
          <MatchCard key={match.id} match={match} offlineIds={offlineIds}/>)}
      </View>:null}
    </>:<>
      {competition.standings.length===0?<Placeholder title={t("competition.noStandings")}
        icon="podium-outline"/>:null}
      {mixed&&grouped.length>1?<ScrollView horizontal
        testID="competition-group-selector" showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.bracketRounds,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {["ALL",...grouped.map(group=>group.key)].map(key=><Pressable key={key}
          testID={`competition-group-option-${key}`} accessibilityRole="tab"
          accessibilityState={{selected:currentGroup===key}}
          onPress={()=>setSelectedGroup(key)}
          style={[styles.roundChip,currentGroup===key&&styles.roundChipActive]}>
          <AppText variant="caption" weight="semibold"
            style={{color:currentGroup===key?"#FFFFFF":colors.primary}}>
            {key==="ALL"?t("competition.detail.allGroups"):
              t("competition.group",{name:key})}
          </AppText>
        </Pressable>)}
      </ScrollView>:null}
      {visibleGroups.map(group=><Card key={group.key||"league"} style={styles.tableCard}>
        {group.label?<View style={[styles.groupHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={{flex:1,gap:2}}>
            <AppText variant="bodyLarge" weight="bold">
              {t("competition.group",{name:group.label})}
            </AppText>
            <AppText variant="caption" muted>
              {t("competition.detail.groupTeamCount",{count:group.rows.length})}
            </AppText>
          </View>
          <Ionicons name="people-outline" size={22} color={colors.primary}/>
        </View>:null}
        {competition.format==="GROUP_KNOCKOUT"&&group.label&&
          provisionalQualificationZone(group,competition.qualifiersPerGroup).length>0?
          <View testID={`competition-provisional-group-${group.key}`}
            style={[styles.groupProvisional,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Ionicons name="information-circle-outline" color="#146B39" size={17}/>
            <AppText variant="caption" style={{color:"#146B39",flex:1}}>
              {t("competition.detail.provisionalZone",{
                count:provisionalQualificationZone(group,competition.qualifiersPerGroup).length})}
            </AppText>
          </View>:null}
        <LeagueStandingsTable competition={competition}
          stage={competition.format==="LEAGUE"?"LEAGUE":"GROUP"}
          qualifiers={competition.format==="GROUP_KNOCKOUT"?competition.qualifiersPerGroup??undefined:undefined}
          rows={group.rows}/>
      </Card>)}
    </>}
  </View>;
}

const STAT_ICONS:Record<StatMetric,keyof typeof Ionicons.glyphMap>={
  goals:"football-outline",assists:"ribbon-outline",appearances:"walk-outline",
  cleanSheets:"shield-checkmark-outline",yellowCards:"alert-circle-outline",
  redCards:"close-circle-outline",playerOfMatchAwards:"medal-outline",
};

function CompetitionStats({competition}:{competition:CompetitionDto}){
  const {t,isRTL}=useLocale();
  const [metric,setMetric]=useState<StatMetric>("goals");
  const [teamId,setTeamId]=useState("ALL");
  const teams=competition.teams.filter(team=>team.status==="ACCEPTED");
  const recorded=competition.playerStats.filter(stat=>teams.some(team=>team.teamId===stat.teamId));
  const sorted=recorded.filter(stat=>(teamId==="ALL"||stat.teamId===teamId)&&stat[metric]>0)
    .sort((a,b)=>b[metric]-a[metric]||b.goals-a.goals||
      a.publicDisplayName.localeCompare(b.publicDisplayName)||a.playerUserId.localeCompare(b.playerUserId));
  return <View style={styles.stack} testID="competition-phase5-leaderboards">
    <SectionHeading title={t("competition.stats")} icon="stats-chart-outline"/>
    <Card style={styles.verifiedBanner}>
      <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary}/>
      <AppText variant="caption" muted style={{flex:1}}>
        {t("competition.phase5.verifiedOnly")}
      </AppText>
    </Card>
    <ScrollView horizontal testID="competition-stat-metrics" showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.statChips,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {STAT_METRICS.map(value=><Pressable key={value} testID={`competition-stats-${value}`}
        accessibilityRole="tab" accessibilityState={{selected:metric===value}}
        onPress={()=>setMetric(value)}
        style={[styles.roundChip,metric===value&&styles.roundChipActive]}>
        <Ionicons name={STAT_ICONS[value]} size={17}
          color={metric===value?"#FFFFFF":colors.primary}/>
        <AppText variant="caption" weight="semibold"
          style={{color:metric===value?"#FFFFFF":colors.primary}}>
          {t(`competition.phase5.metric.${value}` as never)}
        </AppText>
      </Pressable>)}
    </ScrollView>
    {teams.length>1?<ScrollView horizontal testID="competition-stat-team-filter"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.statChips,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Pressable accessibilityRole="tab" accessibilityState={{selected:teamId==="ALL"}}
        onPress={()=>setTeamId("ALL")} style={[styles.teamFilterChip,teamId==="ALL"&&styles.teamFilterActive]}>
        <AppText variant="caption" weight="semibold" style={{color:teamId==="ALL"?"#FFFFFF":colors.primary}}>
          {t("competition.phase5.allTeams")}
        </AppText>
      </Pressable>
      {teams.map(team=><Pressable key={team.teamId} accessibilityRole="tab"
        accessibilityState={{selected:teamId===team.teamId}} onPress={()=>setTeamId(team.teamId)}
        style={[styles.teamFilterChip,teamId===team.teamId&&styles.teamFilterActive]}>
        <AppText variant="caption" weight="semibold" numberOfLines={1}
          style={{color:teamId===team.teamId?"#FFFFFF":colors.primary}}>{team.teamName}</AppText>
      </Pressable>)}
    </ScrollView>:null}
    {sorted.length===0?<Placeholder title={t("competition.phase5.noRecordedMetric")} icon="stats-chart-outline"/>:null}
    {sorted.map((stat,index)=><Pressable key={`${stat.playerUserId}:${stat.teamId}`} accessibilityRole="button"
      onPress={()=>router.push({pathname:"/players/[playerId]",params:{playerId:stat.playerUserId}})}>
      <Card style={styles.statEntry}>
        <View style={[styles.scoreRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.rank}><AppText weight="bold" style={{color:colors.primary}}>#{index+1}</AppText></View>
          <View style={{flex:1,minWidth:0,gap:2}}>
            <AppText weight="semibold" numberOfLines={1}>{stat.publicDisplayName}</AppText>
            <AppText variant="caption" muted numberOfLines={1}>{stat.teamName}</AppText>
          </View>
          <View style={{alignItems:"center",minWidth:50}}>
            <AppText variant="title" weight="bold" style={{color:colors.primary}}>{stat[metric]}</AppText>
            <AppText variant="caption" muted>{t(`competition.phase5.metric.${metric}` as never)}</AppText>
          </View>
        </View>
      </Card>
    </Pressable>)}
  </View>;
}

function CompetitionTeams({competition,registration}:{competition:CompetitionDto;registration:ReactNode}){
  const {t,isRTL}=useLocale();
  const teams=competition.teams.filter(team=>team.status==="ACCEPTED");
  return <View style={styles.stack}>
    <SectionHeading icon="people-outline" title={t("competition.teams")} count={teams.length}/>
    {registration}
    {teams.length===0?<Placeholder icon="people-outline" title={t("competition.profile.noTeams")}/>:null}
    {teams.map(team=><Pressable key={team.teamId} accessibilityRole={team.offline?"text":"button"}
      disabled={team.offline} onPress={()=>!team.offline&&openTeam(team.teamId)}>
      <Card style={[styles.teamRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.teamLogo}>
          {resolveMediaImageUrl(team.logoUrl)
            ?<Image source={{uri:resolveMediaImageUrl(team.logoUrl)!}}
              style={styles.logoImage} resizeMode="cover"/>
            :<Ionicons name="shield-outline" size={24} color={colors.primary}/>}
        </View>
        <View style={{flex:1,minWidth:0,gap:4}}>
          <AppText weight="bold" numberOfLines={2}>{team.teamName}</AppText>
          {team.offline?<AppText variant="caption" muted>{t("competition.manualTeamBadge")}</AppText>:null}
          {team.groupName?<AppText muted variant="caption">{t("competition.group",{name:team.groupName})}</AppText>:null}
        </View>
        {team.seed?<View style={styles.seedBadge}>
          <AppText weight="semibold" variant="caption" style={{color:colors.primary}}>#{team.seed}</AppText>
        </View>:null}
        {!team.offline?<Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={19} color={colors.textMuted}/>:null}
      </Card>
    </Pressable>)}
  </View>;
}

/** The competition Home is a news feed. Only matches actually marked IN_PROGRESS
 * appear as live scores; completed results and upcoming fixtures have their own tabs.
 * Feed entries are not truncated, hidden, or reclassified as fake social posts. */
function Home({competition,posts,onTabChange,mode="HOME",view="OVERVIEW"}:
  Pick<Props,"competition"|"posts"|"onTabChange">&{mode?:"HOME"|"MEDIA";view?:string}){
  const offlineIds=new Set(competition.teams.filter(team=>team.offline).map(team=>team.teamId));
  const {t,isRTL,language}=useLocale();
  const [feedView,setFeedView]=useState<"UPDATES"|"PHOTOS">("UPDATES");
  const currentFeed=mode==="MEDIA"?(view==="PHOTOS"?"PHOTOS":"UPDATES"):feedView;
  const [lightbox,setLightbox]=useState<string|null>(null);
  const live=competition.matches.filter(match=>match.status==="IN_PROGRESS"&&
    !["COMPLETED","ARCHIVED","CANCELLED"].includes(competition.status))
    .sort((a,b)=>(a.startsAt??"").localeCompare(b.startsAt??"")||a.id.localeCompare(b.id));
  const updates=posts.slice().sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||b.id.localeCompare(a.id));
  const photos=updates.filter(post=>Boolean(resolveMediaImageUrl(post.imageUrl)));
  const registrationDate=displayTime(competition.registrationClosesAt,language);
  const startDate=displayTime(competition.startsAt,language);
  const accepted=competition.teams.filter(team=>team.status==="ACCEPTED").length;
  const snapshot=competitionHomeSnapshot(competition);
  const highlightPreviews=updates.slice(0,2);
  const nextFixtureDate=snapshot.upcoming?displayTime(snapshot.upcoming.startsAt,language):null;
  return <View style={styles.stack} testID="competition-home-feed">
    {mode==="HOME"&&view==="OVERVIEW"?<>
    {snapshot.champion?<Card testID="competition-home-champion" style={styles.championCard}>
      <View style={[styles.championHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.championEmblem}>
          <Ionicons name="trophy" size={27} color="#9D6C04"/>
        </View>
        <View style={{flex:1,gap:3}}>
          <AppText variant="caption" weight="semibold" style={{color:"#76581C"}}>
            {t("competition.detail.confirmedChampion")}
          </AppText>
          <AppText variant="bodyLarge" weight="bold" numberOfLines={2}>
            {snapshot.champion.teamName}
          </AppText>
        </View>
        {!snapshot.champion.offline?<Pressable accessibilityRole="button"
          testID="competition-champion-team-link"
          accessibilityLabel={snapshot.champion.teamName}
          onPress={()=>openTeam(snapshot.champion!.teamId)}
          style={styles.championOpen}>
          <Ionicons name={isRTL?"chevron-back":"chevron-forward"} color="#76581C" size={22}/>
        </Pressable>:null}
      </View>
    </Card>:null}
    <Card testID="competition-home-overview" style={styles.overview}>
      <View style={[styles.sectionHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.headingIcon}><Ionicons name="information-circle-outline" size={20} color={colors.primary}/></View>
        <AppText weight="bold" variant="bodyLarge" style={{flex:1}}>
          {t("competition.profile.overview")}
        </AppText>
        <Pressable accessibilityRole="button"
          accessibilityLabel={t("competition.phase4.fullAbout")}
          onPress={()=>router.push({pathname:"/competitions/[competitionId]/about",params:{competitionId:competition.id}})}
          style={styles.aboutLink}>
          <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
            {t("competition.phase4.fullAbout")}
          </AppText>
          <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={15} color={colors.primary}/>
        </Pressable>
      </View>
      <AppText muted numberOfLines={4}>
        {competition.description?.trim()||t("competition.profile.noDescription")}
      </AppText>
      <View style={[styles.homeStatusLine,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="flag-outline" size={16} color={colors.primary}/>
        <AppText variant="caption" weight="semibold" style={{color:colors.primary,flex:1}}>
          {t(`competition.status.${competition.status}` as never)} ·
          {" "}{t(`competition.format.${competition.format}` as never)}
        </AppText>
      </View>
      <View style={[styles.snapshotGrid,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.snapshotItem}>
          <Ionicons name="people-outline" size={18} color={colors.primary}/>
          <AppText variant="caption" muted>{t("competition.profile.registeredTeams")}</AppText>
          <AppText weight="bold">{accepted}/{competition.maxTeams}</AppText>
        </View>
        <View style={styles.snapshotItem}>
          <Ionicons name="wallet-outline" size={18} color={colors.primary}/>
          <AppText variant="caption" muted>{t("competition.registrationFee")}</AppText>
          <AppText weight="bold">{competition.registrationFeeAfn===0?t("competition.profile.free"):
            `${competition.registrationFeeAfn} AFN`}</AppText>
        </View>
        <View style={styles.snapshotItem}>
          <Ionicons name="football-outline" size={18} color={colors.primary}/>
          <AppText variant="caption" muted>{t("competition.detail.verifiedResults")}</AppText>
          <AppText weight="bold">{snapshot.verifiedResults}</AppText>
        </View>
        {snapshot.registrationOpen?<View testID="competition-home-spaces" style={styles.snapshotItem}>
          <Ionicons name="people-circle-outline" size={18} color={colors.primary}/>
          <AppText variant="caption" muted>{t("competition.detail.availablePlaces")}</AppText>
          <AppText weight="bold">{snapshot.remainingPlaces}</AppText>
        </View>:null}
      </View>
      {startDate?<View style={[styles.overviewDate,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="calendar-outline" size={17} color={colors.primary}/>
        <AppText variant="caption" muted>{t("competition.startsAt")}: {startDate.date} · {startDate.time}</AppText>
      </View>:null}
      {competition.status==="REGISTRATION_OPEN"&&registrationDate?
        <View style={[styles.overviewDate,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="time-outline" size={17} color={colors.primary}/>
          <AppText variant="caption" muted>{t("competition.registrationDeadline")}: {registrationDate.date} · {registrationDate.time}</AppText>
        </View>:null}
      <Pressable testID="competition-home-view-matches" accessibilityRole="button"
        onPress={()=>onTabChange("MATCHES")}
        style={[styles.matchesShortcut,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="calendar-outline" size={18} color={colors.primary}/>
        <AppText variant="caption" weight="semibold" style={{flex:1,color:colors.primary}}>
          {t("competition.phase4.viewFixtures")}
        </AppText>
        <Ionicons name={isRTL?"arrow-back":"arrow-forward"} size={17} color={colors.primary}/>
      </Pressable>
    </Card>
    </>:null}
    {mode==="HOME"&&view==="OVERVIEW"&&competition.status==="REGISTRATION_OPEN"&&
      snapshot.registrationOpen?<Pressable testID="competition-registration-cta"
      accessibilityRole="button" onPress={()=>onTabChange("TEAMS")}
      style={[styles.registrationCta,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.ctaIcon}><Ionicons name="people-outline" color="#FFFFFF" size={25}/></View>
      <View style={{flex:1,gap:4}}>
        <AppText weight="bold" variant="bodyLarge" style={{color:"#FFFFFF"}}>
          {t("competition.matchList.registrationOpen")}
        </AppText>
        <AppText variant="caption" style={{color:"#E4EEFF"}}>
          {t("competition.matchList.registrationCtaDescription")}
        </AppText>
      </View>
      <View style={styles.ctaArrow}><Ionicons
        name={isRTL?"arrow-back":"arrow-forward"} color={colors.primary} size={21}/></View>
    </Pressable>:null}
    {mode==="HOME"&&(view==="OVERVIEW"||view==="LIVE")?<>
    {live.length>0?<View testID="competition-live-scoreboard" style={styles.liveContainer}>
      <View style={[styles.liveHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.liveDot}/>
        <AppText weight="bold" variant="bodyLarge" style={{color:"#FFFFFF",flex:1}}>
          {t("competition.profile.liveNow")}
        </AppText>
        <View style={styles.liveBadge}>
          <Ionicons name="radio-outline" size={16} color="#FFFFFF"/>
          <AppText variant="caption" weight="bold" style={{color:"#FFFFFF"}}>{t("competition.profile.liveBadge")}</AppText>
        </View>
      </View>
      {live.map(match=><MatchCard key={match.id} match={match} offlineIds={offlineIds}/>)}
    </View>:null}
    {live.length===0&&view==="LIVE"?<Placeholder
      title={t("competition.profile.noLiveMatches")} icon="radio-outline"/>:null}
    </>:null}
    {mode==="HOME"&&view==="OVERVIEW"?<>
      {live.length===0&&snapshot.upcoming&&nextFixtureDate?<Card
        testID="competition-home-next-fixture" style={styles.featuredFixture}>
        <View style={[styles.featuredFixtureHead,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="calendar-outline" color={colors.primary} size={19}/>
          <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>
            {t("competition.detail.nextFixture")}
          </AppText>
          <AppText variant="caption" muted>
            {nextFixtureDate.date} · {nextFixtureDate.time}
          </AppText>
        </View>
        <MatchCard match={snapshot.upcoming} offlineIds={offlineIds}/>
      </Card>:null}
      {highlightPreviews.length>0?<Card testID="competition-home-highlight-preview"
        style={styles.homeHighlights}>
        <View style={[styles.sectionHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.headingIcon}>
            <Ionicons name="newspaper-outline" size={20} color={colors.primary}/>
          </View>
          <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>
            {t("competition.detail.recentUpdates")}
          </AppText>
          <Pressable accessibilityRole="button" testID="competition-home-all-updates"
            accessibilityLabel={t("competition.detail.viewAllUpdates")}
            onPress={()=>onTabChange("MEDIA")} style={styles.aboutLink}>
            <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
              {t("competition.detail.viewAllUpdates")}
            </AppText>
            <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={15}
              color={colors.primary}/>
          </Pressable>
        </View>
        {highlightPreviews.map(post=><View key={post.id} style={styles.homePreviewPost}>
          <View style={[styles.homePreviewHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Ionicons name="chatbubble-ellipses-outline" color={colors.primary} size={16}/>
            <AppText variant="caption" muted>
              {formatPostTimeAgo(post.publishedAt,language)}
            </AppText>
          </View>
          {post.body.trim()?<AppText numberOfLines={3}>{post.body.trim()}</AppText>:null}
          {resolveMediaImageUrl(post.imageUrl)?<Image
            source={{uri:resolveMediaImageUrl(post.imageUrl)!}}
            style={styles.homePreviewImage} resizeMode="cover"/>:null}
        </View>)}
      </Card>:null}
    </>:null}
    {(mode==="MEDIA"||view==="HIGHLIGHTS")?<>
    {mode==="HOME"?<View testID="competition-home-media-tabs" style={[styles.mediaSwitcher,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {(["UPDATES","PHOTOS"] as const).map(view=><Pressable key={view}
        testID={`competition-home-view-${view}`}
        accessibilityRole="tab" accessibilityState={{selected:currentFeed===view}}
        onPress={()=>setFeedView(view)}
        style={[styles.mediaTab,currentFeed===view&&styles.mediaTabActive]}>
        <Ionicons name={view==="UPDATES"?"newspaper-outline":"images-outline"} size={17}
          color={currentFeed===view?"#FFFFFF":colors.primary}/>
        <AppText weight="semibold" variant="caption"
          style={{color:currentFeed===view?"#FFFFFF":colors.primary}}>
          {t(view==="UPDATES"?"competition.phase4.updates":"competition.phase4.photos")}
        </AppText>
        <AppText variant="caption" style={{color:currentFeed===view?"#FFFFFF":colors.textMuted}}>
          {view==="UPDATES"?updates.length:photos.length}
        </AppText>
      </Pressable>)}
    </View>:null}
    {currentFeed==="UPDATES"?<>
      <SectionHeading title={t("competition.profile.allPosts")} icon="newspaper-outline" count={updates.length}/>
      {updates.length===0?<Placeholder title={t("competition.publicMediaEmpty")} icon="newspaper-outline"/>:null}
      {updates.map(post=><Card key={post.id} testID={`competition-post-${post.id}`} style={styles.post}>
      <View style={[styles.postHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.postAvatar}><Ionicons name="trophy-outline" color={colors.primary} size={23}/></View>
        <View style={{flex:1,gap:2,minWidth:0}}>
          <AppText weight="semibold" numberOfLines={2}>{competition.name}</AppText>
          <AppText variant="caption" muted>{formatPostTimeAgo(post.publishedAt,language)}</AppText>
        </View>
      </View>
      {post.body.trim()?<AppText>{post.body}</AppText>:null}
      {resolveMediaImageUrl(post.imageUrl)?<Pressable accessibilityRole="button"
        accessibilityLabel={t("competition.phase4.openPhoto")}
        onPress={()=>setLightbox(resolveMediaImageUrl(post.imageUrl))}
        style={styles.imageButton}>
        <Image source={{uri:resolveMediaImageUrl(post.imageUrl)!}}
          style={styles.postImage} resizeMode="cover"/>
      </Pressable>:null}
    </Card>)}
    </>:<>
      <SectionHeading title={t("competition.phase4.photos")} icon="images-outline" count={photos.length}/>
      {photos.length===0?<Placeholder title={t("competition.phase4.noPhotos")} icon="images-outline"/>:null}
      <View testID="competition-photo-gallery" style={[styles.gallery,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {photos.map(post=><Pressable key={post.id} accessibilityRole="button"
          accessibilityLabel={t("competition.phase4.openPhoto")}
          testID={`competition-gallery-photo-${post.id}`}
          onPress={()=>setLightbox(resolveMediaImageUrl(post.imageUrl))}
          style={styles.galleryTile}>
          <Image source={{uri:resolveMediaImageUrl(post.imageUrl)!}}
            style={styles.galleryImage} resizeMode="cover"/>
          <View style={styles.galleryBadge}><Ionicons name="expand-outline" size={16} color="#FFFFFF"/></View>
        </Pressable>)}
      </View>
    </>}
    <Modal visible={Boolean(lightbox)} transparent animationType="fade"
      onRequestClose={()=>setLightbox(null)}>
      <View style={styles.lightbox}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")}
          testID="competition-photo-close" onPress={()=>setLightbox(null)}
          style={styles.lightboxClose}>
          <Ionicons name="close" size={27} color="#FFFFFF"/>
        </Pressable>
        {lightbox?<Image source={{uri:lightbox}} resizeMode="contain" style={styles.lightboxImage}/>:null}
      </View>
    </Modal>
    </>:null}
  </View>;
}


function CompetitionAboutSection({competition,subtab}:{
  competition:CompetitionDto;subtab:string;
}){
  const {t,isRTL,language}=useLocale();
  const line=(label:string,value:string)=><View key={label} style={[styles.scoreRow,
    {flexDirection:isRTL?"row-reverse":"row",justifyContent:"space-between",flexWrap:"wrap"}]}>
    <AppText muted>{label}</AppText><AppText weight="semibold">{value}</AppText>
  </View>;
  const date=(date:string|null)=>date?formatLocalDateTimeParts(date,language).date:
    t("competition.profile.notSet");
  const category=subtab==="PRIZES"?"gift-outline":subtab==="VENUE"?"location-outline":
    "information-circle-outline";
  return <View testID="competition-about-subtab" style={styles.stack}>
    <SectionHeading icon={category} title={t(`competition.detail.sub.${subtab}` as never)}/>
    <Card style={styles.stack}>
      {subtab==="INFORMATION"?<>
        <AppText weight="bold" variant="bodyLarge">{competition.name}</AppText>
        <AppText muted>{competition.description?.trim()||t("competition.profile.noDescription")}</AppText>
        {line(t("competition.format"),t(`competition.format.${competition.format}` as never))}
        {line(t("competition.startsAt"),date(competition.startsAt))}
        {line(t("competition.endsAt"),date(competition.endsAt))}
      </>:null}
      {subtab==="RULES"?<>
        {line(t("competition.winPoints"),String(competition.winPoints))}
        {line(t("competition.drawPoints"),String(competition.drawPoints))}
        {line(t("competition.lossPoints"),String(competition.lossPoints))}
        {line(t("competition.profile.tieBreakOrder"),
          competition.tieBreakOrder.map(rule=>t(`competition.profile.tieBreak.${rule}` as never)).join(" · "))}
      </>:null}
      {subtab==="PRIZES"?(competition.rewards.length?
        competition.rewards.map((reward,index)=><View key={index} style={{gap:spacing.xs}}>
          <AppText weight="bold">{reward.title}</AppText>
          <AppText style={{color:colors.primary}}>{reward.prize}</AppText>
          {reward.description?<AppText muted>{reward.description}</AppText>:null}
        </View>):<Placeholder title={t("competition.rewards.empty")} icon="gift-outline"/>):null}
      {subtab==="VENUE"?<Pressable accessibilityRole="button"
        onPress={()=>router.push({pathname:"/venues/[venueId]",
          params:{venueId:competition.venueId}})}
        style={[styles.scoreRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="location-outline" size={22} color={colors.primary}/>
        <AppText weight="semibold" style={{flex:1}}>{competition.venueName}</AppText>
        <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={18} color={colors.primary}/>
      </Pressable>:null}
      <Pressable testID="competition-about-full" accessibilityRole="button"
        onPress={()=>router.push({pathname:"/competitions/[competitionId]/about",
          params:{competitionId:competition.id}})} style={styles.progressionLink}>
        <AppText weight="semibold" style={{color:colors.primary}}>
          {t("competition.phase4.fullAbout")}
        </AppText>
      </Pressable>
    </Card>
  </View>;
}

function CompetitionTeamMetrics({competition,subtab}:{competition:CompetitionDto;subtab:string}){
  const {t,isRTL}=useLocale();
  const participating=competition.teams.filter(team=>team.status==="ACCEPTED");
  const finished=competition.matches.filter(match=>isResult(match)&&
    match.homeScore!==null&&match.awayScore!==null);
  if(subtab==="FAIR_PLAY"){
    const byTeam=participating.map(team=>({
      ...team,yellow:competition.playerStats.filter(row=>row.teamId===team.teamId)
        .reduce((sum,row)=>sum+row.yellowCards,0),
      red:competition.playerStats.filter(row=>row.teamId===team.teamId)
        .reduce((sum,row)=>sum+row.redCards,0),
    })).filter(team=>team.yellow>0||team.red>0)
      .sort((a,b)=>a.red-b.red||a.yellow-b.yellow||a.teamName.localeCompare(b.teamName));
    return <View testID="competition-fairplay-stats" style={styles.stack}>
      <SectionHeading title={t("competition.detail.sub.FAIR_PLAY")} icon="shield-checkmark-outline"/>
      <AppText variant="caption" muted>{t("competition.detail.fairPlayHint")}</AppText>
      {byTeam.length?byTeam.map(team=><Card key={team.teamId} style={styles.scoreRow}>
        <AppText weight="semibold" style={{flex:1}}>{team.teamName}</AppText>
        <AppText>🟨 {team.yellow}  🟥 {team.red}</AppText>
      </Card>):<Placeholder title={t("competition.phase5.noRecordedMetric")} icon="stats-chart-outline"/>}
    </View>;
  }
  const rows=participating.map(team=>{
    const matches=finished.filter(m=>m.homeTeamId===team.teamId||m.awayTeamId===team.teamId);
    const goals=matches.reduce((sum,m)=>sum+(m.homeTeamId===team.teamId?m.homeScore!:m.awayScore!),0);
    const conceded=matches.reduce((sum,m)=>sum+(m.homeTeamId===team.teamId?m.awayScore!:m.homeScore!),0);
    return {...team,played:matches.length,goals,conceded};
  }).sort((a,b)=>b.goals-a.goals||b.played-a.played||a.teamName.localeCompare(b.teamName));
  return <View testID="competition-team-stats" style={styles.stack}>
    <SectionHeading title={t("competition.detail.sub.TEAMS")} icon="stats-chart-outline"/>
    <AppText variant="caption" muted>{t("competition.phase5.verifiedOnly")}</AppText>
    {rows.length?rows.map(team=><Card key={team.teamId} style={styles.stack}>
      <AppText weight="bold">{team.teamName}</AppText>
      <View style={[styles.scoreRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <AppText variant="caption" muted>{t("competition.played")}: {team.played}</AppText>
        <AppText variant="caption" muted>{t("competition.standingsGoalsFor")}: {team.goals}</AppText>
        <AppText variant="caption" muted>{t("competition.standingsGoalsAgainst")}: {team.conceded}</AppText>
      </View>
    </Card>):<Placeholder title={t("competition.profile.noTeams")} icon="people-outline"/>}
  </View>;
}
export function CompetitionProfileSections({competition,posts,activeTab,subtab,registration,onTabChange,
  initialStage,onStandingsStageChange,initialMatchFilter,matchPreferences,onMatchPreferencesChange,onMatchStatusChange,
  onMatchRefresh,matchRefreshing,myAcceptedTeamId}:Props){
  if(activeTab==="HOME")return <Home competition={competition} posts={posts}
    onTabChange={onTabChange} view={subtab??"OVERVIEW"}/>;
  if(activeTab==="MATCHES")return <CompetitionMatchList
    competition={competition} initialFilter={subtab==="UPCOMING"?"UPCOMING":
      subtab==="LIVE"?"LIVE":subtab==="RESULTS"?"FINISHED":initialMatchFilter??"ALL"}
    preferences={matchPreferences} onPreferencesChange={onMatchPreferencesChange}
    onPrimaryFilterChange={onMatchStatusChange} onRefresh={onMatchRefresh}
    refreshing={matchRefreshing} myAcceptedTeamId={myAcceptedTeamId}/>;
  if(activeTab==="STANDINGS")return <CompetitionStandings
    competition={competition} initialStage={subtab==="KNOCKOUT"?"KNOCKOUT":
      initialStage??"GROUPS"} onStageChange={onStandingsStageChange}/>;
  if(activeTab==="STATS")return subtab==="TEAMS"||subtab==="FAIR_PLAY"?
    <CompetitionTeamMetrics competition={competition} subtab={subtab}/>:
    <CompetitionStats competition={competition}/>;
  if(activeTab==="MEDIA")return <Home competition={competition} posts={posts}
    onTabChange={onTabChange} mode="MEDIA" view={subtab??"UPDATES"}/>;
  if(activeTab==="ABOUT")return <CompetitionAboutSection competition={competition}
    subtab={subtab??"INFORMATION"}/>;
  if(activeTab==="TEAMS"&&subtab==="PARTICIPANTS")return <CompetitionTeams competition={competition} registration={registration}/>;
  return <CompetitionTeams competition={competition} registration={registration}/>;
}

const styles=StyleSheet.create({
  stack:{gap:spacing.md},
  sectionHeading:{alignItems:"center",gap:spacing.sm,minHeight:36},
  headingIcon:{width:36,height:36,borderRadius:12,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  countPill:{minWidth:26,height:26,borderRadius:13,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center",paddingHorizontal:6},
  empty:{padding:spacing.lg,alignItems:"center",gap:spacing.sm,minHeight:110,justifyContent:"center"},
  emptyIcon:{width:46,height:46,borderRadius:23,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  matchCard:{gap:spacing.sm},
  matchMeta:{gap:spacing.sm,alignItems:"center"},
  detailsLink:{gap:4,flexDirection:"row",alignItems:"center",minHeight:44,paddingHorizontal:6},
  progressionLink:{gap:6,alignItems:"center",padding:spacing.sm,backgroundColor:colors.primarySoft,
    borderRadius:radius.sm,minHeight:44},
  bracketRounds:{gap:spacing.sm,paddingVertical:3,alignItems:"center"},
  groupHeading:{alignItems:"center",gap:spacing.sm},
  groupProvisional:{gap:spacing.xs,alignItems:"center",backgroundColor:"#F0FAF4",
    borderRadius:radius.md,padding:spacing.sm},
  roundChip:{minHeight:44,minWidth:72,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,
    paddingHorizontal:spacing.md,flexDirection:"row",alignItems:"center",gap:6,justifyContent:"center",
    backgroundColor:colors.surface},
  roundChipActive:{backgroundColor:colors.primary,borderColor:colors.primary},
  verifiedBanner:{minHeight:56,flexDirection:"row",alignItems:"center",gap:spacing.sm,
    padding:spacing.sm,backgroundColor:colors.primarySoft},
  statChips:{gap:spacing.sm,paddingVertical:4,alignItems:"center"},
  teamFilterChip:{maxWidth:178,minHeight:40,borderRadius:radius.md,paddingHorizontal:spacing.md,
    borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,justifyContent:"center"},
  teamFilterActive:{backgroundColor:colors.primary,borderColor:colors.primary},
  statusBadge:{backgroundColor:colors.primarySoft,paddingHorizontal:spacing.sm,
    paddingVertical:4,borderRadius:radius.pill},
  scoreRow:{alignItems:"center",gap:spacing.sm},
  scoreBox:{minWidth:63,minHeight:42,paddingHorizontal:spacing.sm,backgroundColor:colors.primarySoft,
    borderRadius:radius.md,alignItems:"center",justifyContent:"center"},
  matchTime:{alignItems:"center",gap:4,flexWrap:"wrap"},
  tableCard:{gap:spacing.sm,padding:spacing.sm},
  standingsTable:{borderWidth:1,borderRadius:radius.sm,borderColor:colors.border,overflow:"hidden"},
  tableHeader:{gap:6,minHeight:42,alignItems:"center",backgroundColor:colors.surfaceMuted,
    paddingHorizontal:spacing.sm},
  tableRow:{gap:6,minHeight:50,alignItems:"center",borderTopWidth:1,borderTopColor:colors.border,
    paddingHorizontal:spacing.sm},
  numberCell:{width:30,textAlign:"center"},
  stageSwitch:{flexDirection:"row",backgroundColor:colors.primarySoft,
    borderRadius:radius.md,padding:4,gap:4},
  stageButton:{flex:1,minHeight:44,borderRadius:radius.sm,alignItems:"center",
    justifyContent:"center",gap:5,flexDirection:"row",paddingHorizontal:4},
  stageActive:{backgroundColor:colors.primary},
  statEntry:{padding:spacing.sm},
  rank:{width:42,height:42,borderRadius:21,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  teamRow:{alignItems:"center",gap:spacing.sm},
  teamLogo:{width:54,height:54,borderRadius:27,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center",overflow:"hidden"},
  logoImage:{width:"100%",height:"100%"},
  seedBadge:{paddingVertical:5,paddingHorizontal:8,borderRadius:radius.pill,
    backgroundColor:colors.primarySoft},
  championCard:{backgroundColor:"#FFF7E3",borderWidth:1,borderColor:"#F3E1B0",
    padding:spacing.md,gap:spacing.sm},
  championHeading:{alignItems:"center",gap:spacing.md},
  championEmblem:{width:54,height:54,borderRadius:27,backgroundColor:"#FFEBB5",
    alignItems:"center",justifyContent:"center"},
  championOpen:{width:44,height:44,alignItems:"center",justifyContent:"center"},
  homeStatusLine:{gap:7,alignItems:"center",minHeight:30},
  featuredFixture:{gap:spacing.sm,borderColor:colors.border},
  featuredFixtureHead:{gap:spacing.sm,alignItems:"center",flexWrap:"wrap"},
  homeHighlights:{gap:spacing.md},
  homePreviewPost:{gap:spacing.sm,padding:spacing.sm,
    borderWidth:1,borderColor:colors.border,borderRadius:radius.md},
  homePreviewHeader:{gap:spacing.xs,alignItems:"center"},
  homePreviewImage:{width:"100%",height:126,borderRadius:radius.sm},
  registrationCta:{backgroundColor:colors.primary,padding:spacing.md,
    borderRadius:radius.lg,alignItems:"center",gap:spacing.sm,minHeight:98},
  ctaIcon:{width:42,height:42,alignItems:"center",justifyContent:"center",
    backgroundColor:"rgba(255,255,255,.16)",borderRadius:21},
  ctaArrow:{width:36,height:36,borderRadius:18,backgroundColor:"#FFFFFF",
    alignItems:"center",justifyContent:"center"},
  liveContainer:{backgroundColor:"#153F91",padding:spacing.sm,borderRadius:radius.lg,gap:spacing.sm},
  liveHeader:{minHeight:40,alignItems:"center",gap:spacing.sm,paddingHorizontal:spacing.xs},
  liveDot:{width:10,height:10,borderRadius:5,backgroundColor:"#FF5252"},
  liveBadge:{flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:spacing.sm,
    paddingVertical:5,borderRadius:radius.pill,backgroundColor:"#B91C1C"},
  post:{gap:spacing.md},
  postHeader:{gap:spacing.sm,alignItems:"center"},
  postAvatar:{width:42,height:42,borderRadius:21,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  postImage:{width:"100%",height:235,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
  overview:{gap:spacing.md},
  aboutLink:{flexDirection:"row",gap:3,alignItems:"center",minHeight:44,paddingHorizontal:spacing.xs},
  snapshotGrid:{gap:spacing.sm,flexWrap:"wrap"},
  snapshotItem:{flexGrow:1,flexBasis:"44%",minWidth:125,minHeight:83,padding:spacing.sm,
    gap:3,backgroundColor:colors.primarySoft,borderRadius:radius.md},
  overviewDate:{alignItems:"center",gap:spacing.xs,flexWrap:"wrap"},
  matchesShortcut:{alignItems:"center",gap:spacing.sm,minHeight:44,
    backgroundColor:colors.primarySoft,borderRadius:radius.md,paddingHorizontal:spacing.md},
  mediaSwitcher:{gap:spacing.sm},
  mediaTab:{flex:1,minHeight:46,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5,
    backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md},
  mediaTabActive:{backgroundColor:colors.primary,borderColor:colors.primary},
  imageButton:{width:"100%",overflow:"hidden",borderRadius:radius.md},
  gallery:{flexWrap:"wrap",gap:spacing.sm},
  galleryTile:{width:"48.5%",aspectRatio:1,borderRadius:radius.md,overflow:"hidden",
    backgroundColor:colors.primarySoft},
  galleryImage:{width:"100%",height:"100%"},
  galleryBadge:{position:"absolute",bottom:6,right:6,padding:6,borderRadius:16,
    backgroundColor:"rgba(0,0,0,.6)"},
  lightbox:{flex:1,backgroundColor:"rgba(5,12,25,.97)",
    alignItems:"center",justifyContent:"center",padding:spacing.md},
  lightboxClose:{position:"absolute",top:52,right:spacing.lg,width:48,height:48,zIndex:2,
    alignItems:"center",justifyContent:"center",borderRadius:24,
    backgroundColor:"rgba(255,255,255,.15)"},
  lightboxImage:{width:"100%",height:"82%"},

});
