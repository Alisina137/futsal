import { spacing } from "@leaguekick/design-tokens";
import type { CompetitionDto } from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { competitionApi } from "../../../../src/lib/api";
import { AppText } from "../../../../src/components/ui/AppText";
import { Card } from "../../../../src/components/ui/Card";
import { Screen } from "../../../../src/components/ui/Screen";
import { useLocale } from "../../../../src/providers/LocaleProvider";

export default function CompetitionTeamsScreen(){
  const {competitionId}=useLocalSearchParams<{competitionId:string}>();
  const {t,isRTL}=useLocale();
  const [competition,setCompetition]=useState<CompetitionDto|null>(null);
  useEffect(()=>{if(competitionId)competitionApi.get(competitionId).then(({competition})=>setCompetition(competition)).catch(()=>setCompetition(null));},[competitionId]);
  const teams=competition?.teams.filter((team)=>team.status==="ACCEPTED")??[];

  return <Screen showHeader>
    <AppText variant="title" weight="bold">{t("competition.teams")}</AppText>
    {teams.map((team)=><Pressable key={team.teamId} onPress={()=>router.push({pathname:"/teams/[teamId]",params:{teamId:team.teamId}})}>
      <Card>
        <View style={{flexDirection:isRTL?"row-reverse":"row",justifyContent:"space-between",gap:spacing.sm}}>
          <View style={{flex:1}}>
            <AppText weight="bold">{team.teamName}</AppText>
            {team.groupName?<AppText variant="caption" muted>{t("competition.group",{name:team.groupName})}</AppText>:null}
          </View>
          {team.seed?<AppText variant="caption" forceLtr>#{team.seed}</AppText>:null}
        </View>
      </Card>
    </Pressable>)}
  </Screen>;
}
