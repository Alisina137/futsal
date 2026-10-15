import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {
  CompetitionDiscoveryItem,CompetitionDiscoveryQuery,PublicVenueDto,
  VenueMatchItem,
} from "@leaguekick/contracts";
import {router} from "expo-router";
import {useEffect,useRef,useState} from "react";
import {Image,Pressable,ScrollView,View} from "react-native";
import {competitionApi,resolveMediaImageUrl} from "../../lib/api";
import {formatLocalDateTime} from "../../lib/date-time";
import {emptyVenueMatchFilters,emptyVenueMatchFacets,type VenueMatchFilters} from "../../lib/venue-match-filters";
import {VenueMatchSelect} from "./VenueMatchSelect";
import {VenueMatchCard} from "./VenueMatchCard";
import {useAuth} from "../../providers/AuthProvider";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";
import type {VenueCompetitionSub} from "./VenueDetailSections";

const PAGE_SIZE=12;
type MatchScope="upcoming"|"results";

function queryFor(venueId:string,sub:VenueCompetitionSub,page:number)
  :CompetitionDiscoveryQuery{
  const common:CompetitionDiscoveryQuery={
    venueId,q:"",province:"",city:"",fee:"any",sort:"starting",
    scope:"all",phase:"all",page,limit:PAGE_SIZE,
  };
  if(sub==="registration")return {...common,scope:"registration",sort:"closing"};
  if(sub==="upcoming")return {...common,phase:"upcoming"};
  if(sub==="live")return {...common,status:"IN_PROGRESS"};
  return {...common,phase:"history"};
}

function viewCompetition(id:string,tab?:"MATCHES"|"STANDINGS"|"TEAMS",focusRegistration?:boolean){
  router.push({pathname:"/competitions/[competitionId]",params:{
    competitionId:id,...(tab?{tab}:{}),
    ...(focusRegistration?{focusRegistration:"1"}:{}),
  }});
}

export function VenueCompetitionsPanel({venue,sub}:{venue:PublicVenueDto;sub:VenueCompetitionSub}){
  const {t,isRTL,language}=useLocale();
  const {session}=useAuth();
  const tr=(key:string)=>t(("vd4."+key) as never);
  const [competitions,setCompetitions]=useState<CompetitionDiscoveryItem[]>([]);
  const [compPage,setCompPage]=useState(1);
  const [compHasMore,setCompHasMore]=useState(false);
  const [compLoading,setCompLoading]=useState(true);
  const [compLoadingMore,setCompLoadingMore]=useState(false);
  const [compError,setCompError]=useState(false);
  const [compMoreError,setCompMoreError]=useState(false);
  const [matchScope,setMatchScope]=useState<MatchScope>("upcoming");
  const [matchFilters,setMatchFilters]=useState<VenueMatchFilters>(emptyVenueMatchFilters);
  const [matchFacets,setMatchFacets]=useState(emptyVenueMatchFacets);
  const [matchTotal,setMatchTotal]=useState(0);
  const selectedMatchQuery={
    ...(matchFilters.competitionId?{competitionId:matchFilters.competitionId}:{}),
    ...(matchFilters.teamId?{teamId:matchFilters.teamId}:{}),
    ...(matchFilters.year?{year:Number(matchFilters.year)}:{}),
    ...(matchFilters.month?{month:Number(matchFilters.month)}:{}),
    ...(matchFilters.week?{week:Number(matchFilters.week)}:{}),
  };
  function changeMatchFilter(key:keyof VenueMatchFilters,value:string){
    setMatchFilters(current=>({...current,[key]:value}));
  }
  function selectMatchScope(next:MatchScope){
    if(next===matchScope)return;
    setMatchScope(next);setMatchFilters(emptyVenueMatchFilters);
  }
  const [matches,setMatches]=useState<VenueMatchItem[]>([]);
  const [matchPage,setMatchPage]=useState(1);
  const [matchHasMore,setMatchHasMore]=useState(false);
  const [matchLoading,setMatchLoading]=useState(true);
  const [matchLoadingMore,setMatchLoadingMore]=useState(false);
  const [matchError,setMatchError]=useState(false);
  const [matchMoreError,setMatchMoreError]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const epoch=useRef(0);
  const isMatches=sub==="matches";
  const canRegister=Boolean(session?.user.roles.includes("TEAM_MANAGER"));

  useEffect(()=>{
    // Each section and venue has its own read lifecycle; old requests cannot
    // add competitions or match information from a different venue.
    const request=++epoch.current;
    setCompetitions([]);setCompPage(1);setCompHasMore(false);
    setCompError(false);setCompMoreError(false);
    setCompLoading(!isMatches);setCompLoadingMore(false);
    setMatches([]);setMatchPage(1);setMatchHasMore(false);setMatchTotal(0);
    setMatchError(false);setMatchMoreError(false);
    setMatchLoading(isMatches);setMatchLoadingMore(false);
    if(isMatches){
      void competitionApi.venueMatches(venue.id,matchScope,1,selectedMatchQuery).then(result=>{
        if(request!==epoch.current)return;
        setMatches(result.matches);setMatchPage(result.page);setMatchHasMore(result.hasMore);
        setMatchFacets(result.facets);setMatchTotal(result.total);
      }).catch(()=>{if(request===epoch.current)setMatchError(true);})
        .finally(()=>{if(request===epoch.current)setMatchLoading(false);});
    }else{
      void competitionApi.discover(queryFor(venue.id,sub,1)).then(result=>{
        if(request!==epoch.current)return;
        setCompetitions(result.competitions.filter(item=>item.published&&item.venueId===venue.id));
        setCompPage(result.page);setCompHasMore(result.hasMore);
      }).catch(()=>{if(request===epoch.current)setCompError(true);})
        .finally(()=>{if(request===epoch.current)setCompLoading(false);});
    }
    return()=>{epoch.current+=1;};
  },[venue.id,sub,matchScope,refresh,matchFilters.competitionId,matchFilters.teamId,
    matchFilters.year,matchFilters.month,matchFilters.week]);

  async function loadMoreCompetitions(){
    if(isMatches||compLoading||compLoadingMore||!compHasMore)return;
    const request=epoch.current;
    setCompLoadingMore(true);setCompMoreError(false);
    try{
      const page=compPage+1;
      const result=await competitionApi.discover(queryFor(venue.id,sub,page));
      if(request!==epoch.current)return;
      setCompetitions(previous=>[...previous,...result.competitions.filter(item=>
        item.published&&item.venueId===venue.id&&!previous.some(old=>old.id===item.id))]);
      setCompPage(result.page);setCompHasMore(result.hasMore);
    }catch{if(request===epoch.current)setCompMoreError(true);}
    finally{if(request===epoch.current)setCompLoadingMore(false);}
  }
  async function loadMoreMatches(){
    if(!isMatches||matchLoading||matchLoadingMore||!matchHasMore)return;
    const request=epoch.current;
    setMatchLoadingMore(true);setMatchMoreError(false);
    try{
      const result=await competitionApi.venueMatches(venue.id,matchScope,matchPage+1,selectedMatchQuery);
      if(request!==epoch.current)return;
      setMatches(previous=>[...previous,...result.matches.filter(item=>
        !previous.some(old=>old.id===item.id))]);
      setMatchPage(result.page);setMatchHasMore(result.hasMore);
    }catch{if(request===epoch.current)setMatchMoreError(true);}
    finally{if(request===epoch.current)setMatchLoadingMore(false);}
  }
  const retry=<Button variant="secondary" label={t("common.retry")}
    onPress={()=>setRefresh(value=>value+1)}/>;
  if(isMatches)return <View style={{gap:spacing.md}} testID="venue-competition-matches">
    <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
      {(["upcoming","results"] as const).map(value=>
        <Button key={value} label={tr("matchScope."+value)}
          style={{flex:1}}
          variant={matchScope===value?"primary":"secondary"}
          onPress={()=>selectMatchScope(value)}/>)}
    </View>
    <AppText variant="caption" muted>{tr("matchesDescription")}</AppText>
    {/* One scrollable five-column row, never five vertically stacked filters. */}
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      testID="venue-match-filter-rail" style={{flexGrow:0}}
      contentContainerStyle={{gap:spacing.sm,flexDirection:isRTL?"row-reverse":"row"}}>
      <VenueMatchSelect label={tr("matchesFilter.competition")}
        testID="venue-match-filter-competition" icon="trophy-outline"
        value={matchFilters.competitionId} allLabel={tr("matchesFilter.all")}
        options={matchFacets.competitions.map(item=>({value:item.id,label:item.name}))}
        onSelect={next=>changeMatchFilter("competitionId",next)}/>
      <VenueMatchSelect label={tr("matchesFilter.team")}
        testID="venue-match-filter-team" icon="shirt-outline"
        value={matchFilters.teamId} allLabel={tr("matchesFilter.all")}
        options={matchFacets.teams.map(item=>({value:item.id,label:item.name}))}
        onSelect={next=>changeMatchFilter("teamId",next)}/>
      <VenueMatchSelect label={tr("matchesFilter.year")}
        testID="venue-match-filter-year" icon="calendar-outline"
        value={matchFilters.year} allLabel={tr("matchesFilter.all")}
        options={matchFacets.years.map(year=>({value:String(year),label:String(year)}))}
        onSelect={next=>changeMatchFilter("year",next)}/>
      <VenueMatchSelect label={tr("matchesFilter.month")}
        testID="venue-match-filter-month" icon="calendar-number-outline"
        value={matchFilters.month} allLabel={tr("matchesFilter.all")}
        options={matchFacets.months.map(month=>({value:String(month),
          label:new Intl.DateTimeFormat(language==="en"?"en-GB":language,{
            month:"long",timeZone:"UTC",calendar:"gregory",
          }).format(new Date(Date.UTC(2024,month-1,1)))}))}
        onSelect={next=>changeMatchFilter("month",next)}/>
      <VenueMatchSelect label={tr("matchesFilter.week")}
        testID="venue-match-filter-week" icon="calendar-clear-outline"
        value={matchFilters.week} allLabel={tr("matchesFilter.all")}
        options={matchFacets.weeks.map(week=>({value:String(week),
          label:t("vd4.matchesFilter.weekNumber",{number:week})}))}
        onSelect={next=>changeMatchFilter("week",next)}/>
    </ScrollView>
    <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
      <AppText variant="caption" muted style={{flex:1}}>
        {t("vd4.matchesFilter.count",{shown:matches.length,total:matchTotal})}
      </AppText>
      {Object.values(matchFilters).some(Boolean)?<Button
        label={tr("matchesFilter.clear")} variant="secondary"
        onPress={()=>setMatchFilters(emptyVenueMatchFilters)}/>:null}
    </View>
    {matchLoading?<DataLoadingState variant="list" minHeight={170}/>:null}
    {matchError?<Card style={{gap:spacing.sm}}>
      <AppText style={{color:colors.danger}}>{tr("matchesLoadError")}</AppText>{retry}
    </Card>:null}
    {!matchLoading&&!matchError&&!matches.length?
      <Card><AppText muted>{tr("noMatches")}</AppText>{retry}</Card>:null}
    {matches.map(match=><VenueMatchCard key={match.id}
      match={match} scope={matchScope} timeZone={venue.timezone}/>)}
    {matchMoreError?<AppText variant="caption" style={{color:colors.danger}}>
      {tr("matchesLoadError")}</AppText>:null}
    {matchHasMore?<Button variant="secondary" label={tr("loadMore")}
      loading={matchLoadingMore} disabled={matchLoadingMore}
      onPress={()=>void loadMoreMatches()}/>:null}
  </View>;

  return <View style={{gap:spacing.md}} testID={"venue-competitions-"+sub}>
    {sub==="registration"?<AppText variant="caption" muted>
      {tr("registrationDescription")}</AppText>:null}
    {compLoading?<DataLoadingState variant="list" minHeight={210}/>:null}
    {compError?<Card style={{gap:spacing.sm}}>
      <AppText style={{color:colors.danger}}>{tr("competitionsLoadError")}</AppText>{retry}
    </Card>:null}
    {!compLoading&&!compError&&!competitions.length?
      <Card style={{gap:spacing.sm}}><AppText muted>{tr("noCompetitions")}</AppText>{retry}</Card>:null}
    {competitions.map(item=>{
      const image=resolveMediaImageUrl(item.coverImageUrl??item.logoUrl);
      const openRegistration=item.status==="REGISTRATION_OPEN"&&
        item.acceptedTeams<item.maxTeams&&
        (!item.registrationClosesAt||Date.parse(item.registrationClosesAt)>Date.now());
      const buttonLabel=sub==="registration"&&openRegistration&&canRegister
        ?tr("register"):tr("viewCompetition");
      return <Card key={item.id} testID={"venue-competition-"+item.id}
        style={{gap:spacing.sm}}>
        {/* Keep the square artwork on the physical top-left; labels sit beside it. */}
        <View style={{flexDirection:"row",alignItems:"flex-start",gap:spacing.sm}}>
          {image?<Image source={{uri:image}} resizeMode="cover"
            style={{width:88,height:88,borderRadius:radius.md,
              backgroundColor:colors.surfaceMuted}}/>
            :<View style={{width:88,height:88,borderRadius:radius.md,
              backgroundColor:colors.primarySoft,justifyContent:"center",alignItems:"center"}}>
              <Ionicons name="trophy-outline" size={34} color={colors.primary}/>
            </View>}
          <View style={{flex:1,gap:spacing.xs}}>
            <AppText variant="bodyLarge" weight="bold" numberOfLines={2}>{item.name}</AppText>
            <AppText variant="caption" muted numberOfLines={2}>{item.venueName}</AppText>
          </View>
        </View>
        <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.xs,alignItems:"center"}}>
          <Ionicons name="flag-outline" size={17} color={colors.primary}/>
          <AppText variant="caption" weight="medium" style={{flex:1}}>
            {tr("status."+item.status)}
          </AppText>
        </View>
        {item.startsAt?<AppText variant="caption" muted>
          {tr("starts")+": "+formatLocalDateTime(item.startsAt,language,venue.timezone)}
        </AppText>:null}
        {item.registrationClosesAt&&sub==="registration"?<AppText variant="caption" muted>
          {tr("registrationDeadline")+": "+
            formatLocalDateTime(item.registrationClosesAt,language,venue.timezone)}
        </AppText>:null}
        <AppText variant="caption" muted>
          {item.acceptedTeams+" / "+item.maxTeams+" "+tr("teams")+" · "+
            item.registrationFeeAfn+" AFN"}
        </AppText>
        <Button variant="secondary" label={buttonLabel}
          onPress={()=>sub==="registration"&&openRegistration&&canRegister
            ?viewCompetition(item.id,"TEAMS",true)
            :sub==="live"?viewCompetition(item.id,"STANDINGS")
            :sub==="completed"?viewCompetition(item.id,"MATCHES")
            :viewCompetition(item.id)}/>
      </Card>;
    })}
    {compMoreError?<AppText variant="caption" style={{color:colors.danger}}>
      {tr("competitionsLoadError")}</AppText>:null}
    {compHasMore?<Button variant="secondary" label={tr("loadMore")}
      loading={compLoadingMore} disabled={compLoadingMore}
      onPress={()=>void loadMoreCompetitions()}/>:null}
  </View>;
}
