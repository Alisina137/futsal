import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {CompetitionDto,CompetitionMatchDto,CompetitionPublicMatchPlayer} from "@leaguekick/contracts";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {useCallback,useState} from "react";
import {AppState,Image,Pressable,StyleSheet,View} from "react-native";
import {competitionApi,resolveMediaImageUrl} from "../../../../../src/lib/api";
import {formatLocalDateTimeParts} from "../../../../../src/lib/date-time";
import {AppText} from "../../../../../src/components/ui/AppText";
import {Button} from "../../../../../src/components/ui/Button";
import {Card} from "../../../../../src/components/ui/Card";
import {DataLoadingState} from "../../../../../src/components/ui/DataLoadingState";
import {Screen} from "../../../../../src/components/ui/Screen";
import {useLocale} from "../../../../../src/providers/LocaleProvider";

type Tab="OVERVIEW"|"PLAYERS"|"STANDINGS";
const TABS:Tab[]=["OVERVIEW","PLAYERS","STANDINGS"];
const completed=(match:CompetitionMatchDto)=>
  match.status==="COMPLETED"||match.status==="CORRECTED";

function TeamPanel({id,name,logo,highlight}:{
  id:string|null;name:string|null;logo:string|null|undefined;highlight:boolean;
}){
  const {t}=useLocale();
  const resolved=resolveMediaImageUrl(logo);
  return <Pressable style={styles.team} accessibilityRole="button" disabled={!id}
    onPress={()=>{if(id)router.push({pathname:"/teams/[teamId]",params:{teamId:id}});}}>
    <View style={[styles.crest,highlight&&styles.crestHighlight]}>
      {resolved?<Image source={{uri:resolved}} style={styles.crestImage} resizeMode="cover"/>:
        <Ionicons name="shield-outline" color={colors.primary} size={32}/>}
    </View>
    <AppText variant="body" weight={highlight?"bold":"semibold"} numberOfLines={3}
      style={styles.teamName}>{name??t("competition.tbd")}</AppText>
  </Pressable>;
}
function InfoRow({icon,label,value}:{icon:keyof typeof Ionicons.glyphMap;label:string;value:string}){
  const {isRTL}=useLocale();
  return <View style={[styles.infoRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
    <Ionicons name={icon} size={19} color={colors.primary}/>
    <AppText variant="caption" muted style={{flex:1}}>{label}</AppText>
    <AppText weight="semibold" style={{flex:1,textAlign:isRTL?"left":"right"}}>{value}</AppText>
  </View>;
}
function Players({rows,match,competition}:{
  rows:CompetitionPublicMatchPlayer[];match:CompetitionMatchDto;competition:CompetitionDto;
}){
  const {t,isRTL}=useLocale();
  const ids=[match.homeTeamId,match.awayTeamId].filter((id):id is string=>Boolean(id));
  return <View style={styles.stack} testID="match-player-stats">
    <AppText weight="bold" variant="bodyLarge">{t("competition.matchDetail.recordedPlayers")}</AppText>
    {rows.length===0?<Card style={styles.empty}>
      <Ionicons name="people-outline" size={28} color={colors.primary}/>
      <AppText muted style={{textAlign:"center"}}>{t("competition.matchDetail.noPlayers")}</AppText>
    </Card>:null}
    {ids.map(id=>{
      const name=competition.teams.find(team=>team.teamId===id)?.teamName??t("competition.tbd");
      const players=rows.filter(stat=>stat.teamId===id)
        .sort((a,b)=>b.goals-a.goals||b.assists-a.assists||a.publicDisplayName.localeCompare(b.publicDisplayName));
      if(players.length===0)return null;
      return <Card key={id} style={styles.stack}>
        <AppText weight="bold" variant="bodyLarge">{name}</AppText>
        {players.map(stat=><Pressable key={stat.playerUserId} accessibilityRole="button"
          onPress={()=>router.push({pathname:"/players/[playerId]",params:{playerId:stat.playerUserId}})}
          style={[styles.playerRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.playerIcon}>
            <Ionicons name="person-outline" color={colors.primary} size={22}/>
          </View>
          <View style={{flex:1,minWidth:0,gap:3}}>
            <AppText weight="semibold" numberOfLines={2}>{stat.publicDisplayName}</AppText>
            <AppText variant="caption" muted>{stat.appeared?t("competition.matchDetail.appeared"):t("competition.matchDetail.notAppeared")}</AppText>
          </View>
          <View style={styles.playerNumbers}>
            {stat.goals>0?<AppText variant="caption" weight="semibold">⚽ {stat.goals}</AppText>:null}
            {stat.assists>0?<AppText variant="caption" weight="semibold">{t("competition.assists")}: {stat.assists}</AppText>:null}
            {stat.yellowCards>0?<AppText variant="caption">🟨 {stat.yellowCards}</AppText>:null}
            {stat.redCards>0?<AppText variant="caption">🟥 {stat.redCards}</AppText>:null}
          </View>
        </Pressable>)}
      </Card>;
    })}
  </View>;
}

export default function MatchDetailScreen(){
  const {competitionId,matchId}=useLocalSearchParams<{competitionId:string;matchId:string}>();
  const {t,isRTL,language}=useLocale();
  const [competition,setCompetition]=useState<CompetitionDto|null>(null);
  const [match,setMatch]=useState<CompetitionMatchDto|null>(null);
  const [playerStats,setPlayerStats]=useState<CompetitionPublicMatchPlayer[]>([]);
  const [activeTab,setActiveTab]=useState<Tab>("OVERVIEW");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [retry,setRetry]=useState(0);

  const load=useCallback(async(silent=false)=>{
    if(!competitionId||!matchId){setLoading(false);return;}
    if(!silent)setLoading(true);
    try{
      const [{competition:next},{match:nextMatch,playerStats:stats}]=await Promise.all([
        competitionApi.get(competitionId),competitionApi.match(competitionId,matchId),
      ]);
      setCompetition(next);setMatch(nextMatch);setPlayerStats(stats);setError(null);
    }catch{
      if(!silent){setError(t("competition.loadError"));setMatch(null);}
    }finally{if(!silent)setLoading(false);}
  },[competitionId,matchId,t]);

  useFocusEffect(useCallback(()=>{
    void load();
    let active=true;
    let pending=false;
    const update=async()=>{
      if(!active||pending||AppState.currentState!=="active")return;
      pending=true;
      try{await load(true);}finally{pending=false;}
    };
    const timer=setInterval(()=>void update(),25000);
    const resume=AppState.addEventListener("change",state=>{
      if(state==="active")void update();
    });
    return()=>{active=false;clearInterval(timer);resume.remove();};
  },[load,retry]));

  const home=competition?.teams.find(team=>team.teamId===match?.homeTeamId);
  const away=competition?.teams.find(team=>team.teamId===match?.awayTeamId);
  const scored=match?.homeScore!==null&&match?.homeScore!==undefined&&
    match.awayScore!==null&&match.awayScore!==undefined;
  const scheduled=match?.startsAt?formatLocalDateTimeParts(match.startsAt,language):null;
  const end=match?.endsAt?formatLocalDateTimeParts(match.endsAt,language):null;
  const date=scheduled?`${scheduled.date} · ${scheduled.time}`:t("competition.matchList.unscheduled");

  if(loading)return <Screen showHeader><DataLoadingState variant="detail" minHeight={500}/></Screen>;
  if(!competition||!match)return <Screen showHeader>
    <Card>
      <AppText>{error??t("competition.loadError")}</AppText>
      <Button label={t("common.retry")} onPress={()=>setRetry(value=>value+1)}/>
    </Card>
  </Screen>;

  return <Screen showHeader style={styles.page}>
    <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("competition.matchDetail.back")}
        style={styles.back} onPress={()=>router.push({
          pathname:"/competitions/[competitionId]",params:{competitionId,tab:"MATCHES"},
        })}>
        <Ionicons name={isRTL?"arrow-forward":"arrow-back"} color={colors.primary} size={22}/>
      </Pressable>
      <View style={{flex:1,minWidth:0}}>
        <AppText weight="bold" numberOfLines={2}>{competition.name}</AppText>
        <AppText muted variant="caption">{t("competition.round",{number:match.roundNumber})}</AppText>
      </View>
    </View>
    <Card style={styles.hero} testID="competition-match-scoreboard">
      <View style={[styles.badge,{backgroundColor:match.status==="IN_PROGRESS"?"#FEE9E7":colors.primarySoft}]}>
        {match.status==="IN_PROGRESS"?<View style={styles.liveDot}/>:null}
        <AppText weight="bold" variant="caption"
          style={{color:match.status==="IN_PROGRESS"?"#B91C1C":colors.primary}}>
          {t(`competition.matchStatus.${match.status}` as never)}
        </AppText>
      </View>
      <AppText muted variant="caption">{date}</AppText>
      <View style={[styles.scoreboard,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <TeamPanel id={match.homeTeamId} name={match.homeTeamName}
          logo={home?.logoUrl} highlight={match.winnerTeamId===match.homeTeamId}/>
        <View style={styles.scoreMid}>
          <AppText forceLtr weight="bold" variant="display" style={{color:colors.primary}}>
            {scored?`${match.homeScore} : ${match.awayScore}`:"– : –"}
          </AppText>
          <AppText muted variant="caption" style={{textAlign:"center"}}>
            {scored||completed(match)?t("competition.matchList.fullTime"):scheduled?.time??t("competition.matchList.unscheduled")}
          </AppText>
        </View>
        <TeamPanel id={match.awayTeamId} name={match.awayTeamName}
          logo={away?.logoUrl} highlight={match.winnerTeamId===match.awayTeamId}/>
      </View>
    </Card>
    <View style={styles.tabViewport}>
      <View style={[styles.tabs,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {TABS.map(tab=><Pressable key={tab} testID={`match-detail-tab-${tab}`}
          accessibilityRole="tab" accessibilityState={{selected:activeTab===tab}}
          onPress={()=>setActiveTab(tab)} style={[styles.tab,activeTab===tab&&styles.tabActive]}>
          <AppText variant="caption" weight="semibold" numberOfLines={1}
            style={{color:activeTab===tab?colors.primary:colors.textMuted}}>
            {t(`competition.matchDetail.tab.${tab}` as never)}
          </AppText>
        </Pressable>)}
      </View>
    </View>
    {activeTab==="OVERVIEW"?<View style={styles.stack}>
      <Card style={styles.stack}>
        <AppText weight="bold" variant="bodyLarge">{t("competition.matchDetail.matchInfo")}</AppText>
        <InfoRow icon="location-outline" label={t("competition.profile.hostVenue")} value={competition.venueName}/>
        {match.areaName?<InfoRow icon="football-outline" label={t("competition.matchDetail.area")} value={match.areaName}/>:null}
        <InfoRow icon="calendar-outline" label={t("competition.startsAt")} value={date}/>
        {end?<InfoRow icon="time-outline" label={t("competition.endsAt")}
          value={`${end.date} · ${end.time}`}/>:null}
        {match.groupName?<InfoRow icon="people-outline" label={t("competition.profile.groupStage")}
          value={match.groupName}/>:null}
        <InfoRow icon="layers-outline" label={t("competition.matchDetail.round")}
          value={String(match.roundNumber)}/>
      </Card>
      <Card style={styles.stack}>
        <AppText weight="bold" variant="bodyLarge">{t("competition.matchDetail.highlights")}</AppText>
        <AppText muted>{t("competition.matchDetail.highlightsUnavailable")}</AppText>
      </Card>
    </View>:null}
    {activeTab==="PLAYERS"?<Players match={match} competition={competition} rows={playerStats}/>:null}
    {activeTab==="STANDINGS"?<Card style={styles.stack}>
      <AppText weight="bold" variant="bodyLarge">{t("competition.standings")}</AppText>
      {competition.standings.filter(x=>x.teamId===match.homeTeamId||x.teamId===match.awayTeamId)
        .sort((a,b)=>a.position-b.position).map(row=><Pressable key={row.teamId}
          accessibilityRole="button" onPress={()=>router.push({
            pathname:"/teams/[teamId]",params:{teamId:row.teamId},
          })} style={[styles.standingRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <AppText weight="semibold" style={{width:24}}>{row.position}</AppText>
          <AppText weight="semibold" style={{flex:1}} numberOfLines={2}>{row.teamName}</AppText>
          <AppText variant="caption" muted>{t("competition.played")}: {row.played}</AppText>
          <AppText weight="bold" style={{color:colors.primary}}>{row.points}</AppText>
        </Pressable>)}
      {competition.standings.length===0?<AppText muted>
        {t("competition.noStandings")}
      </AppText>:null}
      <Button variant="secondary" label={t("competition.matchDetail.fullStandings")}
        onPress={()=>router.push({pathname:"/competitions/[competitionId]",
          params:{competitionId,tab:"STANDINGS"}})}/>
    </Card>:null}
  </Screen>;
}

const styles=StyleSheet.create({
  page:{gap:spacing.md,paddingTop:spacing.sm},
  heading:{alignItems:"center",gap:spacing.sm},
  back:{width:44,height:44,borderRadius:22,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  hero:{alignItems:"center",gap:spacing.md,paddingVertical:spacing.lg},
  badge:{paddingHorizontal:spacing.md,paddingVertical:7,borderRadius:radius.pill,
    flexDirection:"row",alignItems:"center",gap:5},
  liveDot:{width:8,height:8,borderRadius:4,backgroundColor:"#D74646"},
  scoreboard:{width:"100%",alignItems:"center",gap:spacing.xs},
  team:{flex:1,alignItems:"center",gap:spacing.sm,minWidth:0,minHeight:125},
  crest:{width:70,height:70,borderRadius:35,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center",overflow:"hidden"},
  crestHighlight:{borderWidth:2,borderColor:colors.primary},
  crestImage:{height:"100%",width:"100%"},
  teamName:{textAlign:"center"},
  scoreMid:{alignItems:"center",minWidth:100,gap:5},
  tabViewport:{height:51,backgroundColor:colors.surface,borderRadius:radius.md,
    borderWidth:1,borderColor:colors.border,overflow:"hidden"},
  tabs:{height:49,alignItems:"stretch"},
  tab:{flex:1,alignItems:"center",justifyContent:"center",minWidth:0},
  tabActive:{backgroundColor:colors.primarySoft,borderBottomWidth:3,borderBottomColor:colors.primary},
  stack:{gap:spacing.md},
  infoRow:{alignItems:"center",gap:spacing.sm,borderTopWidth:1,
    borderTopColor:colors.border,paddingTop:spacing.sm},
  empty:{alignItems:"center",gap:spacing.md},
  playerRow:{gap:spacing.sm,alignItems:"center",minHeight:60,
    borderTopWidth:1,borderTopColor:colors.border,paddingTop:spacing.sm},
  playerIcon:{width:36,height:36,borderRadius:18,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  playerNumbers:{alignItems:"flex-end",gap:3},
  standingRow:{alignItems:"center",gap:spacing.sm,minHeight:50,
    borderTopWidth:1,borderTopColor:colors.border},
});
