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
import {Card} from "../ui/Card";

export type CompetitionProfileTab="HOME"|"RESULTS"|"MATCHES"|"STANDINGS"|"STATS"|"TEAMS";
type Stage="GROUPS"|"KNOCKOUT";
type StatMetric="GOALS"|"ASSISTS";
type Props={
  competition:CompetitionDto;
  posts:CompetitionMediaPostDto[];
  activeTab:CompetitionProfileTab;
  registration:ReactNode;
  onTabChange:(tab:CompetitionProfileTab)=>void;
  initialStage?:Stage|undefined;
};

export const COMPETITION_PROFILE_TABS:CompetitionProfileTab[]=[
  "HOME","RESULTS","MATCHES","STANDINGS","STATS","TEAMS",
];
export const COMPETITION_TAB_ICONS:Record<CompetitionProfileTab,keyof typeof Ionicons.glyphMap>={
  HOME:"home-outline",RESULTS:"checkmark-done-outline",MATCHES:"calendar-outline",
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

function MatchCard({match}:{match:CompetitionMatchDto}){
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
      <Pressable accessibilityRole={match.homeTeamId?"button":"text"}
        disabled={!match.homeTeamId} onPress={()=>match.homeTeamId&&openTeam(match.homeTeamId)}
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
      <Pressable accessibilityRole={match.awayTeamId?"button":"text"}
        disabled={!match.awayTeamId} onPress={()=>match.awayTeamId&&openTeam(match.awayTeamId)}
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

function CompetitionMatches({competition,kind}:{competition:CompetitionDto;kind:"RESULTS"|"MATCHES"}){
  const {t}=useLocale();
  const sorted=useMemo(()=>{
    const selection=competition.matches.filter(match=>kind==="RESULTS"?isResult(match):!isResult(match));
    return selection.sort((a,b)=>{
      if(kind==="RESULTS")return (b.startsAt??"").localeCompare(a.startsAt??"")||a.id.localeCompare(b.id);
      const priority=(match:CompetitionMatchDto)=>match.status==="IN_PROGRESS"?0:
        match.status==="SCHEDULED"?1:match.status==="POSTPONED"?2:
        match.status==="UNSCHEDULED"?3:4;
      return priority(a)-priority(b)||(a.startsAt??"9999").localeCompare(b.startsAt??"9999")||a.id.localeCompare(b.id);
    });
  },[competition.matches,kind]);
  return <View style={styles.stack}>
    <SectionHeading title={t(kind==="RESULTS"?"competition.profile.results":"competition.profile.matches")}
      icon={kind==="RESULTS"?"checkmark-done-outline":"calendar-outline"} count={sorted.length}/>
    {sorted.length===0?<Placeholder icon="calendar-outline"
      title={t(kind==="RESULTS"?"competition.profile.noResults":"competition.profile.noUpcomingMatches")}/>:null}
    {sorted.map(match=><MatchCard key={match.id} match={match}/>)}
  </View>;
}

function StandingTable({rows}:{rows:CompetitionStandingRowDto[]}){
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
          <Pressable key={row.teamId} accessibilityRole="button"
            onPress={()=>openTeam(row.teamId)}
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
            <MatchCard key={match.id} match={match}/>)}
        </View>)}
    </>:<>
      {competition.standings.length===0?<Placeholder title={t("competition.noStandings")}
        icon="podium-outline"/>:null}
      {groups.map(group=><Card key={group||"league"} style={styles.tableCard}>
        {group?<AppText variant="bodyLarge" weight="bold">
          {t("competition.group",{name:group})}
        </AppText>:null}
        <StandingTable rows={competition.standings.filter(row=>(row.groupName??"")===group)}/>
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

function CompetitionTeams({competition}:{competition:CompetitionDto}){
  const {t,isRTL}=useLocale();
  const teams=competition.teams.filter(team=>team.status==="ACCEPTED");
  return <View style={styles.stack}>
    <SectionHeading icon="people-outline" title={t("competition.teams")} count={teams.length}/>
    {teams.length===0?<Placeholder icon="people-outline" title={t("competition.profile.noTeams")}/>:null}
    {teams.map(team=><Pressable key={team.teamId} accessibilityRole="button"
      onPress={()=>openTeam(team.teamId)}>
      <Card style={[styles.teamRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.teamLogo}>
          {resolveMediaImageUrl(team.logoUrl)
            ?<Image source={{uri:resolveMediaImageUrl(team.logoUrl)!}}
              style={styles.logoImage} resizeMode="cover"/>
            :<Ionicons name="shield-outline" size={24} color={colors.primary}/>}
        </View>
        <View style={{flex:1,minWidth:0,gap:4}}>
          <AppText weight="bold" numberOfLines={2}>{team.teamName}</AppText>
          {team.groupName?<AppText muted variant="caption">{t("competition.group",{name:team.groupName})}</AppText>:null}
        </View>
        {team.seed?<View style={styles.seedBadge}>
          <AppText weight="semibold" variant="caption" style={{color:colors.primary}}>#{team.seed}</AppText>
        </View>:null}
        <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={19} color={colors.textMuted}/>
      </Card>
    </Pressable>)}
  </View>;
}

function Home({competition,posts,registration,onTabChange}:Omit<Props,"activeTab">){
  const {t,isRTL,language}=useLocale();
  const finished=competition.matches.filter(isResult)
    .sort((a,b)=>(b.startsAt??"").localeCompare(a.startsAt??"")).slice(0,2);
  const scheduled=competition.matches.filter(m=>m.status==="SCHEDULED"||m.status==="IN_PROGRESS")
    .sort((a,b)=>(a.startsAt??"").localeCompare(b.startsAt??"")).slice(0,2);
  const start=displayTime(competition.startsAt,language);
  const end=displayTime(competition.endsAt,language);
  return <View style={styles.stack}>
    <Card style={styles.about}>
      <SectionHeading title={t("competition.profile.about")} icon="information-circle-outline"/>
      {competition.description?<AppText>{competition.description}</AppText>:null}
      <Pressable accessibilityRole="button" onPress={()=>router.push({
        pathname:"/venues/[venueId]",params:{venueId:competition.venueId},
      })} style={[styles.infoRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="location-outline" size={19} color={colors.primary}/>
        <AppText style={{flex:1}}>{competition.venueName}</AppText>
        <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={18} color={colors.primary}/>
      </Pressable>
      {start?<View style={[styles.infoRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="calendar-outline" size={19} color={colors.textMuted}/>
        <AppText style={{flex:1}}>{t("competition.startsAt")}: {start.date} · {start.time}</AppText>
      </View>:null}
      {end?<View style={[styles.infoRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="flag-outline" size={19} color={colors.textMuted}/>
        <AppText style={{flex:1}}>{t("competition.endsAt")}: {end.date} · {end.time}</AppText>
      </View>:null}
    </Card>
    {registration}
    {competition.championTeamId?<Card style={styles.champion}>
      <Ionicons name="trophy" color={colors.primary} size={30}/>
      <AppText variant="caption" muted>{t("competition.champion")}</AppText>
      <AppText variant="bodyLarge" weight="bold">
        {competition.teams.find(team=>team.teamId===competition.championTeamId)?.teamName??t("competition.tbd")}
      </AppText>
    </Card>:null}
    <SectionHeading title={t("competition.profile.latestResults")} icon="checkmark-done-outline"/>
    {finished.length===0?<Placeholder title={t("competition.profile.noResults")} icon="calendar-outline"/>:
      finished.map(match=><MatchCard key={match.id} match={match}/>)}
    {competition.matches.some(isResult)?<Pressable style={styles.textLink} accessibilityRole="button"
      onPress={()=>onTabChange("RESULTS")}>
      <AppText weight="semibold" style={{color:colors.primary}}>{t("competition.profile.viewAllResults")}</AppText>
      <Ionicons name={isRTL?"arrow-back":"arrow-forward"} size={18} color={colors.primary}/>
    </Pressable>:null}
    <SectionHeading title={t("competition.profile.nextMatches")} icon="calendar-outline"/>
    {scheduled.length===0?<Placeholder title={t("competition.profile.noUpcomingMatches")} icon="calendar-outline"/>:
      scheduled.map(match=><MatchCard key={match.id} match={match}/>)}
    {scheduled.length>0?<Pressable style={styles.textLink} accessibilityRole="button"
      onPress={()=>onTabChange("MATCHES")}>
      <AppText weight="semibold" style={{color:colors.primary}}>{t("competition.profile.viewAllMatches")}</AppText>
      <Ionicons name={isRTL?"arrow-back":"arrow-forward"} size={18} color={colors.primary}/>
    </Pressable>:null}
    <SectionHeading title={t("competition.profile.updates")} icon="newspaper-outline" count={posts.length}/>
    {posts.length===0?<Placeholder title={t("competition.publicMediaEmpty")} icon="newspaper-outline"/>:null}
    {posts.slice(0,5).map(post=><Card key={post.id} style={styles.post}>
      <AppText variant="caption" muted>{formatPostTimeAgo(post.publishedAt,language)}</AppText>
      <AppText>{post.body}</AppText>
      {resolveMediaImageUrl(post.imageUrl)?<Image
        source={{uri:resolveMediaImageUrl(post.imageUrl)!}} style={styles.postImage} resizeMode="cover"/>:null}
    </Card>)}
  </View>;
}

export function CompetitionProfileSections({competition,posts,activeTab,registration,onTabChange,initialStage}:Props){
  if(activeTab==="HOME")return <Home competition={competition} posts={posts}
    registration={registration} onTabChange={onTabChange}/>;
  if(activeTab==="RESULTS"||activeTab==="MATCHES")return <CompetitionMatches
    competition={competition} kind={activeTab}/>;
  if(activeTab==="STANDINGS")return <CompetitionStandings competition={competition} initialStage={initialStage}/>;
  if(activeTab==="STATS")return <CompetitionStats competition={competition}/>;
  return <CompetitionTeams competition={competition}/>;
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
  about:{gap:spacing.md},
  infoRow:{gap:spacing.sm,alignItems:"center",minHeight:30},
  champion:{alignItems:"center",gap:spacing.xs,backgroundColor:colors.primarySoft},
  textLink:{minHeight:44,flexDirection:"row",alignItems:"center",justifyContent:"center",
    gap:spacing.sm,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,
    backgroundColor:colors.surface},
  post:{gap:spacing.sm},
  postImage:{width:"100%",height:210,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
});
