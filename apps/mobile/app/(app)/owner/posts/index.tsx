import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { VenuePostDto } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, View } from "react-native";
import { ownerApi } from "../../../../src/lib/api";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../../src/components/ui/Screen";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

export default function OwnerPostsScreen(){
  const {session}=useAuth();
  const {t}=useLocale();
  const [items,setItems]=useState<VenuePostDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!session)return;
    setLoading(true);setError(null);
    try{setItems((await ownerApi.posts(session.accessToken)).posts);}
    catch{setError(t("ownerMarketing.loadPostsError"));}
    finally{setLoading(false);}
  },[session,t]);

  useEffect(()=>{void load();},[load]);

  async function toggle(item:VenuePostDto){
    if(!session)return;
    try{
      if(item.status==="PUBLISHED")await ownerApi.unpublishPost(session.accessToken,item.id);
      else await ownerApi.publishPost(session.accessToken,item.id);
      await load();
    }catch{
      setError(t("ownerMarketing.postStatusError"));
    }
  }

  if(loading)return <Screen embedded><DataLoadingState variant="list" minHeight={460}/></Screen>;

  return <Screen embedded>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("ownerMarketing.postsTitle")}</AppText>
      <AppText muted>{t("ownerMarketing.postsSubtitle")}</AppText>
    </View>
    <Button label={t("ownerMarketing.createPost")} onPress={()=>router.push("/owner/posts/create")}/>
    <Button label={t("common.retry")} onPress={()=>void load()} loading={loading} variant="secondary"/>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    {!loading&&items.length===0?<Card><AppText>{t("ownerMarketing.noPosts")}</AppText></Card>:null}
    {items.map((item)=><Card key={item.id}>
      {item.imageUrl?<Image source={{uri:item.imageUrl}} style={{width:"100%",height:160,borderRadius:radius.md}} resizeMode="cover"/>:null}
      <AppText>{item.body}</AppText>
      <AppText variant="caption" muted forceLtr>{item.publishedAt}</AppText>
      <AppText weight="semibold">{t(`ownerMarketing.postStatus.${item.status}` as never)}</AppText>
      <Button
        label={item.status==="PUBLISHED"?t("ownerMarketing.unpublish"):t("ownerMarketing.publish")}
        onPress={()=>void toggle(item)}
        variant="secondary"
      />
    </Card>)}
  </Screen>;
}
