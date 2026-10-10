import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { lastFiveLeagueResults } from "@leaguekick/contracts";
import type { CompetitionDto, CompetitionStandingRowDto, LeagueFormResult } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, View, type View as NativeView } from "react-native";
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
  const [preview,setPreview]=useState<{id:string;name:string;logo:string|null;x:number;y:number}|null>(null);
  const rowRefs=useRef(new Map<string,NativeView|null>());
  const showPreview=(id:string,name:string,logo:string|null)=>{
    const node=rowRefs.current.get(id);
    node?.measureInWindow((x,y,width,height)=>{
      const {width:screenWidth,height:screenHeight}=Dimensions.get("window");
      const panelWidth=Math.min(300,screenWidth-32);
      const left=Math.max(16,Math.min(isRTL?x+width-panelWidth:x,screenWidth-panelWidth-16));
      const top=Math.max(56,Math.min(y+height+5,screenHeight-160));
      setPreview({id,name,logo,x:left,y:top});
    });
  };
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
      <View testID="league-pinned-team-column" style={[styles.teamPane,
        isRTL?styles.teamPaneRTL:styles.teamPaneLTR]}>
        <View style={[styles.headerCell,styles.teamHeading]}>
          <AppText weight="semibold" variant="caption" numberOfLines={1}>
            {t("competition.teams")}
          </AppText>
        </View>
        {table.map(row=>{
          const logo=resolveMediaImageUrl(teams.get(row.teamId)?.logoUrl??null);
          return <View key={row.teamId} ref={node=>{rowRefs.current.set(row.teamId,node);}}
            style={[styles.teamRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <AppText variant="caption" weight="semibold" style={styles.position} forceLtr>
              {row.position}
            </AppText>
            <Pressable testID={`league-team-${row.teamId}`} accessibilityRole="button"
              accessibilityLabel={`${row.teamName}. ${t("competition.standingsTeamPreview")}`}
              onPress={()=>showPreview(row.teamId,row.teamName,logo)}
              onLongPress={()=>showPreview(row.teamId,row.teamName,logo)}
              onHoverIn={()=>showPreview(row.teamId,row.teamName,logo)}
              style={({pressed})=>[styles.namePress,{flexDirection:isRTL?"row-reverse":"row"},
                pressed&&styles.pressed]}>
              <View style={styles.logo}>
                {logo?<Image source={{uri:logo}} style={styles.logoImage} resizeMode="cover"/>:
                  <Ionicons name="shield-outline" size={19} color={colors.primary}/>}
              </View>
              <AppText numberOfLines={1} weight="semibold" style={styles.teamName}>
                {row.teamName}
              </AppText>
            </Pressable>
          </View>;
        })}
      </View>

      <ScrollView testID="league-scrollable-stats" horizontal
        showsHorizontalScrollIndicator={false}
        directionalLockEnabled
        nestedScrollEnabled
        style={styles.metricsViewport}
        contentContainerStyle={styles.metricsContent}>
        <View style={styles.metricsTable}>
          <View style={[styles.metricsHeaderRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
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
    <Modal testID="league-team-tooltip" transparent visible={Boolean(preview)}
      animationType="fade" onRequestClose={()=>setPreview(null)}>
      <View style={styles.tooltipOverlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button"
          accessibilityLabel={t("competition.standingsClosePreview")}
          onPress={()=>setPreview(null)}/>
        {preview?<View style={[styles.tooltip,{top:preview.y,left:preview.x}]}>
          <View style={[styles.tooltipHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <View style={styles.tooltipLogo}>
              {preview.logo?<Image source={{uri:preview.logo}} style={styles.logoImage} resizeMode="cover"/>:
                <Ionicons name="shield-outline" size={29} color={colors.primary}/>}
            </View>
            <AppText variant="bodyLarge" weight="bold" style={{flex:1,flexShrink:1}}
              numberOfLines={3}>{preview.name}</AppText>
          </View>
          {teams.get(preview.id)?.offline?<AppText variant="caption" muted>
            {t("competition.manualTeamBadge")}
          </AppText>:<Pressable testID="league-tooltip-open-team"
            accessibilityRole="button" onPress={()=>{const id=preview.id;setPreview(null);open(id);}}
            style={[styles.tooltipAction,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <AppText weight="semibold" style={{color:colors.primary,flex:1}}>
              {t("competition.standingsOpenTeam")}
            </AppText>
            <Ionicons name={isRTL?"arrow-back-outline":"arrow-forward-outline"}
              color={colors.primary} size={18}/>
          </Pressable>}
        </View>:null}
      </View>
    </Modal>
  </View>;
}

const styles=StyleSheet.create({
  frame:{borderRadius:radius.md,borderWidth:1,borderColor:colors.border,
    backgroundColor:colors.surface,overflow:"hidden"},
  swipeHint:{alignItems:"center",gap:6,minHeight:37,paddingHorizontal:spacing.sm,
    backgroundColor:colors.primarySoft},
  tableBody:{alignItems:"flex-start"},
  teamPane:{width:"48%",backgroundColor:colors.surface,zIndex:1},
  teamPaneLTR:{borderRightWidth:1,borderRightColor:colors.border},
  teamPaneRTL:{borderLeftWidth:1,borderLeftColor:colors.border},
  metricsViewport:{width:"52%",flexGrow:0,flexShrink:0},
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
  namePress:{flex:1,minWidth:0,gap:5,alignItems:"center",minHeight:52},
  tooltipOverlay:{flex:1},
  tooltip:{position:"absolute",width:300,maxWidth:"92%",padding:spacing.md,gap:spacing.md,
    borderRadius:radius.lg,backgroundColor:colors.surface,borderColor:colors.primary,borderWidth:1,
    elevation:9,shadowColor:"#0F172A",shadowRadius:16,shadowOpacity:.18,
    shadowOffset:{width:0,height:5}},
  tooltipHeader:{alignItems:"center",gap:spacing.sm},
  tooltipLogo:{width:48,height:48,borderRadius:24,overflow:"hidden",
    backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"},
  tooltipAction:{minHeight:44,paddingHorizontal:spacing.md,alignItems:"center",
    backgroundColor:colors.primarySoft,borderRadius:radius.md,gap:spacing.sm},
  metricsHeaderRow:{height:HEADER_HEIGHT,alignItems:"center"},
  metricsRow:{height:ROW_HEIGHT,alignItems:"center",borderTopWidth:1,borderTopColor:colors.border},
  numberBox:{height:ROW_HEIGHT,alignItems:"center",justifyContent:"center",paddingHorizontal:2},
  valueText:{textAlign:"center",fontVariant:["tabular-nums"]},
  pointsBox:{backgroundColor:"#EFF5FF"},
  pointsText:{color:colors.primary},
  formStrip:{alignItems:"center",justifyContent:"center",gap:4,width:"100%"},
  formBadge:{width:22,height:22,borderRadius:11,alignItems:"center",justifyContent:"center"},
  pressed:{backgroundColor:colors.primarySoft},
});
