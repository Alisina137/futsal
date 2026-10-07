import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { PromotionDto } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { ApiRequestError, ownerApi } from "../../../../src/lib/api";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../../src/components/ui/Screen";
import { TextField } from "../../../../src/components/ui/TextField";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

type CtaType="NONE"|"VENUE"|"PROMOTION";

export default function CreatePostScreen(){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const [body,setBody]=useState("");
  const [imageUrl,setImageUrl]=useState("");
  const [ctaType,setCtaType]=useState<CtaType>("NONE");
  const [promotionId,setPromotionId]=useState<string|null>(null);
  const [promotions,setPromotions]=useState<PromotionDto[]>([]);
  const [notifyFollowers,setNotifyFollowers]=useState(false);
  const [busy,setBusy]=useState(false);
  const [promotionsLoading,setPromotionsLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    if(!session){setPromotionsLoading(false);return;}
    setPromotionsLoading(true);
    ownerApi.promotions(session.accessToken)
      .then((result)=>setPromotions(result.promotions.filter((item)=>item.status==="ACTIVE")))
      .catch(()=>setPromotions([]))
      .finally(()=>setPromotionsLoading(false));
  },[session]);

  async function submit(){
    if(!session||body.trim().length===0)return;
    setBusy(true);setError(null);
    try{
      await ownerApi.createPost(session.accessToken,{
        body:body.trim(),
        imageUrl,
        ctaType,
        ctaTargetId:ctaType==="PROMOTION"?promotionId:null,
        notifyFollowers,
      });
      router.replace("/owner/posts");
    }catch(cause){
      if(cause instanceof ApiRequestError&&cause.code==="INVALID_POST_CTA")setError(t("ownerMarketing.invalidPostCta"));
      else if(cause instanceof ApiRequestError&&cause.code==="SUBSCRIPTION_REQUIRED")setError(t("ownerMarketing.entitlementRequired"));
      else setError(t("ownerMarketing.createPostError"));
    }finally{setBusy(false);}
  }

  const canSubmit=body.trim().length>0&&(ctaType!=="PROMOTION"||promotionId!==null)&&!busy;

  return <Screen embedded>
    <AppText variant="title" weight="bold">{t("ownerMarketing.createPost")}</AppText>
    <AppText muted>{t("ownerMarketing.createPostBody")}</AppText>

    <TextField label={t("ownerMarketing.postBody")} value={body} onChangeText={setBody} multiline/>
    <TextField label={t("ownerMarketing.imageUrl")} value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" forceLtr hint="https://..."/>

    <Card>
      <AppText weight="bold">{t("ownerMarketing.cta")}</AppText>
      <View style={{flexDirection:isRTL?"row-reverse":"row",flexWrap:"wrap",gap:spacing.sm}}>
        {(["NONE","VENUE","PROMOTION"] as const).map((value)=><Pressable
          key={value}
          onPress={()=>{setCtaType(value);if(value!=="PROMOTION")setPromotionId(null);}}
          style={{paddingHorizontal:spacing.md,paddingVertical:spacing.sm,borderRadius:radius.md,borderWidth:1,borderColor:ctaType===value?colors.primary:colors.border,backgroundColor:ctaType===value?colors.primarySoft:colors.surface}}
        >
          <AppText weight={ctaType===value?"bold":"regular"}>{t(`ownerMarketing.cta.${value}` as never)}</AppText>
        </Pressable>)}
      </View>
    </Card>

    {ctaType==="PROMOTION"?<Card>
      <AppText weight="bold">{t("ownerMarketing.choosePromotion")}</AppText>
      {promotionsLoading?<DataLoadingState variant="list" minHeight={260}/>:<>
        {promotions.length===0?<AppText>{t("ownerMarketing.noActivePromotions")}</AppText>:null}
        {promotions.map((item)=><Pressable key={item.id} onPress={()=>setPromotionId(item.id)}>
          <View style={{padding:spacing.md,borderRadius:radius.md,borderWidth:1,borderColor:promotionId===item.id?colors.primary:colors.border,backgroundColor:promotionId===item.id?colors.primarySoft:colors.surface,gap:spacing.xs}}>
            <AppText weight="bold">{item.title}</AppText>
            <AppText>{item.discountedPriceAfn} AFN · {item.areaName}</AppText>
            <AppText variant="caption" forceLtr>{item.startsAt}</AppText>
          </View>
        </Pressable>)}
      </>}
    </Card>:null}

    <Card>
      <View style={{flexDirection:isRTL?"row-reverse":"row",justifyContent:"space-between",alignItems:"center",gap:spacing.md}}>
        <AppText style={{flex:1}}>{t("ownerMarketing.notifyFollowersPost")}</AppText>
        <Switch value={notifyFollowers} onValueChange={setNotifyFollowers}/>
      </View>
    </Card>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    <Button label={t("ownerMarketing.publishPost")} onPress={()=>void submit()} loading={busy} disabled={!canSubmit}/>
    <Button label={t("owner.back")} onPress={()=>router.back()} variant="secondary"/>
  </Screen>;
}
