import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { SocialFeedPostDto, SocialFollowStateDto } from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { marketingApi, resolveMediaImageUrl } from "../../../src/lib/api";
import { formatPostTimeAgo } from "../../../src/lib/date-time";
import { usePostTimeNow } from "../../../src/hooks/usePostTimeNow";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function PublicUserProfileScreen(){
  const {userId}=useLocalSearchParams<{userId:string}>();
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const now=usePostTimeNow();
  const [profile,setProfile]=useState<{id:string;name:string;imageUrl:string|null}|null>(null);
  const [posts,setPosts]=useState<SocialFeedPostDto[]>([]);
  const [follow,setFollow]=useState<SocialFollowStateDto|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const mine=session?.user.id===userId;

  const load=useCallback(async()=>{
    if(!session||!userId)return;
    setLoading(true);setError(null);
    try{
      const response=await marketingApi.publicUserProfile(session.accessToken,userId);
      setProfile(response.profile);setPosts(response.posts);setFollow(response.followState);
    }catch{setError(t("social.profileLoadError"));}
    finally{setLoading(false);}
  },[session,userId,t]);

  useEffect(()=>{void load();},[load]);

  async function toggleFollow(){
    if(!session||!userId||!follow||busy||mine)return;
    setBusy(true);setError(null);
    try{
      const next=follow.following
        ?await marketingApi.socialUnfollow(session.accessToken,"USER",userId)
        :await marketingApi.socialFollow(session.accessToken,"USER",userId);
      setFollow(next);
    }catch{setError(t("social.followError"));}
    finally{setBusy(false);}
  }

  if(loading)return <Screen showHeader><DataLoadingState variant="dashboard" minHeight={450}/></Screen>;
  return <Screen showHeader style={{gap:spacing.md}}>
    <Pressable accessibilityRole="button" accessibilityLabel={t("home.title")} onPress={()=>router.navigate("/home")}
      style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
      <Ionicons name={isRTL?"arrow-forward":"arrow-back"} color={colors.primary} size={22}/>
      <AppText style={{color:colors.primary}}>{t("home.title")}</AppText>
    </Pressable>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} onPress={()=>void load()} variant="secondary"/></Card>:null}
    {profile?<Card style={{alignItems:"center",gap:spacing.md,padding:spacing.lg}}>
      {resolveMediaImageUrl(profile.imageUrl)
        ?<Image source={{uri:resolveMediaImageUrl(profile.imageUrl)!}} style={{width:96,height:96,borderRadius:48}}/>
        :<View style={{width:96,height:96,borderRadius:48,backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"}}>
          <Ionicons name="person" size={54} color={colors.primary}/>
        </View>}
      <AppText variant="title" weight="bold">{profile.name}</AppText>
      <AppText variant="caption" muted>{t("social.entity.USER")}</AppText>
      {follow&&!mine?<Button label={t(follow.following?"social.unfollow":"social.follow")}
        onPress={()=>void toggleFollow()} loading={busy} variant={follow.following?"secondary":"primary"}/>:null}
      {follow?<AppText variant="caption" muted>{t("social.followers",{count:follow.followerCount})}</AppText>:null}
    </Card>:null}
    <AppText weight="bold" variant="bodyLarge">{t("social.latestPosts")}</AppText>
    {!error&&posts.length===0?<Card><AppText muted>{t("social.userNoPosts")}</AppText></Card>:null}
    {posts.map(post=><Pressable key={post.id} accessibilityRole="button"
      onPress={()=>router.push({pathname:"/posts/[postId]/comments",params:{postId:post.id}})}>
      <Card style={{gap:spacing.sm}}>
        <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
          <AppText weight="semibold" style={{flex:1}}>{post.authorName}</AppText>
          <AppText variant="caption" muted>{formatPostTimeAgo(post.publishedAt,language,now)}</AppText>
        </View>
        {post.body?<AppText>{post.body}</AppText>:null}
        {resolveMediaImageUrl(post.imageUrl)
          ?<Image source={{uri:resolveMediaImageUrl(post.imageUrl)!}}
            style={{width:"100%",height:240,borderRadius:radius.md}} resizeMode="cover"/>:null}
        <AppText variant="caption" muted>{t("social.likes",{count:post.likeCount})} · {t("social.comments",{count:post.commentCount})}</AppText>
      </Card>
    </Pressable>)}
  </Screen>;
}
