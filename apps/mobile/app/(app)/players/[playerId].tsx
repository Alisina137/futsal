import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {PublicPlayerProfileDto} from "@leaguekick/contracts";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {useCallback,useRef,useState} from "react";
import {Image,Pressable,StyleSheet,View} from "react-native";
import {resolveMediaImageUrl,teamApi,teamPublicApi} from "../../../src/lib/api";
import {publicPlayerVerifiedStats,
  type PublicPlayerVerifiedSummary,type PublicPlayerVerifiedStat} from
  "../../../src/lib/public-player-profile";
import {AppText} from "../../../src/components/ui/AppText";
import {Button} from "../../../src/components/ui/Button";
import {Card} from "../../../src/components/ui/Card";
import {DataLoadingState} from "../../../src/components/ui/DataLoadingState";
import {Screen} from "../../../src/components/ui/Screen";
import {useLocale} from "../../../src/providers/LocaleProvider";

function StatTile({label,value,icon}:{
  label:string;value:number;icon:keyof typeof Ionicons.glyphMap;
}){
  return <View style={styles.statTile}>
    <Ionicons name={icon} size={19} color={colors.primary}/>
    <AppText variant="title" weight="bold" style={styles.statValue}>{value}</AppText>
    <AppText variant="caption" muted style={styles.statLabel}>{label}</AppText>
  </View>;
}

/** Public player view: only public profile fields and verified published-match
 * stats. No invented biography, trophies, age, jersey or career totals. */
export default function PublicPlayerProfileScreen(){
  const {playerId}=useLocalSearchParams<{playerId:string}>();
  const id=typeof playerId==="string"?playerId:"";
  const {t,isRTL}=useLocale();
  const row=isRTL?"row-reverse" as const:"row" as const;
  const [player,setPlayer]=useState<PublicPlayerProfileDto|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [retry,setRetry]=useState(0);
  const [verified,setVerified]=useState<{
    total:PublicPlayerVerifiedSummary|null;teams:PublicPlayerVerifiedStat[];
  }>({total:null,teams:[]});
  const [statsLoading,setStatsLoading]=useState(false);
  const [statsError,setStatsError]=useState(false);
  const generation=useRef(0);

  useFocusEffect(useCallback(()=>{
    const request=++generation.current;
    setPlayer(null);setLoading(true);setError(null);
    setStatsLoading(false);setStatsError(false);setVerified({total:null,teams:[]});
    if(!id){
      setError(t("teams.publicPlayerLoadError"));setLoading(false);
      return()=>{generation.current++;};
    }
    void (async()=>{
      try{
        const result=await teamApi.publicPlayer(id);
        if(generation.current!==request)return;
        if(result.player.userId!==id)throw new Error("Public player response mismatch");
        setPlayer(result.player);setLoading(false);
        if(result.player.teams.length===0)return;
        setStatsLoading(true);
        const settled=await Promise.allSettled(result.player.teams.map(async team=>({
          teamId:team.id,stats:(await teamPublicApi.highlights(team.id)).stats,
        })));
        if(generation.current!==request)return;
        const ok=settled.filter((item):item is PromiseFulfilledResult<{
          teamId:string;stats:Awaited<ReturnType<typeof teamPublicApi.highlights>>["stats"];
        }>=>item.status==="fulfilled").map(item=>item.value);
        setVerified(publicPlayerVerifiedStats(result.player,ok));
        setStatsError(ok.length===0);
        setStatsLoading(false);
      }catch{
        if(generation.current===request){
          setPlayer(null);setError(t("teams.publicPlayerLoadError"));setLoading(false);
          setStatsLoading(false);
        }
      }
    })();
    return()=>{generation.current++;};
  },[id,t,retry]));

  if(loading)return <Screen showHeader><DataLoadingState variant="detail" minHeight={460}/></Screen>;
  if(error||!player||player.userId!==id)
    return <Screen showHeader><Card style={styles.failure}>
      <Ionicons name="person-circle-outline" size={44} color={colors.textMuted}/>
      <AppText weight="bold" variant="bodyLarge">{t("publicPlayer.unavailable")}</AppText>
      <AppText muted style={styles.center}>{error??t("teams.publicPlayerLoadError")}</AppText>
      <Button label={t("common.retry")} onPress={()=>setRetry(value=>value+1)}/>
    </Card></Screen>;

  const image=resolveMediaImageUrl(player.imageUrl);
  const initials=player.publicDisplayName.trim().slice(0,2).toUpperCase();
  const firstTeam=player.teams[0]??null;
  const teamStats=new Map(verified.teams.map(stat=>[stat.teamId,stat]));

  return <Screen showHeader>
    <View testID="public-player-hero" style={styles.hero}>
      <View style={styles.cover}>
        <View style={styles.decorLarge}/>
        <View style={styles.decorSmall}/>
        <Ionicons name="football-outline" size={106} color="rgba(255,255,255,.09)"
          style={styles.decorBall}/>
        <View style={[styles.coverTitle,{flexDirection:row}]}>
          <Ionicons name="shield-checkmark-outline" size={19} color="#C5DCFF"/>
          <AppText weight="semibold" style={styles.coverTitleText}>
            {t("publicPlayer.title")}
          </AppText>
        </View>
      </View>
      <View style={styles.identity}>
        <View style={[styles.identityRow,{flexDirection:row}]}>
          <View style={styles.avatarOuter}>
            {image?<Image source={{uri:image}} style={styles.avatar} resizeMode="cover"/>:
              <View style={styles.avatarFallback}>
                <AppText variant="display" weight="bold" style={styles.initials}>{initials}</AppText>
              </View>}
          </View>
          <View style={styles.nameBlock}>
            <AppText variant="title" weight="bold" numberOfLines={2}
              style={[styles.playerName,{textAlign:isRTL?"right":"left"}]}>
              {player.publicDisplayName}
            </AppText>
            <View style={[styles.position,{flexDirection:row}]}>
              <Ionicons name="football" size={15} color={colors.primary}/>
              <AppText variant="caption" weight="bold" style={styles.positionText}>
                {t(`teams.position.${player.position}` as never)}
              </AppText>
            </View>
          </View>
        </View>
        {firstTeam?<Pressable testID="public-player-primary-team"
          accessibilityRole="button" accessibilityLabel={firstTeam.name}
          onPress={()=>router.push({pathname:"/teams/[teamId]",params:{teamId:firstTeam.id}})}
          style={({pressed})=>[styles.affiliation,{flexDirection:row},pressed&&styles.pressed]}>
          <Ionicons name="shield-outline" size={18} color={colors.primary}/>
          <View style={{flex:1,gap:2}}>
            <AppText variant="caption" muted>{t("publicPlayer.represents")}</AppText>
            <AppText weight="semibold" numberOfLines={1}>{firstTeam.name}</AppText>
          </View>
          <View style={styles.roleBadge}>
            <AppText variant="caption" weight="bold" style={{color:colors.primary}}>
              {t(`teams.role.${firstTeam.role}` as never)}
            </AppText>
          </View>
          <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={18}
            color={colors.primary}/>
        </Pressable>:null}
      </View>
    </View>

    <View testID="public-player-verified-stats" style={styles.section}>
      <View style={[styles.sectionHeader,{flexDirection:row}]}>
        <Ionicons name="stats-chart-outline" color={colors.primary} size={22}/>
        <AppText weight="bold" variant="bodyLarge" style={{flex:1}}>
          {t("publicPlayer.verifiedStats")}
        </AppText>
        {verified.total?<Ionicons name="checkmark-circle" color={colors.success} size={20}/>:null}
      </View>
      {verified.total?<View style={[styles.statsRow,{flexDirection:row}]}>
        <StatTile label={t("publicPlayer.appearances")} icon="calendar-outline"
          value={verified.total.appearances}/>
        <StatTile label={t("publicPlayer.goals")} icon="football-outline"
          value={verified.total.goals}/>
        <StatTile label={t("publicPlayer.assists")} icon="flash-outline"
          value={verified.total.assists}/>
      </View>:<Card style={styles.statEmpty}>
        <Ionicons name={statsError?"cloud-offline-outline":"bar-chart-outline"}
          color={colors.textMuted} size={25}/>
        <AppText muted style={{flex:1}}>
          {statsLoading?t("publicPlayer.statsLoading"):
            statsError?t("publicPlayer.statsUnavailable"):t("publicPlayer.statsEmpty")}
        </AppText>
      </Card>}
      <AppText variant="caption" muted>{t("publicPlayer.statsExplanation")}</AppText>
    </View>

    <View testID="public-player-teams" style={styles.section}>
      <View style={[styles.sectionHeader,{flexDirection:row}]}>
        <Ionicons name="people-outline" color={colors.primary} size={22}/>
        <AppText weight="bold" variant="bodyLarge" style={{flex:1}}>
          {t("teams.currentTeams")}
        </AppText>
        <View style={styles.countPill}>
          <AppText weight="semibold" variant="caption" style={{color:colors.primary}}>
            {player.teams.length}
          </AppText>
        </View>
      </View>
      {player.teams.length===0?<Card style={styles.statEmpty}>
        <Ionicons name="shield-outline" size={24} color={colors.textMuted}/>
        <AppText muted style={{flex:1}}>{t("teams.noPublicTeams")}</AppText>
      </Card>:null}
      {player.teams.map(team=>{
        const logo=resolveMediaImageUrl(team.logoUrl),stat=teamStats.get(team.id);
        return <Pressable key={team.id} testID={"public-player-team-"+team.id}
          accessibilityRole="button" accessibilityLabel={team.name}
          onPress={()=>router.push({pathname:"/teams/[teamId]",params:{teamId:team.id}})}
          style={({pressed})=>pressed&&styles.pressed}>
          <Card style={styles.teamCard}>
            <View style={[styles.teamRow,{flexDirection:row}]}>
              <View style={styles.teamLogoFrame}>
                {logo?<Image source={{uri:logo}} style={styles.teamLogo} resizeMode="cover"/>:
                  <AppText variant="bodyLarge" weight="bold" style={{color:colors.primary}}>
                    {team.name.trim().slice(0,2).toUpperCase()}
                  </AppText>}
              </View>
              <View style={{flex:1,gap:spacing.xs}}>
                <AppText weight="bold" variant="bodyLarge" numberOfLines={2}>
                  {team.name}
                </AppText>
                <View style={[styles.teamMeta,{flexDirection:row}]}>
                  <Ionicons name="location-outline" size={14} color={colors.textMuted}/>
                  <AppText variant="caption" muted numberOfLines={1}>
                    {team.city}
                  </AppText>
                </View>
                <View style={[styles.roleChip,{flexDirection:row}]}>
                  <Ionicons name="ribbon-outline" size={14} color={colors.primary}/>
                  <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
                    {t(`teams.role.${team.role}` as never)}
                  </AppText>
                </View>
              </View>
              <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={23}
                color={colors.primary}/>
            </View>
            {stat?<View style={[styles.teamStatFooter,{flexDirection:row}]}>
              <Ionicons name="checkmark-circle-outline" color={colors.success} size={16}/>
              <AppText variant="caption" muted style={{flex:1}}>
                {t("publicPlayer.teamStats",{played:stat.appearances,goals:stat.goals,
                  assists:stat.assists})}
              </AppText>
            </View>:null}
          </Card>
        </Pressable>;
      })}
    </View>
  </Screen>;
}

const styles=StyleSheet.create({
  hero:{backgroundColor:colors.surface,borderRadius:radius.lg,overflow:"hidden",
    borderWidth:1,borderColor:colors.border},
  cover:{height:146,backgroundColor:"#112B55",overflow:"hidden",position:"relative"},
  decorLarge:{position:"absolute",height:230,width:230,borderRadius:115,
    backgroundColor:"rgba(73,151,255,.16)",top:-100,right:-50},
  decorSmall:{position:"absolute",height:190,width:190,borderRadius:95,
    borderWidth:20,borderColor:"rgba(255,255,255,.07)",bottom:-120,left:-40},
  decorBall:{position:"absolute",bottom:-24,right:22},
  coverTitle:{alignItems:"center",gap:spacing.sm,paddingHorizontal:spacing.lg,paddingTop:spacing.md},
  coverTitleText:{color:"#D5E7FF",letterSpacing:.6},
  identity:{paddingHorizontal:spacing.md,paddingBottom:spacing.lg,gap:spacing.lg},
  identityRow:{alignItems:"flex-end",gap:spacing.md,marginTop:-54},
  avatarOuter:{width:112,height:112,borderRadius:56,borderWidth:5,
    borderColor:colors.surface,backgroundColor:colors.surface,overflow:"hidden"},
  avatar:{width:"100%",height:"100%"},
  avatarFallback:{flex:1,alignItems:"center",justifyContent:"center",
    backgroundColor:colors.primarySoft},
  initials:{color:colors.primary},
  nameBlock:{flex:1,minWidth:0,paddingBottom:spacing.sm,gap:spacing.xs},
  playerName:{lineHeight:32,color:colors.text},
  position:{alignSelf:"flex-start",alignItems:"center",gap:spacing.xs,
    backgroundColor:colors.primarySoft,paddingHorizontal:spacing.sm,
    minHeight:33,borderRadius:radius.pill},
  positionText:{color:colors.primary},
  affiliation:{minHeight:68,alignItems:"center",gap:spacing.sm,
    padding:spacing.md,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
  roleBadge:{paddingVertical:4,paddingHorizontal:spacing.sm,
    borderRadius:radius.pill,backgroundColor:colors.primarySoft},
  section:{gap:spacing.sm},
  sectionHeader:{alignItems:"center",gap:spacing.sm,paddingHorizontal:spacing.xs,
    minHeight:40},
  countPill:{backgroundColor:colors.primarySoft,minWidth:30,
    alignItems:"center",justifyContent:"center",borderRadius:radius.pill,
    paddingHorizontal:spacing.sm,minHeight:26},
  statsRow:{gap:spacing.sm},
  statTile:{flex:1,minWidth:0,alignItems:"center",gap:spacing.xs,
    borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,
    backgroundColor:colors.surface,paddingVertical:spacing.md,
    paddingHorizontal:spacing.xs},
  statValue:{color:colors.text},
  statLabel:{textAlign:"center"},
  statEmpty:{flexDirection:"row",alignItems:"center",gap:spacing.md,
    paddingVertical:spacing.lg},
  teamCard:{gap:spacing.md,padding:spacing.md},
  teamRow:{alignItems:"center",gap:spacing.md},
  teamLogoFrame:{height:64,width:64,borderRadius:radius.md,
    backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center",
    overflow:"hidden"},
  teamLogo:{width:"100%",height:"100%"},
  teamMeta:{alignItems:"center",gap:spacing.xs},
  roleChip:{alignSelf:"flex-start",alignItems:"center",gap:spacing.xs,
    paddingVertical:4,paddingHorizontal:spacing.sm,
    borderRadius:radius.pill,backgroundColor:colors.primarySoft},
  teamStatFooter:{alignItems:"center",gap:spacing.sm,
    borderTopWidth:1,borderTopColor:colors.border,paddingTop:spacing.sm},
  failure:{alignItems:"center",gap:spacing.md,paddingVertical:spacing.xl},
  center:{textAlign:"center"},
  pressed:{opacity:.82},
});
