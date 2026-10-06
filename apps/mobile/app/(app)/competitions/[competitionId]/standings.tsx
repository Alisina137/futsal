import { colors, spacing } from "@leaguekick/design-tokens";
import type { CompetitionDto } from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { competitionApi } from "../../../../src/lib/api";
import { AppText } from "../../../../src/components/ui/AppText";
import { Card } from "../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../../src/components/ui/Screen";
import { useLocale } from "../../../../src/providers/LocaleProvider";

export default function CompetitionStandingsScreen(){
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

  if(loading)return <Screen showHeader><DataLoadingState variant="list" minHeight={500}/></Screen>;

  return <Screen showHeader>
    <AppText variant="title" weight="bold">{t("competition.standings")}</AppText>
    {competition&&competition.standings.length===0?<Card><AppText>{t("competition.noStandings")}</AppText></Card>:null}
    {competition?.standings.map((row)=><Pressable
      key={`${row.groupId??"all"}:${row.teamId}`}
      onPress={()=>router.push({pathname:"/teams/[teamId]",params:{teamId:row.teamId}})}
    >
      <Card>
        {row.groupName?<AppText variant="caption" weight="semibold" style={{color:colors.primary}}>{t("competition.group",{name:row.groupName})}</AppText>:null}
        <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
          <AppText variant="bodyLarge" weight="bold" style={{width:30}}>{row.position}</AppText>
          <AppText weight="bold" style={{flex:1}}>{row.teamName}</AppText>
          <AppText forceLtr>{t("competition.played")} {row.played}</AppText>
          <AppText forceLtr>{t("competition.goalDifference")} {row.goalDifference}</AppText>
          <AppText weight="bold" style={{color:colors.primary}} forceLtr>{t("competition.points")} {row.points}</AppText>
        </View>
      </Card>
    </Pressable>)}
  </Screen>;
}
