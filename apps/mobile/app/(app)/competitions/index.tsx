import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { CompetitionListItemDto } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { competitionApi } from "../../../src/lib/api";
import { formatLocalDateTimeParts } from "../../../src/lib/date-time";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function CompetitionListScreen(){
  const {t,isRTL,language}=useLocale();
  const [items,setItems]=useState<CompetitionListItemDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try{setItems((await competitionApi.list()).competitions);}
    catch{setError(t("competition.loadError"));}
    finally{setLoading(false);}
  },[t]);

  useEffect(()=>{void load();},[load]);

  if(loading)return <Screen showHeader><DataLoadingState variant="list" minHeight={460}/></Screen>;

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("competition.title")}</AppText>
      <AppText muted>{t("competition.subtitle")}</AppText>
    </View>

    <Button label={t("common.retry")} onPress={()=>void load()} loading={loading} variant="secondary"/>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    {!loading&&items.length===0?<Card><AppText>{t("competition.empty")}</AppText></Card>:null}

    {items.map((item)=>{
      const start=item.startsAt?formatLocalDateTimeParts(item.startsAt,language):null;
      return <Pressable
        key={item.id}
        onPress={()=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId:item.id}})}
        style={({pressed})=>pressed?{opacity:0.82}:undefined}
      >
        <Card>
          <View style={{gap:spacing.sm}}>
            <View style={{flexDirection:isRTL?"row-reverse":"row",justifyContent:"space-between",gap:spacing.sm,alignItems:"flex-start"}}>
              <View style={{flex:1,gap:2}}>
                <AppText variant="bodyLarge" weight="bold">{item.name}</AppText>
                <AppText muted>{item.venueName}</AppText>
              </View>
              <View style={{paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,borderRadius:radius.pill,backgroundColor:colors.primarySoft}}>
                <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
                  {t(`competition.format.${item.format}` as never)}
                </AppText>
              </View>
            </View>
            <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
              {t(`competition.status.${item.status}` as never)}
            </AppText>
            <AppText>{t("competition.acceptedTeams",{count:item.acceptedTeams,max:item.maxTeams})}</AppText>
            {start?<View style={{gap:2}}>
              <AppText variant="caption" muted>{start.date}</AppText>
              <AppText variant="caption" muted>{start.time}</AppText>
            </View>:null}
          </View>
        </Card>
      </Pressable>;
    })}
  </Screen>;
}
