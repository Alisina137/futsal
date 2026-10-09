import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { lastFiveLeagueResults } from "@leaguekick/contracts";
import type { CompetitionDto, CompetitionStandingRowDto, LeagueFormResult } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useMemo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { resolveMediaImageUrl } from "../../lib/api";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "../ui/AppText";

type Column={
  key:"played"|"wins"|"draws"|"losses"|"goalsFor"|"goalsAgainst"|"goalDifference"|"points";
  label:string;
  width:number;
};

const NUMERIC_WIDTH=49;
const FORM_WIDTH=160;
const ROW_HEIGHT=62;
const HEADER_HEIGHT=52;
const formAppearance:Record<LeagueFormResult,{background:string;icon:keyof typeof Ionicons.glyphMap}>={
  W:{background:"#22965B",icon:"checkmark"},
  D:{background:"#818A98",icon:"remove"},
  L:{background:"#D74646",icon:"close"},
};

function FormBadges({results}:{results:LeagueFormResult[]}){
  const {t,isRTL}=useLocale();
  return <View style={[styles.formStrip,{flexDirection:isRTL?"row-reverse":"row"}]}>
    {results.length===0?<AppText variant="caption" muted>—</AppText>:
      results.map((result,index)=><View key={index} style={[styles.formBadge,
        {backgroundColor:formAppearance[result].background}]}
        accessible accessibilityLabel={t(`competition.standingsForm.${result}` as never)}>
        <Ionicons name={formAppearance[result].icon} color="#FFFFFF" size={14}/>
      </View>)}
  </View>;
}

/** A two-pane table: the rank / crest / team column never moves.
 * All numeric data, including the last five results, moves inside one horizontal
 * ScrollView so every row and heading uses the exact same scroll position.
 * Vertical scrolling remains owned by the parent competition profile. */
export function LeagueStandingsTable({competition,rows}:{
  competition:CompetitionDto;rows:CompetitionStandingRowDto[];
}){
  const {t,isRTL}=useLocale();
  const teams=useMemo(()=>new Map(competition.teams.map(team=>[team.teamId,team])),[competition.teams]);
  const table=useMemo(()=>rows.slice().sort((a,b)=>a.position-b.position||a.teamName.localeCompare(b.teamName)),
    [rows]);
  const forms=useMemo(()=>new Map(table.map(row=>[row.teamId,lastFiveLeagueResults(
    competition.matches,
    row.teamId,
  )])),[competition.matches,table]);

  const columns:Column[]=[
    {key:"played",label:t("competition.played"),width:NUMERIC_WIDTH},
    {key:"wins",label:t("competition.wins"),width:NUMERIC_WIDTH},
    {key:"draws",label:t("competition.draws"),width:NUMERIC_WIDTH},
    {key:"losses",label:t("competition.losses"),width:NUMERIC_WIDTH},
    {key:"goalsFor",label:t("competition.standingsGoalsFor"),width:NUMERIC_WIDTH},
    {key:"goalsAgainst",label:t("competition.standingsGoalsAgainst"),width:NUMERIC_WIDTH},
    {key:"goalDifference",label:t("competition.goalDifference"),width:NUMERIC_WIDTH+7},
    {key:"points",label:t("competition.points"),width:NUMERIC_WIDTH+8},
  ];
  const open=(teamId:string)=>router.push({pathname:"/teams/[teamId]",params:{teamId}});

  return <View testID="league-standings-table" style={styles.frame}>
    <View testID="league-standings-hint" style={[styles.swipeHint,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Ionicons name="swap-horizontal-outline" size={17} color={colors.primary}/>
      <AppText variant="caption" muted style={{flex:1}}>
        {t("competition.standingsSwipeHint")}
      </AppText>
    </View>
    <View style={[styles.tableBody,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View testID="league-pinned-team-column" style={styles.teamPane}>
        <View style={[styles.headerCell,styles.teamHeading]}>
          <AppText weight="semibold" variant="caption" numberOfLines={1}>
            {t("competition.teams")}
          </AppText>
        </View>
        {table.map(row=>{
          const logo=resolveMediaImageUrl(teams.get(row.teamId)?.logoUrl??null);
          return <Pressable key={row.teamId} testID={`league-team-${row.teamId}`}
            accessibilityRole="button" accessibilityLabel={`${row.position}. ${row.teamName}`}
            onPress={()=>open(row.teamId)}
            style={({pressed})=>[styles.teamRow,
              {flexDirection:isRTL?"row-reverse":"row"},pressed&&styles.pressed]}>
            <AppText variant="caption" weight="semibold" style={styles.position} forceLtr>
              {row.position}
            </AppText>
            <View style={styles.logo}>
              {logo?<Image source={{uri:logo}} style={styles.logoImage} resizeMode="cover"/>:
                <Ionicons name="shield-outline" size={19} color={colors.primary}/>}
            </View>
            <AppText numberOfLines={1} weight="semibold" style={styles.teamName}>
              {row.teamName}
            </AppText>
          </Pressable>;
        })}
      </View>

      <ScrollView testID="league-scrollable-stats" horizontal
        showsHorizontalScrollIndicator={false}
        directionalLockEnabled
        nestedScrollEnabled
        style={styles.metricsViewport}
        contentContainerStyle={styles.metricsContent}>
        <View style={styles.metricsTable}>
          <View style={[styles.metricsRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
            {columns.map(column=><View key={column.key} style={[styles.headerCell,{width:column.width}]}>
              <AppText weight={column.key==="points"?"bold":"semibold"}
                variant="caption" numberOfLines={1} style={styles.valueText}>
                {column.label}
              </AppText>
            </View>)}
            <View style={[styles.headerCell,{width:FORM_WIDTH}]}>
              <AppText variant="caption" weight="semibold" style={styles.valueText} numberOfLines={1}>
                {t("competition.standingsLastFive")}
              </AppText>
            </View>
          </View>
          {table.map(row=><View key={row.teamId}
            testID={`league-metrics-${row.teamId}`}
            style={[styles.metricsRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
            {columns.map(column=><View key={column.key}
              style={[styles.numberBox,{width:column.width},
                column.key==="points"&&styles.pointsBox]}>
              <AppText weight={column.key==="points"?"bold":"regular"} forceLtr
                style={[styles.valueText,column.key==="points"&&styles.pointsText]}>
                {row[column.key]}
              </AppText>
            </View>)}
            <View style={[styles.numberBox,{width:FORM_WIDTH}]}>
              <FormBadges results={forms.get(row.teamId)??[]}/>
            </View>
          </View>)}
        </View>
      </ScrollView>
    </View>
  </View>;
}

const styles=StyleSheet.create({
  frame:{borderRadius:radius.md,borderWidth:1,borderColor:colors.border,
    backgroundColor:colors.surface,overflow:"hidden"},
  swipeHint:{alignItems:"center",gap:6,minHeight:37,paddingHorizontal:spacing.sm,
    backgroundColor:colors.primarySoft},
  tableBody:{alignItems:"flex-start"},
  teamPane:{width:"44%",backgroundColor:colors.surface,zIndex:1,
    borderRightWidth:1,borderRightColor:colors.border},
  metricsViewport:{width:"56%",flexGrow:0,flexShrink:0},
  metricsContent:{flexGrow:0},
  metricsTable:{backgroundColor:colors.surface},
  headerCell:{height:HEADER_HEIGHT,alignItems:"center",justifyContent:"center",
    paddingHorizontal:3,backgroundColor:colors.surfaceMuted},
  teamHeading:{alignItems:"flex-start",paddingHorizontal:spacing.sm},
  teamRow:{height:ROW_HEIGHT,paddingHorizontal:5,alignItems:"center",gap:5,
    borderTopWidth:1,borderTopColor:colors.border},
  position:{width:22,textAlign:"center",color:colors.textMuted},
  logo:{width:28,height:28,borderRadius:14,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center",overflow:"hidden"},
  logoImage:{width:"100%",height:"100%"},
  teamName:{flex:1,minWidth:0},
  metricsRow:{height:ROW_HEIGHT,alignItems:"center",borderTopWidth:1,borderTopColor:colors.border},
  numberBox:{height:ROW_HEIGHT,alignItems:"center",justifyContent:"center",paddingHorizontal:2},
  valueText:{textAlign:"center",fontVariant:["tabular-nums"]},
  pointsBox:{backgroundColor:"#EFF5FF"},
  pointsText:{color:colors.primary},
  formStrip:{alignItems:"center",justifyContent:"center",gap:4,width:"100%"},
  formBadge:{width:22,height:22,borderRadius:11,alignItems:"center",justifyContent:"center"},
  pressed:{backgroundColor:colors.primarySoft},
});
