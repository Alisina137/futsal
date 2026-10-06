import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { VenuePostDto } from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { marketingApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function PostDetailScreen(){
  const {postId}=useLocalSearchParams<{postId:string}>();
  const {t}=useLocale();
  const [post,setPost]=useState<VenuePostDto|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    if(!postId)return;
    setLoading(true);setError(null);
    marketingApi.post(postId)
      .then((result)=>setPost(result.post))
      .catch(()=>setError(t("feed.postLoadError")))
      .finally(()=>setLoading(false));
  },[postId,t]);

  function openCta(){
    if(!post)return;
    if(post.ctaType==="VENUE"&&post.ctaTargetId){
      router.push({pathname:"/venues/[venueId]",params:{venueId:post.ctaTargetId}});
      return;
    }
    if(post.ctaType==="PROMOTION"&&post.ctaTargetId){
      void marketingApi.promotion(post.ctaTargetId).then(({promotion})=>{
        router.push({pathname:"/venues/[venueId]",params:{
          venueId:promotion.venueId,
          promotionId:promotion.id,
          startsAt:promotion.startsAt,
        }});
      }).catch(()=>setError(t("feed.promotionUnavailable")));
      return;
    }
    if(post.ctaType==="COMPETITION"&&post.ctaTargetId){
      router.push({pathname:"/competitions/[competitionId]",params:{competitionId:post.ctaTargetId}});
    }
  }

  if(loading)return <Screen><DataLoadingState variant="detail" minHeight={500}/></Screen>;

  return <Screen>
    <AppText variant="title" weight="bold">{t("feed.postTitle")}</AppText>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    {post?<Card>
      {post.imageUrl?<Image source={{uri:post.imageUrl}} style={{width:"100%",height:220,borderRadius:radius.md}} resizeMode="cover"/>:null}
      <View style={{gap:spacing.xs}}>
        <AppText variant="bodyLarge" weight="bold">{post.venueName}</AppText>
        <AppText>{post.body}</AppText>
        <AppText variant="caption" muted forceLtr>{post.publishedAt}</AppText>
      </View>
      {post.ctaType!=="NONE"?<Button label={t("feed.openCta")} onPress={openCta}/>:null}
    </Card>:null}
  </Screen>;
}
