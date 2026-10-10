import { colors, spacing } from "@leaguekick/design-tokens";
import { router,useLocalSearchParams,useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { ApiRequestError,teamOperationsApi,type TeamMemberActivity,type TeamAvailability } from "../../../../src/lib/api";
import { formatCompetitionDateTime } from "../../../../src/lib/date-time";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../../src/components/ui/Screen";

export default function TeamActivityAttendanceScreen(){
  const {teamId}=useLocalSearchParams<{teamId:string}>();
  const {session}=useAuth(),{t,language}=useLocale();
  const [activities,setActivities]=useState<TeamMemberActivity[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null),[reload,setReload]=useState(0);
  useFocusEffect(useCallback(()=>{
    let active=true;
    if(!session||!teamId){setLoading(false);return()=>{active=false;};}
    setLoading(true);
    void teamOperationsApi.memberActivities(session.accessToken,teamId)
      .then(result=>{if(active){setActivities(result.activities);setError(null);}})
      .catch(e=>{if(active)setError(e instanceof ApiRequestError?e.message:t("tm2.loadFailed"));})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[session?.accessToken,teamId,reload,t]));
  async function respond(id:string,availability:TeamAvailability){
    if(!session||!teamId||busy)return;
    setBusy(id);setError(null);
    try{
      await teamOperationsApi.rsvp(session.accessToken,teamId,id,availability);
      setReload(x=>x+1);
    }catch(e){setError(e instanceof ApiRequestError?e.message:t("tm2.actionFailed"));}
    finally{setBusy(null);}
  }
  return <Screen showHeader>
    <View style={{gap:spacing.sm}}>
      <AppText variant="title" weight="bold">{t("tm2.memberSchedule")}</AppText>
      <AppText muted>{t("tm2.attendanceHint")}</AppText>
    </View>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary" onPress={()=>setReload(x=>x+1)}/></Card>:null}
    {loading?<DataLoadingState variant="list" minHeight={280}/>:<>
      {!activities.length?<Card><AppText muted>{t("tm2.noActivities")}</AppText></Card>:null}
      {activities.map(a=><Card key={a.id}>
        <AppText weight="bold">{a.title} · {t(`tm2.kind.${a.kind}` as never)}</AppText>
        <AppText variant="caption" muted>{formatCompetitionDateTime(a.startsAt,language)}</AppText>
        <AppText variant="caption" muted>{a.location??""}</AppText>
        {a.notes?<AppText>{a.notes}</AppText>:null}
        <AppText variant="caption" muted>{t("tm2.myResponse")}: {a.myAvailability?t(`tm2.rsvp.${a.myAvailability}` as never):t("tm2.noResponse")}</AppText>
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm}}>
          {(["AVAILABLE","UNAVAILABLE","UNSURE"] as const).map(v=><Button key={v} label={t(`tm2.rsvp.${v}` as never)}
            variant={a.myAvailability===v?"primary":"secondary"}
            disabled={!!busy||Date.parse(a.startsAt)<=Date.now()}
            loading={busy===a.id} onPress={()=>void respond(a.id,v)}/>)}
        </View>
      </Card>)}
    </>}
    <Button label={t("teams.backToTeams")} variant="ghost" onPress={()=>router.back()}/>
  </Screen>;
}
