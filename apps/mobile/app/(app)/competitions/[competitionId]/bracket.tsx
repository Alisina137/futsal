import { colors, spacing } from "@leaguekick/design-tokens";
import type { CompetitionDto } from "@leaguekick/contracts";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { competitionApi } from "../../../../src/lib/api";
import { AppText } from "../../../../src/components/ui/AppText";
import { Card } from "../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../../src/components/ui/Screen";
import { useLocale } from "../../../../src/providers/LocaleProvider";

export default function CompetitionBracketScreen(){
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
  const matches=useMemo(()=>competition?.matches.filter((m)=>m.stage==="KNOCKOUT").sort((a,b)=>b.roundNumber-a.roundNumber||a.slotNumber-b.slotNumber)??[],[competition]);

  if(loading)return <Screen showHeader><DataLoadingState variant="list" minHeight={500}/></Screen>;

  return <Screen showHeader>
    <AppText variant="title" weight="bold">{t("competition.bracket")}</AppText>
    {competition&&matches.length===0?<Card><AppText>{t("competition.noBracket")}</AppText></Card>:null}
    {matches.map((match)=><Card key={match.id} style={match.roundNumber===1?{borderColor:colors.primary,borderWidth:2}:undefined}>
      <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>{t("competition.round",{number:match.roundNumber})}</AppText>
      <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.md}}>
        <AppText weight={match.winnerTeamId===match.homeTeamId?"bold":"regular"} style={{flex:1}}>{match.homeTeamName??t("competition.tbd")}</AppText>
        <AppText variant="bodyLarge" weight="bold" forceLtr>{match.homeScore===null?"—":match.homeScore} : {match.awayScore===null?"—":match.awayScore}</AppText>
        <AppText weight={match.winnerTeamId===match.awayTeamId?"bold":"regular"} style={{flex:1,textAlign:isRTL?"left":"right"}}>{match.awayTeamName??t("competition.tbd")}</AppText>
      </View>
    </Card>)}
  </Screen>;
}
