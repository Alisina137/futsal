import {colors,spacing} from "@leaguekick/design-tokens";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {useCallback,useState} from "react";
import {View} from "react-native";
import {ApiRequestError,teamGrowthApi,type TeamGrowthAnnouncement} from "../../../../src/lib/api";
import {formatCompetitionDateTime} from "../../../../src/lib/date-time";
import {useAuth} from "../../../../src/providers/AuthProvider";
import {useLocale} from "../../../../src/providers/LocaleProvider";
import {AppText} from "../../../../src/components/ui/AppText";
import {Button} from "../../../../src/components/ui/Button";
import {Card} from "../../../../src/components/ui/Card";
import {DataLoadingState} from "../../../../src/components/ui/DataLoadingState";
import {Screen} from "../../../../src/components/ui/Screen";

export default function PrivateTeamAnnouncements(){
  const {teamId}=useLocalSearchParams<{teamId:string}>();
  const {session}=useAuth(),{t,language}=useLocale();
  const [announcements,setAnnouncements]=useState<TeamGrowthAnnouncement[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
  const [refresh,setRefresh]=useState(0);
  useFocusEffect(useCallback(()=>{
    let active=true;
    if(!session||!teamId){setLoading(false);return()=>{active=false;};}
    setLoading(true);
    void teamGrowthApi.announcements(session.accessToken,teamId).then(data=>{
      if(active){setAnnouncements(data.announcements);setError(null);}
    }).catch(e=>{if(active)setError(e instanceof ApiRequestError?e.message:t("tm3.loadError"));})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[session?.accessToken,teamId,refresh,t]));
  return <Screen showHeader>
    <View style={{gap:spacing.sm}}>
      <AppText variant="title" weight="bold">{t("tm3.privateAnnouncements")}</AppText>
      <AppText variant="caption" muted>{t("tm3.memberOnly")}</AppText>
    </View>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary" onPress={()=>setRefresh(x=>x+1)}/></Card>:null}
    {loading?<DataLoadingState variant="list" minHeight={300}/>:<>
      {!announcements.length?<Card><AppText muted>{t("tm3.noAnnouncements")}</AppText></Card>:null}
      {announcements.map(item=><Card key={item.id}>
        <AppText weight="bold" variant="bodyLarge">{item.title}</AppText>
        <AppText variant="caption" muted>{formatCompetitionDateTime(item.createdAt,language)}</AppText>
        <AppText>{item.body}</AppText>
      </Card>)}
    </>}
    <Button label={t("teams.backToTeams")} variant="ghost" onPress={()=>router.back()}/>
  </Screen>;
}
