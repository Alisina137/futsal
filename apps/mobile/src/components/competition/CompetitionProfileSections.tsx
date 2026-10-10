import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {
  CompetitionDto,CompetitionMatchDto,CompetitionMediaPostDto,
  CompetitionStandingRowDto,
} from "@leaguekick/contracts";
import {router} from "expo-router";
import {useMemo,useState,type ReactNode} from "react";
import {Image,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {resolveMediaImageUrl} from "../../lib/api";
import {formatLocalDateTimeParts,formatPostTimeAgo} from "../../lib/date-time";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {LeagueStandingsTable} from "./LeagueStandingsTable";
import {CompetitionMatchList} from "./CompetitionMatchList";
import {Card} from "../ui/Card";

export type CompetitionProfileTab="HOME"|"MATCHES"|"STANDINGS"|"STATS"|"TEAMS";
type Stage="GROUPS"|"KNOCKOUT";
type StatMetric="GOALS"|"ASSISTS";
type Props={
  competition:CompetitionDto;
  posts:CompetitionMediaPostDto[];
  activeTab:CompetitionProfileTab;
  registration:ReactNode;
  onTabChange:(tab:CompetitionProfileTab)=>void;
  initialStage?:Stage|undefined;
  initialMatchFilter?:"ALL"|"FINISHED"|undefined;
};

export const COMPETITION_PROFILE_TABS:CompetitionProfileTab[]=[
  "HOME","MATCHES","STANDINGS","STATS","TEAMS",
];
export const COMPETITION_TAB_ICONS:Record<CompetitionProfileTab,keyof typeof Ionicons.glyphMap>={
  HOME:"home-outline",MATCHES:"calendar-outline",
  STANDINGS:"podium-outline",STATS:"stats-chart-outline",TEAMS:"people-outline",
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
  </Card>;
}

function StandingTable({rows,offlineIds}:{rows:CompetitionStandingRowDto[];offlineIds:Set<string>}){
  const {t,isRTL}=useLocale();
  const col=(label:string,width:number)=><AppText variant="caption" weight="semibold" muted
    style={{width,textAlign:"center"}}>{label}</AppText>;
  return <View style={styles.standingsTable}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{minWidth:"100%"}}>
      <View style={{minWidth:350}}>
        <View style={[styles.tableHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <AppText variant="caption" muted style={{width:25,textAlign:"center"}}>#</AppText>
          <AppText variant="caption" weight="semibold" muted style={{flex:1}}>
            {t("competition.teams")}
          </AppText>
          {col(t("competition.played"),30)}{col(t("competition.goalDifference"),34)}
          {col(t("competition.points"),34)}
        </View>
        {rows.slice().sort((a,b)=>a.position-b.position).map(row=>
          <Pressable key={row.teamId} accessibilityRole={offlineIds.has(row.teamId)?"text":"button"}
            disabled={offlineIds.has(row.teamId)} onPress={()=>!offlineIds.has(row.teamId)&&openTeam(row.teamId)}
            style={[styles.tableRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <AppText variant="caption" weight="bold" style={{width:25,textAlign:"center"}}>
              {row.position}
            </AppText>
            <AppText numberOfLines={1} weight="semibold" style={{flex:1}}>{row.teamName}</AppText>
            <AppText variant="caption" style={styles.numberCell}>{row.played}</AppText>
            <AppText variant="caption" style={[styles.numberCell,{width:34}]}>{row.goalDifference}</AppText>
            <AppText weight="bold" variant="caption"
              style={[styles.numberCell,{width:34,color:colors.primary}]}>{row.points}</AppText>
          </Pressable>)}
      </View>
    </ScrollView>
  </View>;
}

function CompetitionStandings({competition,initialStage}:{competition:CompetitionDto;initialStage?:Stage|undefined}){
  const {t}=useLocale();
  const mixed=competition.format==="GROUP_KNOCKOUT";
  const knockoutOnly=competition.format==="KNOCKOUT";
  const [stage,setStage]=useState<Stage>(initialStage??(knockoutOnly?"KNOCKOUT":"GROUPS"));
  const offlineIds=new Set(competition.teams.filter(team=>team.offline).map(team=>team.teamId));
  const knockout=competition.matches.filter(match=>match.stage==="KNOCKOUT")
    .sort((a,b)=>b.roundNumber-a.roundNumber||a.slotNumber-b.slotNumber);
  const groups=[...new Set(competition.standings.map(row=>row.groupName??""))];
  return <View style={styles.stack}>
    <SectionHeading title={t(mixed?"competition.profile.stages":"competition.standings")}
      icon="podium-outline"/>
    {mixed?<View style={styles.stageSwitch}>
      {(["GROUPS","KNOCKOUT"] as const).map(option=>
        <Pressable key={option} testID={`competition-stage-${option}`} accessibilityRole="tab"
          accessibilityState={{selected:stage===option}} onPress={()=>setStage(option)}
          style={[styles.stageButton,stage===option&&styles.stageActive]}>
          <AppText weight="semibold" variant="caption" style={{color:stage===option?"#FFFFFF":colors.primary}}>
            {t(option==="GROUPS"?"competition.profile.groupStage":"competition.profile.knockoutStage")}
          </AppText>
        </Pressable>)}
    </View>:null}
    {knockoutOnly||mixed&&stage==="KNOCKOUT"?<>
      {knockout.length===0?<Placeholder title={t("competition.noBracket")} icon="git-branch-outline"/>:null}
      {[...new Set(knockout.map(m=>m.roundNumber))].map(round=>
        <View key={round} style={styles.stack}>
          <AppText variant="bodyLarge" weight="semibold">
            {t("competition.round",{number:round})}
          </AppText>
          {knockout.filter(m=>m.roundNumber===round).map(match=>
            <MatchCard key={match.id} match={match} offlineIds={offlineIds}/>)}
        </View>)}
    </>:<>
      {competition.standings.length===0?<Placeholder title={t("competition.noStandings")}
        icon="podium-outline"/>:null}
      {groups.map(group=><Card key={group||"league"} style={styles.tableCard}>
        {group?<AppText variant="bodyLarge" weight="bold">
          {t("competition.group",{name:group})}
        </AppText>:null}
        {competition.format==="LEAGUE"
          ?<LeagueStandingsTable competition={competition}
            rows={competition.standings.filter(row=>(row.groupName??"")===group)}/>
          :<StandingTable rows={competition.standings.filter(row=>(row.groupName??"")===group)} offlineIds={offlineIds}/>}
      </Card>)}
    </>}
  </View>;
}

function CompetitionStats({competition}:{competition:CompetitionDto}){
  const {t,isRTL}=useLocale();
  const [metric,setMetric]=useState<StatMetric>("GOALS");
  const sorted=competition.playerStats.slice().sort((a,b)=>
    metric==="GOALS"
      ?b.goals-a.goals||b.assists-a.assists||a.publicDisplayName.localeCompare(b.publicDisplayName)
      :b.assists-a.assists||b.goals-a.goals||a.publicDisplayName.localeCompare(b.publicDisplayName));
  return <View style={styles.stack}>
    <SectionHeading title={t("competition.stats")} icon="stats-chart-outline"/>
    <View style={[styles.stageSwitch,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {(["GOALS","ASSISTS"] as const).map(value=>
        <Pressable key={value} testID={`competition-stats-${value}`}
          accessibilityRole="tab" accessibilityState={{selected:metric===value}}
          onPress={()=>setMetric(value)}
          style={[styles.stageButton,metric===value&&styles.stageActive]}>
          <Ionicons name={value==="GOALS"?"football-outline":"ribbon-outline"} size={17}
            color={metric===value?"#FFFFFF":colors.primary}/>
          <AppText variant="caption" weight="semibold"
            style={{color:metric===value?"#FFFFFF":colors.primary}}>
            {t(value==="GOALS"?"competition.goals":"competition.assists")}
          </AppText>
        </Pressable>)}
    </View>
    {sorted.length===0?<Placeholder title={t("competition.noStats")} icon="stats-chart-outline"/>:null}
    {sorted.map((stat,index)=><Pressable key={stat.playerUserId} accessibilityRole="button"
      onPress={()=>router.push({pathname:"/players/[playerId]",params:{playerId:stat.playerUserId}})}>
      <Card style={styles.statEntry}>
        <View style={[styles.scoreRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.rank}><AppText weight="bold" style={{color:colors.primary}}>#{index+1}</AppText></View>
          <View style={{flex:1,minWidth:0,gap:2}}>
            <AppText weight="semibold" numberOfLines={1}>{stat.publicDisplayName}</AppText>
            <AppText variant="caption" muted numberOfLines={1}>{stat.teamName}</AppText>
          </View>
          <View style={{alignItems:"center",minWidth:50}}>
            <AppText variant="title" weight="bold" style={{color:colors.primary}}>
              {metric==="GOALS"?stat.goals:stat.assists}
            </AppText>
            <AppText variant="caption" muted>{t(metric==="GOALS"?"competition.goals":"competition.assists")}</AppText>
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
function Home({competition,posts,onTabChange}:Pick<Props,"competition"|"posts"|"onTabChange">){
  const offlineIds=new Set(competition.teams.filter(team=>team.offline).map(team=>team.teamId));
  const {t,isRTL,language}=useLocale();
  const live=competition.matches.filter(match=>match.status==="IN_PROGRESS")
    .sort((a,b)=>(a.startsAt??"").localeCompare(b.startsAt??"")||a.id.localeCompare(b.id));
  const updates=posts.slice().sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||b.id.localeCompare(a.id));
  return <View style={styles.stack} testID="competition-home-feed">
    {competition.status==="REGISTRATION_OPEN"?<Pressable testID="competition-registration-cta"
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
      <AppText>{post.body}</AppText>
      {resolveMediaImageUrl(post.imageUrl)?<Image
        source={{uri:resolveMediaImageUrl(post.imageUrl)!}} style={styles.postImage} resizeMode="cover"/>:null}
    </Card>)}
  </View>;
}

export function CompetitionProfileSections({competition,posts,activeTab,registration,onTabChange,initialStage,initialMatchFilter}:Props){
  if(activeTab==="HOME")return <Home competition={competition} posts={posts} onTabChange={onTabChange}/>;
  if(activeTab==="MATCHES")return <CompetitionMatchList
    competition={competition} initialFilter={initialMatchFilter??"ALL"}/>;
  if(activeTab==="STANDINGS")return <CompetitionStandings competition={competition} initialStage={initialStage}/>;
  if(activeTab==="STATS")return <CompetitionStats competition={competition}/>;
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
});
