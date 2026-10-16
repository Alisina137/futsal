import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {CompetitionDto,CompetitionMatchDto} from "@leaguekick/contracts";
import {router} from "expo-router";
import {useMemo,useState} from "react";
import {Image,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {resolveMediaImageUrl} from "../../lib/api";
import {emptyCompetitionMatchPreferences,matchFitsPreferences,
  normalizedCompetitionMatchPreferences,type CompetitionMatchPreferences,
  type CompetitionMatchDatePreset} from "../../lib/competition-detail-match-filters";
import {formatFixtureSchedule,groupMatchesByRound} from "../../lib/competition-match-schedule";
import {formatRefereeScheduleParts} from "../../lib/date-time";
import {useLocale} from "../../providers/LocaleProvider";
import {useVisibleTab} from "../../hooks/useVisibleTab";
import {VenueMatchSelect} from "../venues/VenueMatchSelect";
import {AppText} from "../ui/AppText";
import {Card} from "../ui/Card";

export type MatchFilter="ALL"|"UPCOMING"|"LIVE"|"FINISHED"|"POSTPONED"|"CANCELLED";
const FILTERS:MatchFilter[]=["ALL","UPCOMING","LIVE","FINISHED","POSTPONED","CANCELLED"];
const done=(match:CompetitionMatchDto)=>match.status==="COMPLETED"||match.status==="CORRECTED";
const upcoming=(match:CompetitionMatchDto)=>
  match.status==="SCHEDULED"||match.status==="UNSCHEDULED";
function order(matches:CompetitionMatchDto[]){
  const priority=(match:CompetitionMatchDto)=>match.status==="IN_PROGRESS"?0:
    upcoming(match)?1:done(match)?2:3;
  return [...matches].sort((a,b)=>{
    const group=priority(a)-priority(b);
    if(group!==0)return group;
    const timeA=a.startsAt??(done(a)?"":"9999");
    const timeB=b.startsAt??(done(b)?"":"9999");
    const date=done(a)?timeB.localeCompare(timeA):timeA.localeCompare(timeB);
    return date||a.roundNumber-b.roundNumber||a.slotNumber-b.slotNumber||a.id.localeCompare(b.id);
  });
}
const kabulDate=(value:string)=>new Intl.DateTimeFormat("en-CA",{
  timeZone:"Asia/Kabul",calendar:"gregory",year:"numeric",month:"2-digit",day:"2-digit",
}).format(new Date(value));
function TeamLogo({uri}:{uri:string|null|undefined}){
  const url=resolveMediaImageUrl(uri);
  return <View style={styles.crest}>
    {url?<Image source={{uri:url}} resizeMode="cover" style={styles.crestImage}/>:
      <Ionicons name="shield-outline" color={colors.primary} size={24}/>}
  </View>;
}
export function CompetitionMatchList({competition,initialFilter="ALL",
  preferences,onPreferencesChange,onPrimaryFilterChange,refreshing=false,onRefresh,
  myAcceptedTeamId=null}:{
  competition:CompetitionDto;initialFilter?:MatchFilter|undefined;
  preferences?:CompetitionMatchPreferences|undefined;
  onPreferencesChange?:((next:CompetitionMatchPreferences)=>void)|undefined;
  onPrimaryFilterChange?:((next:MatchFilter)=>void)|undefined;
  refreshing?:boolean|undefined;onRefresh?:(()=>void)|undefined;
  myAcceptedTeamId?:string|null|undefined;
}){
  const {t,language,isRTL}=useLocale();
  const [filter,setFilter]=useState<MatchFilter>(initialFilter);
  const statusNav=useVisibleTab<MatchFilter>(filter);
  const [localPreferences,setLocalPreferences]=useState<CompetitionMatchPreferences>(
    emptyCompetitionMatchPreferences);
  const currentPreferences=normalizedCompetitionMatchPreferences(
    preferences??localPreferences,competition);
  const {teamId:teamFilter,stage:stageFilter,round:roundFilter,
    group:groupFilter,date:dateFilter}=currentPreferences;
  const changePreferences=(patch:Partial<CompetitionMatchPreferences>)=>{
    const next={...currentPreferences,...patch};
    if(onPreferencesChange)onPreferencesChange(next);
    else setLocalPreferences(next);
  };
  const setDateFilter=(date:CompetitionMatchDatePreset)=>changePreferences({date});
  const chooseFilter=(next:MatchFilter)=>{
    setFilter(next);
    statusNav.focus(next,true);
    onPrimaryFilterChange?.(next);
  };
  const teams=useMemo(()=>new Map(competition.teams.map(team=>[team.teamId,team])),[competition.teams]);
  const totals={
    ALL:competition.matches.length,
    UPCOMING:competition.matches.filter(upcoming).length,
    LIVE:competition.matches.filter(match=>match.status==="IN_PROGRESS").length,
    FINISHED:competition.matches.filter(done).length,
    POSTPONED:competition.matches.filter(match=>match.status==="POSTPONED").length,
    CANCELLED:competition.matches.filter(match=>match.status==="CANCELLED").length,
  };
  const acceptedTeams=competition.teams.filter(team=>team.status==="ACCEPTED")
    .slice().sort((a,b)=>a.teamName.localeCompare(b.teamName));
  const stages=[...new Set(competition.matches.map(match=>match.stage))];
  const rounds=[...new Set(competition.matches.filter(match=>stageFilter==="ALL"||match.stage===stageFilter)
    .map(match=>match.roundNumber))].sort((a,b)=>a-b);
  const groupNames=[...new Set(competition.matches.filter(match=>match.stage==="GROUP")
    .map(match=>match.groupName).filter((name):name is string=>Boolean(name)))].sort();
  const extraFiltersActive=teamFilter!=="ALL"||stageFilter!=="ALL"||
    roundFilter!==null||groupFilter!=="ALL"||dateFilter!=="ALL";
  const clearExtraFilters=()=>changePreferences(emptyCompetitionMatchPreferences);
  const matches=useMemo(()=>order(competition.matches.filter(match=>
    filter==="ALL"?true:
      filter==="FINISHED"?done(match):
      filter==="LIVE"?match.status==="IN_PROGRESS":
      filter==="POSTPONED"?match.status==="POSTPONED":
      filter==="CANCELLED"?match.status==="CANCELLED":upcoming(match)
  ).filter(match=>(teamFilter==="ALL"||match.homeTeamId===teamFilter||match.awayTeamId===teamFilter)&&
    (stageFilter==="ALL"||match.stage===stageFilter)&&
    (roundFilter===null||match.roundNumber===roundFilter)&&
    (groupFilter==="ALL"||match.groupName===groupFilter)&&
    matchFitsPreferences(match,currentPreferences))),
    [competition.matches,filter,teamFilter,stageFilter,roundFilter,groupFilter,dateFilter]);
  const groups=useMemo(()=>groupMatchesByRound(matches),[matches]);
  const roundsInStage=useMemo(()=>{
    const maximum=new Map<CompetitionMatchDto["stage"],number>();
    for(const match of competition.matches){
      maximum.set(match.stage,Math.max(maximum.get(match.stage)??0,match.roundNumber));
    }
    return maximum;
  },[competition.matches]);
  const open=(match:CompetitionMatchDto)=>router.push({
    pathname:"/competitions/[competitionId]/matches/[matchId]",
    params:{competitionId:competition.id,matchId:match.id},
  });
  return <View style={styles.container} testID="competition-matches-list">
    <View testID="competition-match-filter-summary" style={[styles.summaryStrip,
      {flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={{flex:1,gap:2}}>
        <AppText weight="semibold" variant="caption">
          {t("competition.detail.matchFilterSummary",{shown:matches.length,total:competition.matches.length})}
        </AppText>
        <AppText variant="caption" muted>{t("competition.detail.matchFilterHint")}</AppText>
      </View>
      {onRefresh?<Pressable testID="competition-match-refresh" accessibilityRole="button"
        accessibilityLabel={t("competition.detail.refreshMatches")}
        disabled={refreshing} onPress={onRefresh} style={styles.refreshAction}>
        <Ionicons name="refresh-outline" size={18} color={colors.primary}/>
        <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
          {refreshing?t("competition.detail.refreshing"):t("competition.detail.refresh")}
        </AppText>
      </Pressable>:null}
    </View>
    <ScrollView testID="match-filter-rail" horizontal showsHorizontalScrollIndicator={false}
      ref={statusNav.scrollRef} onLayout={statusNav.onViewport}
      onContentSizeChange={statusNav.onContentSize}
      style={styles.filterViewport}
      contentContainerStyle={[styles.filters,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {FILTERS.map(value=><Pressable key={value} testID={`match-filter-${value}`}
        onLayout={event=>statusNav.cellLayout(value,event)}
        accessibilityRole="tab" accessibilityState={{selected:value===filter}}
        onPress={()=>chooseFilter(value)}
        style={[styles.chip,filter===value&&styles.selected]}>
        <AppText variant="caption" weight="semibold" numberOfLines={1}
          style={{color:filter===value?"#FFFFFF":colors.text}}>
          {t(`competition.matchList.filter.${value}` as never)}
        </AppText>
        <View style={[styles.filterCount,filter===value&&styles.filterCountSelected]}>
          <AppText variant="caption" weight="bold" style={{color:filter===value?"#FFFFFF":colors.primary}}>
            {totals[value]}
          </AppText>
        </View>
      </Pressable>)}
    </ScrollView>
    {myAcceptedTeamId&&acceptedTeams.some(team=>team.teamId===myAcceptedTeamId)?
      <Pressable testID="competition-my-team-fixtures" accessibilityRole="button"
        onPress={()=>changePreferences({teamId:teamFilter===myAcceptedTeamId?"ALL":myAcceptedTeamId})}
        style={[styles.myTeamShortcut,{flexDirection:isRTL?"row-reverse":"row"},
          teamFilter===myAcceptedTeamId&&styles.myTeamShortcutActive]}>
        <Ionicons name="shirt-outline" size={19}
          color={teamFilter===myAcceptedTeamId?"#FFFFFF":colors.primary}/>
        <AppText weight="semibold" variant="caption" style={{
          color:teamFilter===myAcceptedTeamId?"#FFFFFF":colors.primary,flex:1}}>
          {t("competition.detail.myTeamMatches")}
        </AppText>
        <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={17}
          color={teamFilter===myAcceptedTeamId?"#FFFFFF":colors.primary}/>
      </Pressable>:null}
    {/* Compact selects replace the five long pill-navigation strips.
        Keep each active preference, including stage/round and group dependencies. */}
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      testID="competition-match-select-rail" style={{flexGrow:0}}
      contentContainerStyle={[styles.selectFilters,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View testID="competition-match-team-filters">
        <VenueMatchSelect testID="competition-match-select-team" icon="shirt-outline"
          label={t("competition.phase5.filter.team")} value={teamFilter==="ALL"?"":teamFilter}
          allLabel={t("competition.phase5.allTeams")}
          options={acceptedTeams.map(team=>({value:team.teamId,label:team.teamName}))}
          onSelect={value=>changePreferences({teamId:value||"ALL"})}/>
      </View>
      {stages.length>1?<View testID="competition-match-stage-filters">
        <VenueMatchSelect testID="competition-match-select-stage" icon="layers-outline"
          label={t("competition.phase5.filter.stage")} value={stageFilter==="ALL"?"":stageFilter}
          allLabel={t("competition.phase5.filter.allStages")}
          options={stages.map(stage=>({value:stage,
            label:t(`competition.phase5.stage.${stage}` as never)}))}
          onSelect={value=>changePreferences({
            stage:(value||"ALL") as CompetitionMatchPreferences["stage"],
            round:null,group:"ALL",
          })}/>
      </View>:null}
      <View testID="competition-match-round-filters">
        <VenueMatchSelect testID="competition-match-select-round" icon="calendar-number-outline"
          label={t("competition.phase5.filter.round")}
          value={roundFilter===null?"":String(roundFilter)}
          allLabel={t("competition.phase5.filter.allRounds")}
          options={rounds.map(round=>({value:String(round),label:t("competition.round",{number:round})}))}
          onSelect={value=>changePreferences({round:value?Number(value):null})}/>
      </View>
      {groupNames.length>1&&(stageFilter==="ALL"||stageFilter==="GROUP")?
        <View testID="competition-match-group-filters">
          <VenueMatchSelect testID="competition-match-select-group" icon="people-outline"
            label={t("competition.phase5.filter.group")}
            value={groupFilter==="ALL"?"":groupFilter}
            allLabel={t("competition.phase5.filter.allGroups")}
            options={groupNames.map(group=>({value:group,
              label:t("competition.group",{name:group})}))}
            onSelect={value=>changePreferences({group:value||"ALL"})}/>
        </View>:null}
      <View testID="competition-match-date-filters">
        <VenueMatchSelect testID="competition-match-select-date" icon="calendar-outline"
          label={t("competition.detail.dateFilter")}
          value={dateFilter==="ALL"?"":dateFilter}
          allLabel={t("competition.detail.date.ALL")}
          options={(["TODAY","TOMORROW","NEXT_7_DAYS"] as const).map(preset=>({
            value:preset,label:t(`competition.detail.date.${preset}` as never),
          }))}
          onSelect={value=>setDateFilter((value||"ALL") as CompetitionMatchDatePreset)}/>
      </View>
    </ScrollView>
    {extraFiltersActive?<Pressable testID="competition-match-clear-filters" accessibilityRole="button"
      style={styles.clearFilters} onPress={clearExtraFilters}>
      <Ionicons name="close-circle-outline" size={18} color={colors.primary}/>
      <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
        {t("competition.phase5.filter.clear")}
      </AppText>
    </Pressable>:null}
    {matches.length===0?<Card style={styles.empty} testID="competition-match-empty">
      <Ionicons name="calendar-outline" size={30} color={colors.primary}/>
      <AppText muted style={{textAlign:"center"}}>
        {t("competition.matchList.empty")}
      </AppText>
      {extraFiltersActive?<Pressable accessibilityRole="button"
        testID="competition-match-empty-reset" onPress={clearExtraFilters}
        style={styles.refreshAction}>
        <Ionicons name="close-circle-outline" color={colors.primary} size={18}/>
        <AppText weight="semibold" variant="caption" style={{color:colors.primary}}>
          {t("competition.phase5.filter.clear")}
        </AppText>
      </Pressable>:null}
    </Card>:null}
    {groups.map(group=><View key={group.key} style={styles.roundGroup}
        testID={`match-round-${group.stage}-${group.roundNumber}`}>
      <View style={[styles.roundHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="layers-outline" size={17} color={colors.primary}/>
        <AppText weight="bold" variant="bodyLarge" style={{flex:1}}>
          {group.stage==="LEAGUE"
            ?t("competition.matchList.roundOf",{
              number:group.roundNumber,total:roundsInStage.get(group.stage)??group.roundNumber,
            })
            :group.stage==="GROUP"
              ?`${t("competition.profile.groupStage")} · ${t("competition.round",{number:group.roundNumber})}`
              :`${t("competition.profile.knockoutStage")} · ${t("competition.round",{number:group.roundNumber})}`}
        </AppText>
        <View style={styles.dayCount}>
          <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
            {group.matches.length}
          </AppText>
        </View>
      </View>
      {group.matches.map(match=>{
        const home=teams.get(match.homeTeamId??"");
        const away=teams.get(match.awayTeamId??"");
        const fixtureTime=formatFixtureSchedule(match.startsAt,language);
        const localSchedule=match.startsAt?formatRefereeScheduleParts(match.startsAt,language):null;
        const today=Boolean(match.startsAt&&Number.isFinite(Date.parse(match.startsAt))&&
          kabulDate(match.startsAt)===kabulDate(new Date().toISOString()));
        const score=match.homeScore!==null&&match.awayScore!==null;
        return <Pressable key={match.id} testID={`competition-match-${match.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${match.homeTeamName??t("competition.tbd")}, ${match.awayTeamName??t("competition.tbd")}`}
          onPress={()=>open(match)}
          style={({pressed})=>[styles.matchRow,
            match.status==="IN_PROGRESS"&&styles.matchLive,
            done(match)&&styles.matchFinished,pressed&&styles.pressed]}>
          <View style={[styles.rowInner,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <View style={styles.teams}>
              <View style={[styles.teamLine,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <Pressable accessibilityRole={match.homeTeamId&&!home?.offline?"button":"text"}
                  disabled={!match.homeTeamId||Boolean(home?.offline)}
                  onPress={event=>{event.stopPropagation();if(match.homeTeamId)router.push({pathname:"/teams/[teamId]",params:{teamId:match.homeTeamId}});}}
                  style={[styles.teamButton,{flexDirection:isRTL?"row-reverse":"row"}]}>
                  <TeamLogo uri={home?.logoUrl}/>
                  <AppText weight="semibold" numberOfLines={1} style={styles.teamText}>
                    {match.homeTeamName??t("competition.tbd")}
                  </AppText>
                </Pressable>
                {score?<AppText weight="bold" style={styles.score}>{match.homeScore}</AppText>:null}
              </View>
              <View style={[styles.teamLine,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <Pressable accessibilityRole={match.awayTeamId&&!away?.offline?"button":"text"}
                  disabled={!match.awayTeamId||Boolean(away?.offline)}
                  onPress={event=>{event.stopPropagation();if(match.awayTeamId)router.push({pathname:"/teams/[teamId]",params:{teamId:match.awayTeamId}});}}
                  style={[styles.teamButton,{flexDirection:isRTL?"row-reverse":"row"}]}>
                  <TeamLogo uri={away?.logoUrl}/>
                  <AppText weight="semibold" numberOfLines={1} style={styles.teamText}>
                    {match.awayTeamName??t("competition.tbd")}
                  </AppText>
                </Pressable>
                {score?<AppText weight="bold" style={styles.score}>{match.awayScore}</AppText>:null}
              </View>
            </View>
            <View style={[styles.detailSide,isRTL?styles.detailSideRtl:styles.detailSideLtr]}>
              <AppText variant="caption" weight="semibold" numberOfLines={2}
                style={styles.fixtureDate}>
                {localSchedule?.date??t("competition.matchList.unscheduled")}
              </AppText>
              {fixtureTime?<AppText variant="caption" weight="medium" style={styles.fixtureClock}
                numberOfLines={1} forceLtr>{fixtureTime.time}</AppText>:null}
              {today?<View style={styles.todayPill}>
                <AppText variant="caption" weight="bold" style={{color:"#116B43"}}>
                  {t("competition.phase5.today")}
                </AppText>
              </View>:null}
              {match.status==="IN_PROGRESS"
                ?<View style={styles.liveIndicator}>
                  <View style={styles.liveDot}/>
                  <AppText variant="caption" weight="bold" style={styles.liveTag}>
                    {t("competition.profile.liveBadge")}
                  </AppText>
                </View>
                :<AppText variant="caption" weight="semibold" style={styles.fixtureState} numberOfLines={2}>
                  {t(`competition.matchStatus.${match.status}` as never)}
                </AppText>}
              {match.groupName&&group.stage==="GROUP"
                ?<AppText variant="caption" muted numberOfLines={1} style={styles.groupName}>
                  {match.groupName}
                </AppText>
                :null}
            </View>
          </View>
          <View style={[styles.matchFooter,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Pressable accessibilityRole="button" onPress={event=>{event.stopPropagation();router.push({
              pathname:"/venues/[venueId]",params:{venueId:competition.venueId},
            });}} style={[styles.venueLink,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Ionicons name="location-outline" size={15} color={colors.primary}/>
              <AppText variant="caption" numberOfLines={1} style={{color:colors.primary,flexShrink:1}}>
                {match.areaName?`${competition.venueName} · ${match.areaName}`:competition.venueName}
              </AppText>
            </Pressable>
            <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
              {t("competition.phase4.matchDetails")}
            </AppText>
            <Ionicons name={isRTL?"arrow-back":"arrow-forward"} size={16} color={colors.primary}/>
          </View>
        </Pressable>;
      })}
    </View>)}
  </View>;
}
const styles=StyleSheet.create({
  container:{gap:spacing.md},
  summaryStrip:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.md,padding:spacing.sm,alignItems:"center",gap:spacing.sm},
  myTeamShortcut:{minHeight:45,paddingHorizontal:spacing.md,borderRadius:radius.md,
    backgroundColor:colors.primarySoft,gap:spacing.sm,alignItems:"center",borderWidth:1,
    borderColor:colors.border},
  myTeamShortcutActive:{backgroundColor:colors.primary,borderColor:colors.primary},
  refreshAction:{minHeight:44,paddingHorizontal:spacing.sm,borderRadius:radius.md,
    flexDirection:"row",gap:5,alignItems:"center",justifyContent:"center",
    backgroundColor:colors.primarySoft},
  filterViewport:{height:50,minHeight:50,maxHeight:50,flexGrow:0,flexShrink:0},
  filters:{gap:spacing.sm,alignItems:"center",paddingVertical:3},
  selectFilters:{gap:spacing.sm,alignItems:"flex-start",paddingVertical:spacing.xs},
  clearFilters:{minHeight:42,flexDirection:"row",gap:6,alignItems:"center",alignSelf:"flex-start"},
  todayPill:{paddingHorizontal:7,paddingVertical:3,borderRadius:radius.pill,backgroundColor:"#D9F5E6"},
  teamButton:{flex:1,alignItems:"center",gap:spacing.sm,minHeight:40,minWidth:0},
  venueLink:{flex:1,minWidth:0,alignItems:"center",gap:3,minHeight:38},
  chip:{minHeight:44,paddingHorizontal:spacing.md,alignItems:"center",justifyContent:"center",gap:5,flexDirection:"row",
    borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  selected:{backgroundColor:colors.primary,borderColor:colors.primary},
  filterCount:{minWidth:23,height:23,paddingHorizontal:4,alignItems:"center",justifyContent:"center",
    backgroundColor:colors.primarySoft,borderRadius:12},
  filterCountSelected:{backgroundColor:"rgba(255,255,255,.22)"},
  empty:{alignItems:"center",gap:spacing.md,padding:spacing.lg},
  roundGroup:{gap:spacing.xs},
  roundHeader:{minHeight:42,gap:spacing.sm,alignItems:"center",paddingHorizontal:spacing.sm,
    backgroundColor:colors.primarySoft,borderRadius:radius.md},
  dayCount:{minWidth:27,height:27,borderRadius:14,alignItems:"center",justifyContent:"center",
    backgroundColor:colors.surface,paddingHorizontal:5},
  matchRow:{borderRadius:radius.md,backgroundColor:colors.surface,borderWidth:1,
    borderColor:colors.border,padding:spacing.md,gap:spacing.xs},
  matchLive:{borderColor:"#D84D4D",borderWidth:1.5},
  matchFinished:{borderColor:colors.primarySoft},
  rowInner:{gap:spacing.sm,alignItems:"stretch"},
  teams:{flex:1,gap:spacing.xs,minWidth:0},
  teamLine:{alignItems:"center",gap:spacing.sm,minHeight:37},
  teamText:{flex:1,minWidth:0},
  crest:{width:32,height:32,borderRadius:16,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center",overflow:"hidden"},
  crestImage:{width:"100%",height:"100%"},
  score:{width:25,textAlign:"center",color:colors.primary},
  detailSide:{width:112,alignItems:"center",justifyContent:"center",gap:3,paddingHorizontal:4},
  detailSideLtr:{borderLeftWidth:1,borderLeftColor:colors.border},
  detailSideRtl:{borderRightWidth:1,borderRightColor:colors.border},
  fixtureDate:{textAlign:"center",color:colors.primary,lineHeight:17},
  fixtureClock:{textAlign:"center",color:colors.text,lineHeight:17},
  liveTag:{textAlign:"center",color:colors.danger},
  liveIndicator:{flexDirection:"row",alignItems:"center",gap:5},
  liveDot:{width:7,height:7,borderRadius:4,backgroundColor:colors.danger},
  fixtureState:{textAlign:"center",color:colors.textMuted},
  matchFooter:{gap:spacing.xs,alignItems:"center",paddingTop:spacing.xs,
    borderTopWidth:1,borderTopColor:colors.border},
  groupName:{textAlign:"center",lineHeight:16},
  pressed:{backgroundColor:colors.primarySoft},
});
