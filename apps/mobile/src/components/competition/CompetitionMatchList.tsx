import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {CompetitionDto,CompetitionMatchDto} from "@leaguekick/contracts";
import {router} from "expo-router";
import {useMemo,useState} from "react";
import {Image,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {resolveMediaImageUrl} from "../../lib/api";
import {formatLocalDateTimeParts} from "../../lib/date-time";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Card} from "../ui/Card";

type MatchFilter="ALL"|"UPCOMING"|"LIVE"|"FINISHED";
const FILTERS:MatchFilter[]=["ALL","UPCOMING","LIVE","FINISHED"];
const done=(match:CompetitionMatchDto)=>match.status==="COMPLETED"||match.status==="CORRECTED";
const upcoming=(match:CompetitionMatchDto)=>
  ["SCHEDULED","UNSCHEDULED","POSTPONED"].includes(match.status);
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
function dateGroup(iso:string|null){
  if(!iso)return "unscheduled";
  const date=new Date(iso);
  if(!Number.isFinite(date.getTime()))return "unscheduled";
  const pieces=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kabul",
    year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const part=(type:string)=>pieces.find(x=>x.type===type)?.value??"";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function TeamLogo({uri}:{uri:string|null|undefined}){
  const url=resolveMediaImageUrl(uri);
  return <View style={styles.crest}>
    {url?<Image source={{uri:url}} resizeMode="cover" style={styles.crestImage}/>:
      <Ionicons name="shield-outline" color={colors.primary} size={24}/>}
  </View>;
}
export function CompetitionMatchList({competition,onlyResults=false}:{
  competition:CompetitionDto;onlyResults?:boolean;
}){
  const {t,language,isRTL}=useLocale();
  const [filter,setFilter]=useState<MatchFilter>("ALL");
  const teams=useMemo(()=>new Map(competition.teams.map(team=>[team.teamId,team])),[competition.teams]);
  const matches=useMemo(()=>order(competition.matches.filter(match=>
    onlyResults?done(match):filter==="ALL"?true:
      filter==="FINISHED"?done(match):
      filter==="LIVE"?match.status==="IN_PROGRESS":upcoming(match)
  )),[competition.matches,filter,onlyResults]);
  const groups=useMemo(()=>{
    const result:Array<{key:string;date:string;matches:CompetitionMatchDto[]}>= [];
    for(const match of matches){
      const key=dateGroup(match.startsAt);
      const label=match.startsAt?formatLocalDateTimeParts(match.startsAt,language).date:
        t("competition.matchList.unscheduled");
      const last=result[result.length-1];
      if(last?.key===key)last.matches.push(match);
      else result.push({key,date:label,matches:[match]});
    }
    return result;
  },[matches,language,t]);
  const open=(match:CompetitionMatchDto)=>router.push({
    pathname:"/competitions/[competitionId]/matches/[matchId]",
    params:{competitionId:competition.id,matchId:match.id},
  });
  return <View style={styles.container} testID={onlyResults?"competition-results-list":"competition-matches-list"}>
    {!onlyResults?<ScrollView testID="match-filter-rail" horizontal showsHorizontalScrollIndicator={false}
      style={styles.filterViewport}
      contentContainerStyle={[styles.filters,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {FILTERS.map(value=><Pressable key={value} testID={`match-filter-${value}`}
        accessibilityRole="tab" accessibilityState={{selected:value===filter}}
        onPress={()=>setFilter(value)}
        style={[styles.chip,filter===value&&styles.selected]}>
        <AppText variant="caption" weight="semibold" numberOfLines={1}
          style={{color:filter===value?"#FFFFFF":colors.text}}>
          {t(`competition.matchList.filter.${value}` as never)}
        </AppText>
      </Pressable>)}
    </ScrollView>:null}
    {matches.length===0?<Card style={styles.empty}>
      <Ionicons name="calendar-outline" size={30} color={colors.primary}/>
      <AppText muted style={{textAlign:"center"}}>
        {t(onlyResults?"competition.profile.noResults":"competition.matchList.empty")}
      </AppText>
    </Card>:null}
    {groups.map((group,index)=><View key={`${group.key}-${index}`} style={styles.dayGroup}>
      <View style={[styles.dayHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="calendar-clear-outline" size={17} color={colors.primary}/>
        <AppText weight="bold" variant="bodyLarge" style={{flex:1}}>{group.date}</AppText>
        <View style={styles.dayCount}>
          <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
            {group.matches.length}
          </AppText>
        </View>
      </View>
      {group.matches.map(match=>{
        const home=teams.get(match.homeTeamId??"");
        const away=teams.get(match.awayTeamId??"");
        const time=match.startsAt?formatLocalDateTimeParts(match.startsAt,language).time:
          t("competition.matchList.unscheduled");
        const score=match.homeScore!==null&&match.awayScore!==null;
        return <Pressable key={match.id} testID={`competition-match-${match.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${match.homeTeamName??t("competition.tbd")}, ${match.awayTeamName??t("competition.tbd")}`}
          onPress={()=>open(match)}
          style={({pressed})=>[styles.matchRow,pressed&&styles.pressed]}>
          <View style={[styles.rowInner,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <View style={styles.teams}>
              <View style={[styles.teamLine,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <TeamLogo uri={home?.logoUrl}/>
                <AppText weight="semibold" numberOfLines={1} style={styles.teamText}>
                  {match.homeTeamName??t("competition.tbd")}
                </AppText>
                {score?<AppText weight="bold" style={styles.score}>{match.homeScore}</AppText>:null}
              </View>
              <View style={[styles.teamLine,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <TeamLogo uri={away?.logoUrl}/>
                <AppText weight="semibold" numberOfLines={1} style={styles.teamText}>
                  {match.awayTeamName??t("competition.tbd")}
                </AppText>
                {score?<AppText weight="bold" style={styles.score}>{match.awayScore}</AppText>:null}
              </View>
            </View>
            <View style={styles.detailSide}>
              <AppText variant="caption" weight="semibold" numberOfLines={1} style={styles.time}>
                {done(match)?t("competition.matchList.fullTime"):match.status==="IN_PROGRESS"
                  ?t("competition.profile.liveBadge"):time}
              </AppText>
              <AppText variant="caption" muted numberOfLines={2} style={styles.sideText}>
                {match.groupName??t("competition.round",{number:match.roundNumber})}
              </AppText>
              <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={17} color={colors.primary}/>
            </View>
          </View>
          {match.status==="POSTPONED"||match.status==="CANCELLED"?
            <AppText variant="caption" muted>
              {t(`competition.matchStatus.${match.status}` as never)}
            </AppText>:null}
        </Pressable>;
      })}
    </View>)}
  </View>;
}
const styles=StyleSheet.create({
  container:{gap:spacing.md},
  filterViewport:{height:50,minHeight:50,maxHeight:50,flexGrow:0,flexShrink:0},
  filters:{gap:spacing.sm,alignItems:"center",paddingVertical:3},
  chip:{minHeight:44,paddingHorizontal:spacing.md,alignItems:"center",justifyContent:"center",
    borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  selected:{backgroundColor:colors.primary,borderColor:colors.primary},
  empty:{alignItems:"center",gap:spacing.md,padding:spacing.lg},
  dayGroup:{gap:spacing.xs},
  dayHeader:{minHeight:46,gap:spacing.sm,alignItems:"center",paddingHorizontal:spacing.sm,
    backgroundColor:colors.primarySoft,borderRadius:radius.md},
  dayCount:{minWidth:27,height:27,borderRadius:14,alignItems:"center",justifyContent:"center",
    backgroundColor:colors.surface,paddingHorizontal:5},
  matchRow:{borderRadius:radius.md,backgroundColor:colors.surface,borderWidth:1,
    borderColor:colors.border,padding:spacing.sm,gap:spacing.xs},
  rowInner:{gap:spacing.sm,alignItems:"stretch"},
  teams:{flex:1,gap:spacing.xs,minWidth:0},
  teamLine:{alignItems:"center",gap:spacing.sm,minHeight:43},
  teamText:{flex:1,minWidth:0},
  crest:{width:36,height:36,borderRadius:18,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center",overflow:"hidden"},
  crestImage:{width:"100%",height:"100%"},
  score:{width:25,textAlign:"center",color:colors.primary},
  detailSide:{width:108,borderLeftWidth:1,borderLeftColor:colors.border,
    alignItems:"center",justifyContent:"center",gap:5,paddingHorizontal:4},
  time:{textAlign:"center",color:colors.primary},
  sideText:{textAlign:"center"},
  pressed:{backgroundColor:colors.primarySoft},
});
