import { colors, spacing } from "@leaguekick/design-tokens";
import type { CompetitionDto } from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { competitionApi } from "../../../../src/lib/api";
import { AppText } from "../../../../src/components/ui/AppText";
import { Card } from "../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../../src/components/ui/Screen";
import { useLocale } from "../../../../src/providers/LocaleProvider";

export default function CompetitionStatsScreen(){
  const {competitionId}=useLocalSearchParams<{competitionId:string}>();
  const {t,isRTL}=useLocale();
  const [competition,setCompetition]=useState<CompetitionDto|null>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    if(!competitionId){setLoading(false);return;}
    setLoading(true);
    competitionApi.get(competitionId)
      .then(({competition})=>setCompetition(competition))
      .catch(()=>setCompetition(null))
      .finally(()=>setLoading(false));
  },[competitionId]);
  const stats=useMemo(()=>competition?.playerStats.slice().sort((a,b)=>b.goals-a.goals||b.assists-a.assists)??[],[competition]);

  if(loading)return <Screen showHeader><DataLoadingState variant="list" minHeight={500}/></Screen>;

  return <Screen showHeader>
    <AppText variant="title" weight="bold">{t("competition.stats")}</AppText>
    {competition&&stats.length===0?<Card><AppText>{t("competition.noStats")}</AppText></Card>:null}
    {stats.map((stat,index)=><Pressable key={stat.playerUserId} onPress={()=>router.push({pathname:"/players/[playerId]",params:{playerId:stat.playerUserId}})}>
      <Card>
        <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
          <AppText variant="bodyLarge" weight="bold" style={{color:colors.primary,width:28}}>{index+1}</AppText>
          <View style={{flex:1}}>
            <AppText weight="bold">{stat.publicDisplayName}</AppText>
            <AppText variant="caption" muted>{stat.teamName}</AppText>
          </View>
          <View style={{alignItems:isRTL?"flex-start":"flex-end"}}>
            <AppText forceLtr>{t("competition.goals")}: {stat.goals}</AppText>
            <AppText variant="caption" muted forceLtr>{t("competition.assists")}: {stat.assists}</AppText>
          </View>
        </View>
      </Card>
    </Pressable>)}
  </Screen>;
}
