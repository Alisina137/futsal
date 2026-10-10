import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useMemo,useState} from "react";
import {Pressable,ScrollView,Share,StyleSheet,View} from "react-native";
import {ApiRequestError,playerCareerApi,type PlayerCareerData,type PlayerCareerMatch,
  type PlayerCareerTotals,type PlayerCareerAward} from "../../lib/api";
import {formatCompetitionDateTime} from "../../lib/date-time";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";

type Tab="statistics"|"achievements";
type Metric="matches"|"goals"|"assists";
const emptyTotals:PlayerCareerTotals={
  matches:0,goals:0,assists:0,yellowCards:0,redCards:0,cleanSheets:0,
  playerOfMatch:0,wins:0,draws:0,losses:0,unknownResults:0,winRate:0,
};
function ownTotals(rows:PlayerCareerMatch[]):PlayerCareerTotals{
  const result={...emptyTotals};
  const seen=new Set<string>();
  for(const row of rows){
    if(seen.has(row.matchId))continue;
    seen.add(row.matchId);
    result.matches++;result.goals+=row.goals;result.assists+=row.assists;
    result.yellowCards+=row.yellowCards;result.redCards+=row.redCards;
    if(row.cleanSheet)result.cleanSheets++;
    if(row.playerOfMatch)result.playerOfMatch++;
    if(row.result==="WIN")result.wins++;
    else if(row.result==="DRAW")result.draws++;
    else if(row.result==="LOSS")result.losses++;
    else result.unknownResults++;
  }
  const decided=result.wins+result.draws+result.losses;
  result.winRate=decided?Math.round(result.wins*100/decided):0;
  return result;
}
function kabulYear(value:string){
  return Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kabul",year:"numeric"}).format(new Date(value)));
}
function kabulMonth(value:string){
  const items=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kabul",year:"numeric",month:"2-digit"}).formatToParts(new Date(value));
  return items.find(v=>v.type==="year")?.value+"-"+items.find(v=>v.type==="month")?.value;
}
function Picker({selected,onChange,options}:{selected:string;onChange:(next:string)=>void;
  options:Array<{id:string;label:string}>}){
  return <ScrollView horizontal showsHorizontalScrollIndicator={false}
    contentContainerStyle={{gap:spacing.sm,flexDirection:"row",paddingVertical:spacing.xs}}>
    {options.map(item=><Pressable key={item.id} accessibilityRole="button"
      accessibilityState={{selected:selected===item.id}} onPress={()=>onChange(item.id)}
      style={[styles.pill,selected===item.id&&styles.pillActive]}>
      <AppText variant="caption" weight="semibold" style={selected===item.id?{color:colors.primary}:undefined}>
        {item.label}
      </AppText>
    </Pressable>)}
  </ScrollView>;
}
function Score({label,value}:{label:string;value:string|number}){
  return <View style={styles.stat}>
    <AppText weight="bold" variant="title" style={{color:colors.primary}}>{value}</AppText>
    <AppText variant="caption" muted style={{textAlign:"center"}}>{label}</AppText>
  </View>;
}

export function PlayerCareerTabs({tab,token}:{tab:Tab;token:string}){
  const {t,language}=useLocale();
  const tr=(key:string)=>t(`pd3.${key}` as never);
  const date=(value:string)=>formatCompetitionDateTime(value,language);
  const [data,setData]=useState<PlayerCareerData|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null),[refresh,setRefresh]=useState(0);
  const [teamId,setTeamId]=useState("ALL");
  const [competitionId,setCompetitionId]=useState("ALL");
  const [season,setSeason]=useState("ALL");
  const [metric,setMetric]=useState<Metric>("goals");
  const [achievementType,setAchievementType]=useState("ALL");
  useFocusEffect(useCallback(()=>{
    let mounted=true;setLoading(true);setError(null);
    void playerCareerApi.mine(token).then(response=>{if(mounted)setData(response);})
      .catch(e=>{if(mounted){setError(e instanceof ApiRequestError?e.message:t("pd3.loadError"));setData(null);}})
      .finally(()=>{if(mounted)setLoading(false);});
    return()=>{mounted=false;};
  },[token,refresh,t]));
  const years=useMemo(()=>[...new Set((data?.records??[]).map(r=>kabulYear(r.recordedAt)))].sort((a,b)=>b-a),[data]);
  // Scope all statistics and matching awards to the selected team/competition/season;
  // historical team choices remain visible even after the player leaves the team.
  const visible=useMemo(()=>(data?.records??[]).filter(r=>
    (teamId==="ALL"||r.teamId===teamId)&&
    (competitionId==="ALL"||r.competitionId===competitionId)&&
    (season==="ALL"||String(kabulYear(r.recordedAt))===season)),
    [data,teamId,competitionId,season]);
  const totals=useMemo(()=>ownTotals(visible),[visible]);
  const awards=useMemo(()=>(data?.achievements??[]).filter(a=>
    (achievementType==="ALL"||a.kind===achievementType)&&
    (teamId==="ALL"||a.teamId===teamId)&&
    (competitionId==="ALL"||a.competitionId===competitionId)&&
    (season==="ALL"||String(kabulYear(a.achievedAt))===season)),
    [data,achievementType,teamId,competitionId,season,visible]);
  const trend=useMemo(()=>{
    const months=new Map<string,{matches:number;goals:number;assists:number}>();
    for(const row of visible){
      const key=kabulMonth(row.recordedAt);
      const period=months.get(key)??{matches:0,goals:0,assists:0};
      period.matches++;period.goals+=row.goals;period.assists+=row.assists;
      months.set(key,period);
    }
    return [...months.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-12).map(([key,value])=>({key,value:value[metric]}));
  },[visible,metric]);
  const max=Math.max(1,...trend.map(item=>item.value));
  const filters=<View style={{gap:spacing.sm}}>
    <AppText weight="semibold">{tr("teamFilter")}</AppText>
    <Picker selected={teamId} onChange={setTeamId} options={[
      {id:"ALL",label:tr("allTeams")},...(data?.teams??[]).map(x=>({id:x.id,label:x.name})),
    ]}/>
    <AppText weight="semibold">{tr("competitionFilter")}</AppText>
    <Picker selected={competitionId} onChange={setCompetitionId} options={[
      {id:"ALL",label:tr("allCompetitions")},...(data?.competitions??[]).map(x=>({id:x.id,label:x.name})),
    ]}/>
    <AppText weight="semibold">{tr("seasonFilter")}</AppText>
    <Picker selected={season} onChange={setSeason} options={[
      {id:"ALL",label:tr("allTime")},...years.map(x=>({id:String(x),label:String(x)})),
    ]}/>
  </View>;
  async function shareAward(award:PlayerCareerAward){
    if(data?.visibility!=="PUBLIC")return;
    try{
      const label=tr("award."+award.label);
      const details=award.competitionName?` — ${award.competitionName}`:"";
      // Explicit native Share action: never include userId, private preferences, phone or location.
      await Share.share({message:`${label}${details}\n${tr("verifiedOfficial")}`});
    }catch{
      setError(t("pd3.shareFailed"));
    }
  }
  return <View style={{gap:spacing.md}}>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary" onPress={()=>setRefresh(v=>v+1)}/></Card>:null}
    {loading?<DataLoadingState variant="dashboard" minHeight={360}/>:data?<>
      <Card>
        <View style={styles.row}>
          <Ionicons name={data.visibility==="PRIVATE"?"lock-closed-outline":"shield-checkmark-outline"}
            color={colors.primary} size={22}/>
          <View style={{flex:1,gap:spacing.xs}}>
            <AppText weight="semibold">{tr("officialOnly")}</AppText>
            <AppText variant="caption" muted>{data.visibility==="PRIVATE"?tr("privateNotice"):tr("verifiedNotice")}</AppText>
          </View>
        </View>
        <Button label={tr("editVisibility")} variant="secondary" onPress={()=>router.push("/profile/player")}/>
      </Card>
      {filters}
      {tab==="statistics"?<>
        <View style={styles.grid}>
          {([
            ["matches",totals.matches],["goals",totals.goals],["assists",totals.assists],
            ["wins",totals.wins],["draws",totals.draws],["losses",totals.losses],
            ["winRate",totals.winRate+"%"],["yellowCards",totals.yellowCards],["redCards",totals.redCards],
            ["cleanSheets",totals.cleanSheets],["playerOfMatch",totals.playerOfMatch],
          ] as Array<[string,string|number]>).map(([key,value])=>
            <Score key={key} label={tr("stat."+key)} value={value}/>)}
        </View>
        {totals.unknownResults>0?<Card><AppText variant="caption" muted>
          {tr("unknownScores")}: {totals.unknownResults}</AppText></Card>:null}
        <Card>
          <AppText variant="bodyLarge" weight="bold">{tr("performanceTrend")}</AppText>
          <AppText variant="caption" muted>{tr("trendHint")}</AppText>
          <Picker selected={metric} onChange={v=>setMetric(v as Metric)}
            options={["goals","assists","matches"].map(k=>({id:k,label:tr("stat."+k)}))}/>
          {!trend.length?<AppText muted>{tr("noRecordedStats")}</AppText>:null}
          {trend.length?<View style={styles.chart}>
            {trend.map(row=><View key={row.key} style={styles.chartCell}>
              <AppText variant="caption" style={{color:colors.primary}}>{row.value}</AppText>
              <View style={styles.barTrack}>
                <View style={[styles.bar,{height:Math.max(3,116*row.value/max)}]}/>
              </View>
              <AppText variant="caption" muted style={styles.chartLabel}>{row.key.slice(5)}</AppText>
              <AppText variant="caption" muted style={styles.chartLabel}>{row.key.slice(0,4)}</AppText>
            </View>)}
          </View>:null}
        </Card>
        <Card>
          <AppText variant="bodyLarge" weight="bold">{tr("matchHistory")}</AppText>
          {!visible.length?<AppText muted>{tr("noRecordedStats")}</AppText>:null}
          {visible.slice(0,40).map(row=><View key={row.matchId} style={styles.history}>
            <AppText weight="semibold">{row.teamName} · {row.competitionName}</AppText>
            <AppText variant="caption" muted>{date(row.recordedAt)} · {tr("result."+row.result)}</AppText>
            <AppText variant="caption" muted>{tr("stat.goals")}: {row.goals} · {tr("stat.assists")}: {row.assists}
              {" · "}{tr("stat.yellowCards")}: {row.yellowCards} · {tr("stat.redCards")}: {row.redCards}</AppText>
            <Button label={tr("matchDetails")} variant="secondary"
              onPress={()=>router.push({pathname:"/competitions/[competitionId]/matches/[matchId]",
                params:{competitionId:row.competitionId,matchId:row.matchId}})}/>
          </View>)}
          {visible.length>40?<AppText variant="caption" muted>{tr("recentForty")}</AppText>:null}
        </Card>
      </>:<>
        <Card>
          <AppText variant="bodyLarge" weight="bold">{tr("trophyCabinet")}</AppText>
          <AppText variant="caption" muted>{tr("achievementHint")}</AppText>
          <Picker selected={achievementType} onChange={setAchievementType}
            options={["ALL","CHAMPION","PLAYER_OF_MATCH","MILESTONE"].map(k=>({
              id:k,label:tr("kind."+k),
            }))}/>
          {!awards.length?<AppText muted>{tr("noAchievements")}</AppText>:null}
          {awards.map(award=><View style={styles.award} key={award.id}>
            <View style={styles.row}>
              <View style={styles.awardIcon}>
                <Ionicons name={award.kind==="CHAMPION"?"trophy-outline":
                  award.kind==="PLAYER_OF_MATCH"?"star-outline":"ribbon-outline"}
                  size={27} color={colors.primary}/>
              </View>
              <View style={{flex:1,gap:spacing.xs}}>
                <AppText weight="bold">{tr("award."+award.label)}</AppText>
                <AppText variant="caption" muted>{date(award.achievedAt)}</AppText>
                {award.competitionName?<AppText variant="caption">{award.competitionName}</AppText>:null}
                {award.teamName?<AppText variant="caption" muted>{award.teamName}</AppText>:null}
                <AppText variant="caption" style={{color:colors.primary}}>{tr("verifiedOfficial")}</AppText>
              </View>
            </View>
            <View style={styles.row}>
              {award.competitionId?<Button variant="secondary" label={tr("competitionDetails")}
                onPress={()=>router.push({pathname:"/competitions/[competitionId]",
                  params:{competitionId:award.competitionId!}})}/>:null}
              {award.matchId?<Button variant="secondary" label={tr("matchDetails")}
                onPress={()=>router.push({pathname:"/competitions/[competitionId]/matches/[matchId]",
                  params:{competitionId:award.competitionId!,matchId:award.matchId!}})}/>:null}
              {data.visibility==="PUBLIC"?<Button label={tr("shareAward")} variant="ghost"
                onPress={()=>void shareAward(award)}/>:null}
            </View>
          </View>)}
        </Card>
      </>}
    </>:null}
  </View>;
}
const styles=StyleSheet.create({
  row:{flexDirection:"row",gap:spacing.sm,alignItems:"center",flexWrap:"wrap"},
  pill:{borderWidth:1,borderColor:colors.border,borderRadius:radius.pill,
    backgroundColor:colors.surface,paddingHorizontal:spacing.md,paddingVertical:spacing.sm},
  pillActive:{backgroundColor:colors.primarySoft,borderColor:colors.primary},
  grid:{flexDirection:"row",gap:spacing.sm,flexWrap:"wrap"},
  stat:{flexGrow:1,flexBasis:"27%",minWidth:90,padding:spacing.md,
    alignItems:"center",gap:spacing.xs,backgroundColor:colors.surface,
    borderRadius:radius.lg,borderWidth:1,borderColor:colors.border},
  chart:{flexDirection:"row",gap:spacing.xs,alignItems:"flex-end",minHeight:178,
    justifyContent:"space-between"},
  chartCell:{flex:1,gap:spacing.xs,alignItems:"center",minWidth:17,maxWidth:55},
  barTrack:{height:118,width:"85%",backgroundColor:colors.primarySoft,
    borderRadius:radius.sm,justifyContent:"flex-end",overflow:"hidden"},
  bar:{width:"100%",backgroundColor:colors.primary,borderRadius:radius.sm},
  chartLabel:{fontSize:10,textAlign:"center"},
  history:{borderTopWidth:1,borderColor:colors.border,marginTop:spacing.md,
    paddingTop:spacing.md,gap:spacing.xs},
  award:{borderTopWidth:1,borderColor:colors.border,paddingTop:spacing.md,
    marginTop:spacing.md,gap:spacing.sm},
  awardIcon:{width:54,height:54,borderRadius:radius.lg,alignItems:"center",
    justifyContent:"center",backgroundColor:colors.primarySoft},
});
