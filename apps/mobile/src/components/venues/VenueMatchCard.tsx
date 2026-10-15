import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {VenueMatchItem} from "@leaguekick/contracts";
import {router} from "expo-router";
import {Image,Pressable,StyleSheet,View} from "react-native";
import {resolveMediaImageUrl} from "../../lib/api";
import {formatLocalDateTimeParts} from "../../lib/date-time";
import {venueMatchResultEmphasis} from "../../lib/venue-match-filters";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Card} from "../ui/Card";

function TeamLogo({url}:{url:string|null}){
  const resolved=resolveMediaImageUrl(url);
  return <View style={styles.logoFrame}>
    {resolved?<Image source={{uri:resolved}} resizeMode="contain" style={styles.logo}/>:
      <Ionicons name="shield-outline" color={colors.primary} size={25}/>}
  </View>;
}

type FixtureMatch={
  id:string;competitionId:string;competitionName:string;startsAt:string|null;
  homeTeamName:string|null;awayTeamName:string|null;homeLogoUrl?:string|null;awayLogoUrl?:string|null;
  homeScore:number|null;awayScore:number|null;status:string;
};
function FixtureMatchCard({match,scope,timeZone,testID,statusLabel,missingScoreLabel}:{
  match:FixtureMatch;scope:"upcoming"|"results";timeZone:string;
  testID:string;statusLabel?:string;missingScoreLabel?:string;
}){
  const {t,language,isRTL}=useLocale();
  const tr=(key:string)=>t(("vd4."+key) as never);
  const finished=scope==="results"&&
    (match.status==="COMPLETED"||match.status==="CORRECTED");
  const emph=venueMatchResultEmphasis(match.status,match.homeScore,match.awayScore);
  const date=match.startsAt?formatLocalDateTimeParts(match.startsAt,language,timeZone):null;
  const teamWeight=(side:"home"|"away")=>
    finished&&emph[side]==="winner"?"bold" as const:"medium" as const;
  const teamColor=(side:"home"|"away")=>
    finished&&emph[side]==="loser"?colors.textMuted:colors.text;
  const open=()=>router.push({
    pathname:"/competitions/[competitionId]/matches/[matchId]",
    params:{competitionId:match.competitionId,matchId:match.id},
  });
  return <Pressable testID={testID}
    accessibilityRole="button"
    accessibilityLabel={[
      match.competitionName,match.homeTeamName??tr("toBeDecided"),
      finished&&match.homeScore!==null&&match.awayScore!==null
        ?match.homeScore+" – "+match.awayScore:"versus",
      match.awayTeamName??tr("toBeDecided"),
    ].join(", ")}
    onPress={open} style={({pressed})=>pressed?{opacity:.8}:undefined}>
    <Card style={styles.card}>
      <View style={[styles.top,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="trophy-outline" size={17} color={colors.primary}/>
        <AppText variant="caption" weight="semibold" numberOfLines={1}
          style={styles.competitionName}>{match.competitionName}</AppText>
        <View style={[styles.status,match.status==="IN_PROGRESS"&&styles.liveStatus]}>
          <AppText variant="caption" weight="bold"
            style={{color:match.status==="IN_PROGRESS"?"#B91C1C":colors.primary}}>
            {statusLabel??tr("matchStatus."+match.status)}
          </AppText>
        </View>
      </View>
      <View style={styles.divider}/>
      <View style={[styles.fixture,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.team}>
          <TeamLogo url={match.homeLogoUrl??null}/>
          <AppText numberOfLines={2} weight={teamWeight("home")}
            style={[styles.teamName,{color:teamColor("home")}]}>{match.homeTeamName??tr("toBeDecided")}</AppText>
        </View>
        <View style={styles.center}>
          {finished&&match.homeScore!==null&&match.awayScore!==null?
            <AppText weight="bold" style={styles.score} forceLtr>
              {match.homeScore}  –  {match.awayScore}
            </AppText>
          :finished&&missingScoreLabel?
            <AppText variant="caption" muted weight="semibold" style={styles.date}>
              {missingScoreLabel}
            </AppText>
          :<AppText weight="bold" style={styles.vs}>VS</AppText>}
          {date?<AppText variant="caption" muted style={styles.date}>{date.time}</AppText>:null}
        </View>
        <View style={styles.team}>
          <TeamLogo url={match.awayLogoUrl??null}/>
          <AppText numberOfLines={2} weight={teamWeight("away")}
            style={[styles.teamName,{color:teamColor("away")}]}>{match.awayTeamName??tr("toBeDecided")}</AppText>
        </View>
      </View>
      <View style={[styles.footer,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="calendar-outline" size={16} color={colors.textMuted}/>
        <AppText variant="caption" muted style={{flex:1}}>{date?.date??"—"}</AppText>
        <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
          {tr("viewMatch")}
        </AppText>
        <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={17} color={colors.primary}/>
      </View>
    </Card>
  </Pressable>;
}
/** One card layout for the venue and team match feeds. A source-specific
 * adapter provides team names and translated status without duplicating UI. */
export function VenueMatchCard({match,scope,timeZone}:{
  match:VenueMatchItem;scope:"upcoming"|"results";timeZone:string;
}){
  return <FixtureMatchCard match={match} scope={scope} timeZone={timeZone}
    testID={"venue-match-"+match.id}/>;
}
export function TeamMatchCard({match,scope,timeZone,statusLabel,missingScoreLabel}:{
  match:FixtureMatch;scope:"upcoming"|"results";timeZone:string;
  statusLabel:string;missingScoreLabel:string;
}){
  return <FixtureMatchCard match={match} scope={scope} timeZone={timeZone}
    testID={"team-match-"+match.id} statusLabel={statusLabel}
    missingScoreLabel={missingScoreLabel}/>;
}
const styles=StyleSheet.create({
  card:{gap:spacing.sm,borderColor:colors.border},
  top:{alignItems:"center",gap:spacing.xs},
  competitionName:{flex:1,minWidth:0,color:colors.text},
  status:{paddingVertical:4,paddingHorizontal:spacing.sm,
    borderRadius:radius.pill,backgroundColor:colors.primarySoft},
  liveStatus:{backgroundColor:"#FEE2E2"},
  divider:{height:1,backgroundColor:colors.border},
  fixture:{alignItems:"center",gap:spacing.xs,paddingVertical:spacing.sm},
  team:{flex:1,minWidth:0,alignItems:"center",gap:spacing.sm},
  logoFrame:{width:52,height:52,borderRadius:radius.md,
    backgroundColor:colors.surfaceMuted,borderWidth:1,borderColor:colors.border,
    alignItems:"center",justifyContent:"center"},
  logo:{width:43,height:43},
  teamName:{textAlign:"center",minHeight:36,fontSize:13},
  center:{width:104,alignItems:"center",justifyContent:"center",gap:spacing.xs},
  score:{fontSize:23,color:colors.text,textAlign:"center"},
  vs:{fontSize:18,color:colors.primary,textAlign:"center"},
  date:{textAlign:"center",fontSize:11},
  footer:{alignItems:"center",gap:spacing.xs,paddingTop:spacing.sm,
    borderTopColor:colors.border,borderTopWidth:1},
});
