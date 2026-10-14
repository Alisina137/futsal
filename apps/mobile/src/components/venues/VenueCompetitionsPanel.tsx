import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {
  CompetitionDiscoveryItem,CompetitionDiscoveryQuery,PublicVenueDto,
  VenueMatchItem,
} from "@leaguekick/contracts";
import {router} from "expo-router";
import {useEffect,useRef,useState} from "react";
import {Image,Pressable,View} from "react-native";
import {competitionApi,resolveMediaImageUrl} from "../../lib/api";
import {formatLocalDateTime} from "../../lib/date-time";
import {useAuth} from "../../providers/AuthProvider";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";
import type {VenueCompetitionSub} from "./VenueDetailSections";

const PAGE_SIZE=12;
type MatchScope="upcoming"|"results";

function queryFor(venueId:string,sub:Exclude<VenueCompetitionSub,"matches">,page:number)
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
  const [matchScope,setMatchScope]=useState<MatchScope>("upcoming");
  const [matches,setMatches]=useState<VenueMatchItem[]>([]);
  const [matchPage,setMatchPage]=useState(1);
  const [matchHasMore,setMatchHasMore]=useState(false);
  const [matchLoading,setMatchLoading]=useState(true);
  const [matchLoadingMore,setMatchLoadingMore]=useState(false);
  const [matchError,setMatchError]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const epoch=useRef(0);
  const isMatches=sub==="matches";
  const canRegister=Boolean(session?.user.roles.includes("TEAM_MANAGER"));

  useEffect(()=>{
    // Each section and venue has its own read lifecycle; old requests cannot
    // add competitions or match information from a different venue.
    const request=++epoch.current;
    setCompetitions([]);setCompPage(1);setCompHasMore(false);
    setCompError(false);setCompLoading(!isMatches);setCompLoadingMore(false);
    setMatches([]);setMatchPage(1);setMatchHasMore(false);
    setMatchError(false);setMatchLoading(isMatches);setMatchLoadingMore(false);
    if(isMatches){
      void competitionApi.venueMatches(venue.id,matchScope,1).then(result=>{
        if(request!==epoch.current)return;
        setMatches(result.matches);setMatchPage(result.page);setMatchHasMore(result.hasMore);
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
  },[venue.id,sub,matchScope,refresh]);

  async function loadMoreCompetitions(){
    if(isMatches||compLoading||compLoadingMore||!compHasMore)return;
    const request=epoch.current;
    setCompLoadingMore(true);setCompError(false);
    try{
      const page=compPage+1;
      const result=await competitionApi.discover(queryFor(venue.id,sub,page));
      if(request!==epoch.current)return;
      setCompetitions(previous=>[...previous,...result.competitions.filter(item=>
        item.published&&item.venueId===venue.id&&!previous.some(old=>old.id===item.id))]);
      setCompPage(result.page);setCompHasMore(result.hasMore);
    }catch{if(request===epoch.current)setCompError(true);}
    finally{if(request===epoch.current)setCompLoadingMore(false);}
  }
  async function loadMoreMatches(){
    if(!isMatches||matchLoading||matchLoadingMore||!matchHasMore)return;
    const request=epoch.current;
    setMatchLoadingMore(true);setMatchError(false);
    try{
      const result=await competitionApi.venueMatches(venue.id,matchScope,matchPage+1);
      if(request!==epoch.current)return;
      setMatches(previous=>[...previous,...result.matches.filter(item=>
        !previous.some(old=>old.id===item.id))]);
      setMatchPage(result.page);setMatchHasMore(result.hasMore);
    }catch{if(request===epoch.current)setMatchError(true);}
    finally{if(request===epoch.current)setMatchLoadingMore(false);}
  }
  const retry=<Button variant="secondary" label={t("common.retry")}
    onPress={()=>setRefresh(value=>value+1)}/>;
  if(isMatches)return <View style={{gap:spacing.md}} testID="venue-competition-matches">
    <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
      {(["upcoming","results"] as const).map(value=>
        <Button key={value} label={tr("matchScope."+value)}
          style={{flex:1}} disabled={matchLoading}
          variant={matchScope===value?"primary":"secondary"}
          onPress={()=>setMatchScope(value)}/>)}
    </View>
    <AppText variant="caption" muted>{tr("matchesDescription")}</AppText>
    {matchLoading?<DataLoadingState variant="list" minHeight={170}/>:null}
    {matchError?<Card style={{gap:spacing.sm}}>
      <AppText style={{color:colors.danger}}>{tr("matchesLoadError")}</AppText>{retry}
    </Card>:null}
    {!matchLoading&&!matchError&&!matches.length?
      <Card><AppText muted>{tr("noMatches")}</AppText>{retry}</Card>:null}
    {matches.map(match=><Card key={match.id} testID={"venue-match-"+match.id}
      style={{gap:spacing.sm}}>
      <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.xs}}>
        <Ionicons name="football-outline" size={20} color={colors.primary}/>
        <AppText weight="semibold" style={{flex:1}}>{match.competitionName}</AppText>
        <AppText variant="caption" muted>{tr("matchStatus."+match.status)}</AppText>
      </View>
      {match.startsAt?<AppText variant="caption" muted>
        {formatLocalDateTime(match.startsAt,language,venue.timezone)}
      </AppText>:null}
      <AppText weight="bold" style={{textAlign:"center"}}>
        {(match.homeTeamName??tr("toBeDecided"))+"  "+
        (matchScope==="results"&&match.homeScore!==null&&match.awayScore!==null
          ?match.homeScore+" – "+match.awayScore:"vs")+"  "+
        (match.awayTeamName??tr("toBeDecided"))}
      </AppText>
      <Button variant="secondary" label={tr("viewMatch")}
        onPress={()=>router.push({
          pathname:"/competitions/[competitionId]/matches/[matchId]",
          params:{competitionId:match.competitionId,matchId:match.id},
        })}/>
    </Card>)}
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
    {compHasMore?<Button variant="secondary" label={tr("loadMore")}
      loading={compLoadingMore} disabled={compLoadingMore}
      onPress={()=>void loadMoreCompetitions()}/>:null}
  </View>;
}
