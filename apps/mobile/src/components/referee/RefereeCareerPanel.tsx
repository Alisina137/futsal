import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,spacing,radius} from "@leaguekick/design-tokens";
import {router} from "expo-router";
import {useEffect,useMemo,useRef,useState} from "react";
import {Linking,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {refereeCareerApi,type RefereeCareerResponse,type RefereeCareerWindow,
  type RefereeCareerCalendar} from "../../lib/api";
import {formatRefereeCalendarPeriod,formatRefereeScheduleParts} from "../../lib/date-time";
import {refereeHistoryFilter,refereeHistoryLocalMonth,refereeHistoryOptions,refereeHistoryOutcome,
  type RefereeHistoryOutcome} from "../../lib/referee-career-view";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";
import {TextField} from "../ui/TextField";

type Section="overview"|"history"|"performance";
type Option={id:string;label:string};
const filters:RefereeCareerWindow[]=["7d","30d","90d","year","all"];
const outcomes:RefereeHistoryOutcome[]=["ALL","HOME_WIN","DRAW","AWAY_WIN"];
function Tile({value,label}:{value:number|string;label:string}){
  return <View style={styles.tile}>
    <AppText variant="title" weight="bold" style={{color:colors.primary,textAlign:"center"}}>
      {value}</AppText>
    <AppText variant="body" weight="medium" style={styles.tileLabel}>{label}</AppText>
  </View>;
}
function FilterPicker({label,value,options,onChange,expanded,onExpand,isRTL}:{
  label:string;value:string;options:Option[];onChange:(value:string)=>void;
  expanded:boolean;onExpand:()=>void;isRTL:boolean;
}){
  const selected=options.find(o=>o.id===value)?.label??options[0]?.label??"—";
  return <View style={styles.picker}>
    <AppText variant="caption" weight="semibold">{label}</AppText>
    <Pressable accessibilityRole="button" accessibilityState={{expanded}}
      onPress={onExpand} style={[styles.pickerTrigger,
        {flexDirection:isRTL?"row-reverse":"row"}]}>
      <AppText numberOfLines={1} variant="caption" style={{flex:1}}>{selected}</AppText>
      <Ionicons name={expanded?"chevron-up-outline":"chevron-down-outline"}
        size={17} color={colors.primary}/>
    </Pressable>
    {expanded?<ScrollView nestedScrollEnabled style={styles.pickerOptions}>
      {options.map(item=><Pressable key={item.id} accessibilityRole="button"
        accessibilityState={{selected:item.id===value}} style={[styles.pickerOption,
          value===item.id&&styles.pickerOptionSelected]}
        onPress={()=>onChange(item.id)}>
        <AppText variant="caption" weight={item.id===value?"semibold":"regular"}
          style={{color:item.id===value?colors.primary:colors.text}}>
          {item.label}</AppText>
      </Pressable>)}
    </ScrollView>:null}
  </View>;
}
export function RefereeCareerPanel({token,section}:{token:string;section:Section}){
  const {t,isRTL,language}=useLocale(),tr=(k:string)=>t(("rf3."+k) as never);
  const [period,setPeriod]=useState<RefereeCareerWindow>("all");
  const calendar:RefereeCareerCalendar=language==="en"?"gregory":"persian";
  const [result,setResult]=useState<RefereeCareerResponse|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState<string|null>(null),[retry,setRetry]=useState(0);
  const [query,setQuery]=useState("");
  const [competitionId,setCompetitionId]=useState("ALL");
  const [venueId,setVenueId]=useState("ALL");
  const [month,setMonth]=useState("ALL");
  const [outcome,setOutcome]=useState<RefereeHistoryOutcome>("ALL");
  const [expandedPicker,setExpandedPicker]=useState<string|null>(null);
  const [limit,setLimit]=useState(10);
  const currentToken=useRef(token);
  currentToken.current=token;

  useEffect(()=>{
    let active=true;
    setResult(null);setLoading(true);setError(null);
    void refereeCareerApi.career(token,period,calendar)
      .then(value=>{if(active){setResult(value);setError(null);}})
      .catch(e=>{if(active){
        setError(e instanceof Error?e.message:tr("statsLoadError"));setResult(null);
      }})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[token,period,calendar,retry,t]);
  useEffect(()=>{
    setQuery("");setCompetitionId("ALL");setVenueId("ALL");
    setMonth("ALL");setOutcome("ALL");setLimit(10);setExpandedPicker(null);
  },[token,period,calendar]);
  useEffect(()=>{setLimit(10);},[query,competitionId,venueId,month,outcome]);
  async function pdf(matchId:string){
    if(busy)return;
    const requestToken=token;
    setBusy(matchId);setError(null);
    try{
      const {token:ticket}=await refereeCareerApi.pdfTicket(requestToken,matchId);
      if(currentToken.current!==requestToken)return;
      await Linking.openURL(refereeCareerApi.pdfUrl(ticket));
    }catch(e){if(currentToken.current===requestToken)
      setError(e instanceof Error?e.message:tr("pdfError"));}
    finally{if(currentToken.current===requestToken)setBusy(null);}
  }

  const history=result?.history??[];
  const options=useMemo(()=>refereeHistoryOptions(history,language),[result?.history,language]);
  const filteredHistory=useMemo(()=>refereeHistoryFilter(history,{
    query,competitionId,venueId,month,outcome,language,
  }),[result?.history,query,competitionId,venueId,month,outcome,language]);
  const max=Math.max(1,...(result?.monthly??[]).map(m=>m.matches));
  const picker=(id:string,label:string,value:string,choices:Option[],onChange:(s:string)=>void)=>
    <FilterPicker key={id} label={label} value={value} options={choices}
      onChange={v=>{onChange(v);setExpandedPicker(null);}}
      expanded={expandedPicker===id} onExpand={()=>
        setExpandedPicker(current=>current===id?null:id)} isRTL={isRTL}/>;
  const baseOption=(text:string)=>[{id:"ALL",label:text}];
  return <View style={{gap:spacing.md}}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0}}
      contentContainerStyle={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
      {filters.map(filter=><Pressable accessibilityRole="button" key={filter}
        accessibilityState={{selected:period===filter}}
        style={[styles.filter,period===filter&&styles.active]}
        onPress={()=>setPeriod(filter)}>
        <AppText weight="semibold" variant="caption"
          style={period===filter?{color:colors.primary}:undefined}>
          {tr("filter."+filter)}</AppText>
      </Pressable>)}
    </ScrollView>
    {error?<Card style={{gap:spacing.sm}}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={tr("retry")} variant="secondary" onPress={()=>setRetry(v=>v+1)}/>
    </Card>:null}
    {loading?<DataLoadingState variant="dashboard" minHeight={250}/>:result?<>

      {section==="overview"?<>
        <View testID="referee-career-overview-kpis" style={styles.grid}>
          <Tile value={result.total} label={tr("verifiedMatches")}/>
          <Tile value={result.competitionsCount} label={tr("competitions")}/>
          <Tile value={result.finishedReports} label={tr("finishedReports")}/>
          <Tile value={result.submitted} label={tr("reportsSubmitted")}/>
        </View>
        <Card style={{gap:spacing.md}}>
          <AppText variant="bodyLarge" weight="bold">{tr("reportHealth")}</AppText>
          <View style={styles.grid}>
            <Tile value={result.draftReports} label={tr("draftReports")}/>
            <Tile value={result.correctionsRequested} label={tr("returnedReports")}/>
            <Tile value={result.awaitingReview} label={tr("awaitingReview")}/>
            <Tile value={result.submissionRate+"%"} label={tr("submissionRate")}/>
          </View>
          <AppText variant="caption" muted>{tr("reportHealthHint")}</AppText>
        </Card>
        <Card style={{gap:spacing.md}}>
          <AppText variant="bodyLarge" weight="bold">{tr("verifiedActivity")}</AppText>
          <View style={styles.grid}>
            <Tile value={result.events.GOAL} label={tr("goalsRecorded")}/>
            <Tile value={result.events.YELLOW_CARD} label={tr("yellowCards")}/>
            <Tile value={result.events.RED_CARD} label={tr("redCards")}/>
            <Tile value={result.events.FOUL} label={tr("foulsRecorded")}/>
          </View>
          <AppText variant="caption" muted>{tr("verifiedOnly")}</AppText>
        </Card>
      </>:null}

      {section==="history"?<>
        <Card testID="referee-career-history-filters" style={styles.filtersCard}>
          <TextField label={tr("historySearch")} value={query}
            placeholder={tr("historySearchPlaceholder")} onChangeText={setQuery}/>
          <View style={[styles.pickerGrid,{flexDirection:isRTL?"row-reverse":"row"}]}>
            {picker("competition",tr("competitionFilter"),competitionId,[
              ...baseOption(tr("allCompetitions")),
              ...options.competitions.map(([id,label])=>({id,label})),
            ],setCompetitionId)}
            {picker("venue",tr("venueFilter"),venueId,[
              ...baseOption(tr("allVenues")),
              ...options.venues.map(([id,label])=>({id,label})),
            ],setVenueId)}
            {picker("month",tr("monthFilter"),month,[
              ...baseOption(tr("allMonths")),
              ...options.months.map(id=>{
                const sample=history.find(row=>
                  refereeHistoryLocalMonth(row.finishedAt,language)===id)?.finishedAt;
                return {id,label:sample?
                  formatRefereeCalendarPeriod(new Date(sample),"month",language):id};
              }),
            ],setMonth)}
            {picker("outcome",tr("resultFilter"),outcome,[
              ...outcomes.map(id=>({id,label:tr("outcome."+id)})),
            ],v=>setOutcome(v as RefereeHistoryOutcome))}
          </View>
          <View style={[styles.actionRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <AppText variant="caption" muted style={{flex:1}}>
              {tr("matchesFound")}: {filteredHistory.length}</AppText>
            {(query||competitionId!=="ALL"||venueId!=="ALL"||month!=="ALL"||
              outcome!=="ALL")?<Button label={tr("clearFilters")} variant="ghost"
                onPress={()=>{setQuery("");setCompetitionId("ALL");setVenueId("ALL");
                  setMonth("ALL");setOutcome("ALL");setExpandedPicker(null);}}/>:null}
          </View>
          <AppText variant="caption" muted>{tr("historyVerifiedHint")}</AppText>
        </Card>
        {!filteredHistory.length?<Card>
          <AppText muted>{tr("noMatchesFound")}</AppText></Card>:null}
        {filteredHistory.slice(0,limit).map(item=><Card key={item.matchId}
          testID={"referee-history-"+item.matchId} style={{gap:spacing.sm}}>
          <AppText weight="bold">{item.homeName} VS {item.awayName}</AppText>
          <AppText variant="title" weight="bold" forceLtr>
            {item.homeScore} – {item.awayScore}</AppText>
          <AppText variant="caption" muted>{tr("outcome."+
            refereeHistoryOutcome(item))}</AppText>
          <AppText variant="caption" muted>{item.competitionName} · {item.venueName}</AppText>
          {item.finishedAt?<View style={styles.historyDateTime}>
            <AppText variant="caption" muted>
              {formatRefereeScheduleParts(item.finishedAt,language).date}</AppText>
            <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
              {formatRefereeScheduleParts(item.finishedAt,language).time}
            </AppText>
          </View>:null}
          <View style={styles.actions}>
            <Button label={tr("details")} variant="secondary" onPress={()=>router.push({
              pathname:"/competitions/[competitionId]/matches/[matchId]",
              params:{competitionId:item.competitionId,matchId:item.matchId}})}/>
            <Button label={tr("downloadPdf")} disabled={busy!==null}
              loading={busy===item.matchId} onPress={()=>void pdf(item.matchId)}/>
          </View>
        </Card>)}
        {filteredHistory.length>limit?<Button label={tr("showMoreHistory")}
          testID="referee-history-more" variant="secondary"
          onPress={()=>setLimit(v=>v+10)}/>:null}
      </>:null}

      {section==="performance"?<>
        <Card style={{gap:spacing.md}}>
          <AppText variant="bodyLarge" weight="bold">{tr("monthlyActivity")}</AppText>
          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chart}>
            {result.monthly.map(({month:monthKey,matches})=><View
              key={monthKey} style={styles.column}>
              <AppText variant="caption" weight="bold" style={{color:colors.primary}}>
                {matches}</AppText>
              <View style={[styles.bar,{height:Math.max(4,94*matches/max)}]}/>
              <AppText variant="caption" muted style={styles.month}>{monthKey.slice(5)}</AppText>
            </View>)}
          </ScrollView>
          <AppText variant="caption" muted>{tr("calendarHint")}</AppText>
          {isRTL&&result.calendar==="gregory"?<AppText variant="caption" muted>
            {tr("gregorianChartHint")}</AppText>:null}
        </Card>
        <View style={styles.grid}>
          <Tile value={result.submissionRate+"%"} label={tr("submissionRate")}/>
          <Tile value={result.onTimeRate+"%"} label={tr("onTimeRate")}/>
          <Tile value={result.averageSubmissionHours===null?"—":
            result.averageSubmissionHours+"h"} label={tr("averageSubmissionTime")}/>
          <Tile value={result.awaitingReview} label={tr("awaitingReview")}/>
          <Tile value={result.events.TIMEOUT} label={tr("timeouts")}/>
          <Tile value={result.events.INCIDENT} label={tr("incidents")}/>
        </View>
        <Card style={{gap:spacing.sm}}>
          <AppText variant="bodyLarge" weight="bold">{tr("competitionBreakdown")}</AppText>
          {!result.competitions.length?<AppText muted>{tr("noHistory")}</AppText>:null}
          {result.competitions.map(item=><View key={item.id} style={styles.line}>
            <AppText style={{flex:1}}>{item.name}</AppText>
            <AppText weight="semibold">{item.matches}</AppText>
          </View>)}
        </Card>
        <Card style={{gap:spacing.sm}}>
          <AppText variant="bodyLarge" weight="bold">{tr("venueBreakdown")}</AppText>
          {!result.venues.length?<AppText muted>{tr("noHistory")}</AppText>:null}
          {result.venues.map(item=><View key={item.id} style={styles.line}>
            <AppText style={{flex:1}}>{item.name}</AppText>
            <AppText weight="semibold">{item.matches}</AppText>
          </View>)}
          <AppText variant="caption" muted>{tr("verifiedOnly")}</AppText>
        </Card>
      </>:null}
    </>:null}
  </View>;
}
const styles=StyleSheet.create({
  grid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  tile:{flexGrow:1,flexBasis:"46%",minWidth:0,minHeight:112,alignItems:"center",
    justifyContent:"center",gap:spacing.sm,padding:spacing.md,
    backgroundColor:colors.surface,borderWidth:1,
    borderColor:colors.border,borderRadius:radius.md},
  tileLabel:{textAlign:"center",lineHeight:23,flexShrink:1},
  historyDateTime:{gap:spacing.xs,padding:spacing.sm,
    backgroundColor:colors.surfaceMuted,borderRadius:radius.md},
  filter:{minHeight:40,paddingHorizontal:spacing.md,justifyContent:"center",
    borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},
  active:{backgroundColor:colors.primarySoft,borderColor:colors.primary},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  actionRow:{alignItems:"center",gap:spacing.sm},
  filtersCard:{gap:spacing.md},
  pickerGrid:{flexWrap:"wrap",gap:spacing.sm},
  picker:{flexBasis:"47%",flexGrow:1,gap:spacing.xs,minWidth:0},
  pickerTrigger:{alignItems:"center",gap:spacing.xs,minHeight:44,
    paddingHorizontal:spacing.sm,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.md,backgroundColor:colors.surface},
  pickerOptions:{maxHeight:164,backgroundColor:colors.surfaceMuted,
    borderWidth:1,borderColor:colors.border,borderRadius:radius.md},
  pickerOption:{minHeight:40,justifyContent:"center",padding:spacing.sm},
  pickerOptionSelected:{backgroundColor:colors.primarySoft},
  chart:{gap:spacing.sm,minHeight:145,alignItems:"flex-end",paddingVertical:spacing.sm},
  column:{width:32,alignItems:"center",justifyContent:"flex-end",gap:4},
  bar:{width:"80%",backgroundColor:colors.primary,borderTopLeftRadius:4,borderTopRightRadius:4},
  month:{fontSize:10},
  line:{flexDirection:"row",alignItems:"center",gap:spacing.sm,
    borderBottomWidth:1,borderBottomColor:colors.border,paddingVertical:spacing.sm},
});
