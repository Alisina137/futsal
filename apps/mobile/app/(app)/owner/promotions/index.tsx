import { colors, spacing } from "@leaguekick/design-tokens";
import type { PromotionDto } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { ownerApi } from "../../../../src/lib/api";
import { OwnerTopNav } from "../../../../src/components/owner/OwnerTopNav";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../../src/components/ui/Screen";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

export default function OwnerPromotionsScreen(){
  const {session}=useAuth();
  const {t}=useLocale();
  const [items,setItems]=useState<PromotionDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!session)return;
    setLoading(true);setError(null);
    try{setItems((await ownerApi.promotions(session.accessToken)).promotions);}
    catch{setError(t("ownerMarketing.loadPromotionsError"));}
    finally{setLoading(false);}
  },[session,t]);

  useEffect(()=>{void load();},[load]);

  async function close(id:string){
    if(!session)return;
    try{await ownerApi.closePromotion(session.accessToken,id);await load();}
    catch{setError(t("ownerMarketing.closePromotionError"));}
  }

  if(loading)return <Screen><OwnerTopNav/><DataLoadingState variant="list" minHeight={460}/></Screen>;

  return <Screen>
    <OwnerTopNav/>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("ownerMarketing.promotionsTitle")}</AppText>
      <AppText muted>{t("ownerMarketing.promotionsSubtitle")}</AppText>
    </View>
    <Button label={t("ownerMarketing.createPromotion")} onPress={()=>router.push("/owner/promotions/create")}/>
    <Button label={t("common.retry")} onPress={()=>void load()} loading={loading} variant="secondary"/>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    {!loading&&items.length===0?<Card><AppText>{t("ownerMarketing.noPromotions")}</AppText></Card>:null}
    {items.map((item)=><Card key={item.id}>
      <AppText variant="bodyLarge" weight="bold">{item.title}</AppText>
      <AppText muted>{item.areaName}</AppText>
      <AppText forceLtr>{item.startsAt}</AppText>
      <View style={{gap:spacing.xs}}>
        <AppText weight="bold" style={{color:colors.primary}}>{item.discountedPriceAfn} AFN</AppText>
        <AppText muted style={{textDecorationLine:"line-through"}}>{item.originalPriceAfn} AFN</AppText>
        <AppText>{item.discountPercent}% · {t(`ownerMarketing.promotionStatus.${item.status}` as never)}</AppText>
      </View>
      {item.note?<AppText>{item.note}</AppText>:null}
      {item.status==="ACTIVE"?<Button label={t("ownerMarketing.closePromotion")} onPress={()=>void close(item.id)} variant="secondary"/>:null}
    </Card>)}
  </Screen>;
}
