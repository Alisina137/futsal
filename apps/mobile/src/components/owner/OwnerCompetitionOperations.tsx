import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {CompetitionDto} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useRef,useState} from "react";
import {View} from "react-native";
import {competitionApi} from "../../lib/api";
import {ownerCompetitionOperations} from "../../lib/owner-competition-management";
import {formatLocalDateTimeParts} from "../../lib/date-time";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";

/** Fetch one selected competition only. The compact list DTO intentionally
 * does not contain private team applications or referee assignments. */
export function OwnerCompetitionOperations({
  token,competitionId,
}:{token:string|undefined;competitionId:string}){
  const {t,isRTL,language}=useLocale();
  const [detail,setDetail]=useState<CompetitionDto|null>(null);
  const [loadedKey,setLoadedKey]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  const requestId=useRef(0);
  const key=`${token??""}:${competitionId}`;
  const visible=loadedKey===key?detail:null;

  const load=useCallback(async()=>{
    const request=++requestId.current;
    if(!token){setDetail(null);setLoadedKey(null);setLoading(false);return;}
    setLoading(true);setError(false);
    try{
      const response=await competitionApi.ownerGet(token,competitionId);
      if(request!==requestId.current)return;
      setDetail(response.competition);
      setLoadedKey(key);
    }catch{
      if(request===requestId.current)setError(true);
    }finally{if(request===requestId.current)setLoading(false);}
  },[competitionId,key,token]);
  useFocusEffect(useCallback(()=>{
    void load();
    return()=>{requestId.current+=1;};
  },[load]));

  const summary=visible?ownerCompetitionOperations(visible,Date.now()):null;
  const next=summary?.nextMatch;
  const at=next?.startsAt?formatLocalDateTimeParts(next.startsAt,language):null;
  const go=(tab:"TEAMS"|"FIXTURES"|"OVERVIEW")=>router.push({
    pathname:"/owner/competitions/[competitionId]/manage",
    params:{competitionId,tab},
  });

  return <Card testID="owner-phase5-operations" style={{gap:spacing.md,backgroundColor:colors.surfaceMuted}}>
    <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Ionicons name="shield-checkmark-outline" color={colors.primary} size={22}/>
      <View style={{flex:1}}>
        <AppText weight="bold">{t("owner.phase5.operations")}</AppText>
        <AppText variant="caption" muted>{t("owner.phase5.privateDetails")}</AppText>
      </View>
      <Button label={t("common.retry")} variant="ghost"
        onPress={()=>void load()} disabled={loading}/>
    </View>
    {loading&&!visible?<DataLoadingState variant="list" minHeight={160}/>:null}
    {error?<AppText style={{color:colors.danger}}>{t("owner.phase5.detailsError")}</AppText>:null}
    {summary?<View style={{gap:spacing.md}}>
      <View style={[styles.metrics,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.metric}>
          <AppText weight="bold" variant="bodyLarge" style={{color:colors.primary}}>
            {summary.pendingApplications}
          </AppText>
          <AppText variant="caption" muted>{t("owner.phase5.pendingApplications")}</AppText>
        </View>
        <View style={styles.metric}>
          <AppText weight="bold" variant="bodyLarge" style={{color:colors.primary}}>
            {summary.acceptedTeams}
          </AppText>
          <AppText variant="caption" muted>{t("owner.phase5.acceptedTeams")}</AppText>
        </View>
        <View style={styles.metric}>
          <AppText weight="bold" variant="bodyLarge" style={{color:colors.primary}}>
            {summary.unassignedFixtures}
          </AppText>
          <AppText variant="caption" muted>{t("owner.phase5.unassignedFixtures")}</AppText>
        </View>
      </View>
      {next?<View style={styles.next}>
        <AppText weight="semibold">{t("owner.phase5.nextMatch")}</AppText>
        <AppText numberOfLines={2}>{next.homeTeamName??"—"} – {next.awayTeamName??"—"}</AppText>
        {at?<AppText variant="caption" muted>{at.date} · {at.time}</AppText>:null}
      </View>:<AppText variant="caption" muted>{t("owner.phase5.noUpcomingMatches")}</AppText>}
      <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Button label={t("owner.phase5.reviewTeams")} style={{flex:1}}
          onPress={()=>go("TEAMS")}/>
        <Button label={t("owner.phase5.openFixtures")} variant="secondary" style={{flex:1}}
          onPress={()=>go("FIXTURES")}/>
      </View>
      <Button label={t("owner.dashboardSubnav.offlineTeams")} variant="ghost"
        onPress={()=>router.push("/owner/manual-teams")}/>
    </View>:null}
  </Card>;
}
const styles={
  row:{alignItems:"center",gap:spacing.sm},
  metrics:{gap:spacing.sm},
  metric:{flex:1,padding:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surface,
    alignItems:"center",gap:spacing.xs,minWidth:0},
  next:{gap:spacing.xs,padding:spacing.sm,borderRadius:radius.md,
    backgroundColor:colors.surface},
} as const;
