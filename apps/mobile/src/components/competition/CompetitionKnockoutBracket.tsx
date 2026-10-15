import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {CompetitionDto,CompetitionMatchDto} from "@leaguekick/contracts";
import {router} from "expo-router";
import {ScrollView,Pressable,StyleSheet,View} from "react-native";
import {knockoutRoundColumns,verifiedKnockoutConnections} from "../../lib/competition-detail-standings";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Card} from "../ui/Card";

const finished=(m:CompetitionMatchDto)=>m.status==="COMPLETED"||m.status==="CORRECTED";
export function CompetitionKnockoutBracket({competition}:{competition:CompetitionDto}){
  const {t,isRTL}=useLocale();
  const rounds=knockoutRoundColumns(competition.matches);
  const connections=verifiedKnockoutConnections(competition.matches);
  const connected=new Map(connections.map(item=>[item.sourceMatchId,item]));
  const open=(id:string)=>router.push({pathname:"/competitions/[competitionId]/matches/[matchId]",
    params:{competitionId:competition.id,matchId:id}});
  if(rounds.length===0)return null;
  return <Card testID="competition-phase4-visual-bracket" style={styles.wrapper}>
    <View style={[styles.head,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.icon}><Ionicons name="git-branch-outline" size={21} color={colors.primary}/></View>
      <View style={{flex:1}}>
        <AppText weight="bold" variant="bodyLarge">{t("competition.detail.bracketTitle")}</AppText>
        <AppText variant="caption" muted>{t("competition.detail.bracketHint")}</AppText>
      </View>
    </View>
    <ScrollView horizontal testID="competition-visual-bracket-scroll"
      showsHorizontalScrollIndicator={false} directionalLockEnabled nestedScrollEnabled
      contentContainerStyle={[styles.columns,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {rounds.map((column,index)=><View testID={`competition-visual-round-${column.round}`}
        key={column.round} style={styles.column}>
        <View style={[styles.columnHead,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name={column.isFinal?"trophy-outline":"git-branch-outline"} size={18}
            color={colors.primary}/>
          <AppText weight="bold" style={{flex:1}} numberOfLines={1}>
            {column.isFinal?t("competition.detail.bracketFinal"):
              t("competition.round",{number:column.round})}
          </AppText>
          <AppText variant="caption" muted>{column.matches.length}</AppText>
        </View>
        <View style={styles.roundMatches}>
          {column.matches.map(match=>{
            const verified=finished(match)&&match.homeScore!==null&&match.awayScore!==null;
            const winner=verified?match.winnerTeamId:null;
            const next=connected.get(match.id);
            return <Pressable testID={`competition-visual-match-${match.id}`}
              key={match.id} accessibilityRole="button"
              accessibilityLabel={`${match.homeTeamName??t("competition.tbd")} –
                ${match.awayTeamName??t("competition.tbd")}`}
              onPress={()=>open(match.id)} style={({pressed})=>[
                styles.fixture,pressed&&styles.pressed,
                match.status==="IN_PROGRESS"&&styles.liveBorder,
              ]}>
              <View style={[styles.fixtureMeta,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <AppText variant="caption" muted style={{flex:1}}>
                  {t("competition.detail.matchNumber",{number:match.slotNumber})}
                </AppText>
                <AppText variant="caption" weight="semibold"
                  style={{color:match.status==="IN_PROGRESS"?colors.danger:colors.textMuted}}>
                  {t(`competition.matchStatus.${match.status}` as never)}
                </AppText>
              </View>
              {(["HOME","AWAY"] as const).map(side=>{
                const isHome=side==="HOME";
                const name=isHome?match.homeTeamName:match.awayTeamName;
                const team=isHome?match.homeTeamId:match.awayTeamId;
                const score=isHome?match.homeScore:match.awayScore;
                return <View key={side} style={[styles.team,
                  {flexDirection:isRTL?"row-reverse":"row"},
                  Boolean(winner&&winner===team)&&styles.winner]}>
                  {winner===team?<Ionicons name="checkmark-circle" size={16} color="#187D52"/>:
                    <Ionicons name="shield-outline" size={16} color={colors.textMuted}/>}
                  <AppText numberOfLines={2} weight={winner===team?"bold":"semibold"}
                    style={{flex:1}}>{name??t("competition.tbd")}</AppText>
                  <AppText weight="bold" forceLtr style={{color:colors.primary}}>
                    {verified?score:"–"}
                  </AppText>
                </View>;
              })}
              {next?<View testID={`competition-visual-advanced-${match.id}`}
                style={[styles.progression,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <Ionicons name="arrow-forward-outline" size={15} color={colors.primary}/>
                <AppText variant="caption" weight="semibold" style={{flex:1,color:colors.primary}}>
                  {t("competition.detail.officialAdvance",{
                    round:next.nextRound,
                    side:t(next.side==="HOME"?"competition.detail.homeSide":"competition.detail.awaySide"),
                  })}
                </AppText>
              </View>:null}
            </Pressable>;
          })}
        </View>
        {index<rounds.length-1?<View style={styles.connect}>
          <Ionicons name={isRTL?"arrow-back-circle-outline":"arrow-forward-circle-outline"}
            size={24} color={colors.primary}/>
        </View>:null}
      </View>)}
    </ScrollView>
    <View style={[styles.foot,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Ionicons name="information-circle-outline" size={17} color={colors.primary}/>
      <AppText variant="caption" muted style={{flex:1}}>
        {t("competition.detail.bracketNotProjected")}
      </AppText>
    </View>
  </Card>;
}
const styles=StyleSheet.create({
  wrapper:{gap:spacing.md,padding:spacing.sm},
  head:{alignItems:"center",gap:spacing.sm,paddingHorizontal:spacing.xs},
  icon:{width:38,height:38,alignItems:"center",justifyContent:"center",
    borderRadius:radius.md,backgroundColor:colors.primarySoft},
  columns:{alignItems:"flex-start",gap:spacing.sm,paddingBottom:spacing.sm},
  column:{width:244,gap:spacing.sm},
  columnHead:{alignItems:"center",gap:spacing.xs,backgroundColor:colors.primarySoft,
    minHeight:48,paddingHorizontal:spacing.sm,borderRadius:radius.sm},
  roundMatches:{gap:spacing.sm},
  fixture:{padding:spacing.sm,gap:spacing.xs,borderRadius:radius.md,
    borderColor:colors.border,borderWidth:1,backgroundColor:colors.surface},
  pressed:{backgroundColor:colors.primarySoft},
  liveBorder:{borderColor:colors.danger},
  fixtureMeta:{gap:spacing.xs,alignItems:"center"},
  team:{alignItems:"center",gap:spacing.sm,paddingVertical:8,
    borderRadius:radius.sm,paddingHorizontal:spacing.xs},
  winner:{backgroundColor:"#EAF7EF"},
  progression:{gap:5,alignItems:"center",backgroundColor:colors.primarySoft,
    padding:6,borderRadius:radius.sm},
  connect:{alignSelf:"center",paddingTop:spacing.xs},
  foot:{gap:spacing.xs,alignItems:"center",paddingHorizontal:spacing.xs},
});
