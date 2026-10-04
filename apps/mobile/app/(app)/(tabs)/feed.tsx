import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { FeedItemDto } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { marketingApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function FeedScreen(){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const [followingOnly,setFollowingOnly]=useState(false);
  const [items,setItems]=useState<FeedItemDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!session)return;
    setLoading(true);setError(null);
    try{
      const response=await marketingApi.feed(session.accessToken,followingOnly);
      setItems(response.items);
    }catch{
      setError(t("feed.loadError"));
    }finally{setLoading(false);}
  },[followingOnly,session,t]);

  useEffect(()=>{void load();},[load]);

  function openItem(item:FeedItemDto){
    if(item.type==="PROMOTION"){
      router.push({pathname:"/venues/[venueId]",params:{
        venueId:item.venueId,
        promotionId:item.promotion.id,
        startsAt:item.promotion.startsAt,
      }});
      return;
    }
    router.push({pathname:"/posts/[postId]",params:{postId:item.post.id}});
  }

  return <Screen>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("feed.title")}</AppText>
      <AppText muted>{t("feed.subtitle")}</AppText>
    </View>

    <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
      <Button
        label={t("feed.all")}
        onPress={()=>setFollowingOnly(false)}
        variant={followingOnly?"secondary":"primary"}
      />
      <Button
        label={t("feed.following")}
        onPress={()=>setFollowingOnly(true)}
        variant={followingOnly?"primary":"secondary"}
      />
    </View>

    <Button label={t("notifications.title")} onPress={()=>router.push("/notifications")} variant="secondary"/>
    <Button label={t("common.retry")} onPress={()=>void load()} loading={loading} variant="secondary"/>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    {!loading&&items.length===0?<Card><AppText>{followingOnly?t("feed.followingEmpty"):t("feed.empty")}</AppText></Card>:null}

    {items.map((item)=><Pressable key={`${item.type}-${item.id}`} onPress={()=>openItem(item)}>
      {item.type==="PROMOTION"?<Card>
        <View style={{gap:spacing.xs}}>
          <AppText variant="bodyLarge" weight="bold">{item.promotion.title}</AppText>
          <AppText muted>{item.venueName}</AppText>
          {item.promotion.note?<AppText>{item.promotion.note}</AppText>:null}
          <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm,flexWrap:"wrap"}}>
            <AppText weight="bold" style={{color:colors.primary}}>{item.promotion.discountedPriceAfn} AFN</AppText>
            <AppText muted style={{textDecorationLine:"line-through"}}>{item.promotion.originalPriceAfn} AFN</AppText>
            <View style={{paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,borderRadius:radius.lg,backgroundColor:colors.primarySoft}}>
              <AppText variant="caption" weight="bold">{item.promotion.discountPercent}%</AppText>
            </View>
          </View>
          <AppText style={{color:colors.primary}} weight="semibold">{t("feed.bookPromotion")}</AppText>
        </View>
      </Card>:<Card>
        {item.post.imageUrl?<Image source={{uri:item.post.imageUrl}} style={{width:"100%",height:180,borderRadius:radius.md}} resizeMode="cover"/>:null}
        <AppText variant="bodyLarge" weight="bold">{item.venueName}</AppText>
        <AppText>{item.post.body}</AppText>
        <AppText style={{color:colors.primary}} weight="semibold">{t("feed.openPost")}</AppText>
      </Card>}
    </Pressable>)}
  </Screen>;
}
