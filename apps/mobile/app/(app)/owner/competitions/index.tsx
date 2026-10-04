import { colors, spacing } from "@leaguekick/design-tokens";
import type { CompetitionListItemDto } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { competitionApi } from "../../../../src/lib/api";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { Screen } from "../../../../src/components/ui/Screen";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

export default function OwnerCompetitionListScreen(){
  const {session}=useAuth();
  const {t}=useLocale();
  const [items,setItems]=useState<CompetitionListItemDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!session)return;
    setLoading(true);setError(null);
    try{setItems((await competitionApi.ownerList(session.accessToken)).competitions);}
    catch{setError(t("competition.loadError"));}
    finally{setLoading(false);}
  },[session,t]);

  useEffect(()=>{void load();},[load]);

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("competition.ownerTitle")}</AppText>
      <AppText muted>{t("competition.ownerSubtitle")}</AppText>
    </View>
    <Button label={t("competition.create")} onPress={()=>router.push("/owner/competitions/create")}/>
    <Button label={t("common.retry")} onPress={()=>void load()} loading={loading} variant="secondary"/>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    {!loading&&items.length===0?<Card><AppText>{t("competition.ownerEmpty")}</AppText></Card>:null}

    {items.map((item)=><Pressable
      key={item.id}
      onPress={()=>router.push({pathname:"/owner/competitions/[competitionId]/manage",params:{competitionId:item.id}})}
    >
      <Card>
        <AppText variant="bodyLarge" weight="bold">{item.name}</AppText>
        <AppText muted>{t(`competition.format.${item.format}` as never)} · {t(`competition.status.${item.status}` as never)}</AppText>
        <AppText>{t("competition.acceptedTeams",{count:item.acceptedTeams,max:item.maxTeams})}</AppText>
      </Card>
    </Pressable>)}
  </Screen>;
}
