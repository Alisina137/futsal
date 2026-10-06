import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { SocialFeedPostDto, SocialPostCommentDto } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, Share, StyleSheet, View } from "react-native";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { marketingApi } from "../../../src/lib/api";
import { formatLocalDateTimeParts } from "../../../src/lib/date-time";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function HomeScreen(){
  return <SocialHome/>;
}

function SocialHome(){
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const [items,setItems]=useState<SocialFeedPostDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!session)return;
    setLoading(true);
    setError(null);
    try{
      setItems((await marketingApi.socialFeed(session.accessToken)).items);
    }catch{
      setError(t("social.feedLoadError"));
    }finally{
      setLoading(false);
    }
  },[session,t]);

  useEffect(()=>{void load();},[load]);

  function updatePost(next:SocialFeedPostDto){
    setItems((current)=>current.map((item)=>item.id===next.id?next:item));
  }

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("home.title")}</AppText>
      <AppText muted>{t("social.homeSubtitle")}</AppText>
    </View>

    <View style={[styles.topActions,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Button
        label={t("notifications.title")}
        onPress={()=>router.push("/notifications")}
        variant="secondary"
        style={{flex:1}}
      />
      <Button
        label={t("common.retry")}
        onPress={()=>void load()}
        loading={loading}
        variant="secondary"
        style={{flex:1}}
      />
    </View>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}

    {!loading&&!error&&items.length===0?<Card style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Ionicons name="people-outline" size={28} color={colors.primary}/>
      </View>
      <AppText variant="bodyLarge" weight="bold">{t("social.emptyTitle")}</AppText>
      <AppText muted>{t("social.emptyBody")}</AppText>
      <View style={{gap:spacing.sm}}>
        <Button label={t("booking.venuesTitle")} onPress={()=>router.push("/venues")} variant="secondary"/>
        <Button label={t("teams.title")} onPress={()=>router.push("/teams")} variant="secondary"/>
        <Button label={t("competition.title")} onPress={()=>router.push("/competitions")} variant="secondary"/>
      </View>
    </Card>:null}

    {items.map((post)=><SocialPostCard
      key={post.id}
      post={post}
      token={session?.accessToken??""}
      isRTL={isRTL}
      language={language}
      t={t}
      onUpdate={updatePost}
    />)}
  </Screen>;
}

function SocialPostCard({
  post,
  token,
  isRTL,
  language,
  t,
  onUpdate,
}:{
  post:SocialFeedPostDto;
  token:string;
  isRTL:boolean;
  language:Parameters<typeof formatLocalDateTimeParts>[1];
  t:(key:any,params?:Record<string,string|number>)=>string;
  onUpdate:(post:SocialFeedPostDto)=>void;
}){
  const [commentsOpen,setCommentsOpen]=useState(false);
  const [comments,setComments]=useState<SocialPostCommentDto[]>([]);
  const [commentsLoaded,setCommentsLoaded]=useState(false);
  const [commentsLoading,setCommentsLoading]=useState(false);
  const [commentDraft,setCommentDraft]=useState("");
  const [commentBusy,setCommentBusy]=useState(false);
  const [likeBusy,setLikeBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const published=formatLocalDateTimeParts(post.publishedAt,language);

  function openAuthor(){
    if(post.authorType==="VENUE"){
      router.push({pathname:"/venues/[venueId]",params:{venueId:post.authorId}});
      return;
    }
    if(post.authorType==="TEAM"){
      router.push({pathname:"/teams/[teamId]",params:{teamId:post.authorId}});
      return;
    }
    router.push({pathname:"/competitions/[competitionId]",params:{competitionId:post.authorId}});
  }

  async function toggleLike(){
    if(!token||likeBusy)return;
    setLikeBusy(true);setError(null);
    try{
      const result=post.likedByMe
        ?await marketingApi.unlikeSocialPost(token,post.id)
        :await marketingApi.likeSocialPost(token,post.id);
      onUpdate(result.post);
    }catch{
      setError(t("social.likeError"));
    }finally{
      setLikeBusy(false);
    }
  }

  async function toggleComments(){
    const next=!commentsOpen;
    setCommentsOpen(next);
    if(!next||commentsLoaded||!token)return;
    setCommentsLoading(true);setError(null);
    try{
      setComments((await marketingApi.socialComments(token,post.id)).comments);
      setCommentsLoaded(true);
    }catch{
      setError(t("social.commentsLoadError"));
    }finally{
      setCommentsLoading(false);
    }
  }

  async function addComment(){
    const body=commentDraft.trim();
    if(!token||!body||commentBusy)return;
    setCommentBusy(true);setError(null);
    try{
      const {comment}=await marketingApi.addSocialComment(token,post.id,{body});
      setComments((current)=>[...current,comment]);
      setCommentsLoaded(true);
      setCommentsOpen(true);
      setCommentDraft("");
      onUpdate({...post,commentCount:post.commentCount+1});
    }catch{
      setError(t("social.commentError"));
    }finally{
      setCommentBusy(false);
    }
  }

  async function sharePost(){
    try{
      await Share.share({
        message:`${post.authorName}\n\n${post.body}\n\nLeagueKick`,
      });
    }catch{
      setError(t("social.shareError"));
    }
  }

  const initials=post.authorName.trim().slice(0,2).toUpperCase()||"LK";

  return <Card style={styles.postCard}>
    <Pressable
      accessibilityRole="button"
      onPress={openAuthor}
      style={({pressed})=>[
        styles.authorRow,
        {flexDirection:isRTL?"row-reverse":"row"},
        pressed&&styles.pressed,
      ]}
    >
      {post.authorImageUrl
        ?<Image source={{uri:post.authorImageUrl}} style={styles.authorImage}/>
        :<View style={styles.authorFallback}><AppText weight="bold" style={{color:colors.primary}}>{initials}</AppText></View>}
      <View style={[styles.authorCopy,{alignItems:isRTL?"flex-end":"flex-start"}]}>
        <AppText weight="bold">{post.authorName}</AppText>
        <AppText variant="caption" muted>{t(`social.entity.${post.authorType}` as never)}</AppText>
      </View>
      <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={18} color={colors.textMuted}/>
    </Pressable>

    <View style={styles.timestamp}>
      <AppText variant="caption" muted>{published.date}</AppText>
      <AppText variant="caption" muted>{published.time}</AppText>
    </View>

    <AppText>{post.body}</AppText>

    {post.imageUrl?<Image source={{uri:post.imageUrl}} style={styles.postImage} resizeMode="cover"/>:null}

    <View style={[styles.countRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <AppText variant="caption" muted>{t("social.likes",{count:post.likeCount})}</AppText>
      <AppText variant="caption" muted>{t("social.comments",{count:post.commentCount})}</AppText>
    </View>

    <View style={styles.actionDivider}/>

    <View style={[styles.socialActions,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <SocialAction
        icon={post.likedByMe?"heart":"heart-outline"}
        label={t("social.like")}
        active={post.likedByMe}
        busy={likeBusy}
        onPress={()=>void toggleLike()}
      />
      <SocialAction
        icon="chatbubble-outline"
        label={t("social.comment")}
        active={commentsOpen}
        onPress={()=>void toggleComments()}
      />
      <SocialAction
        icon="share-social-outline"
        label={t("social.share")}
        onPress={()=>void sharePost()}
      />
    </View>

    {error?<AppText variant="caption" style={{color:colors.danger}}>{error}</AppText>:null}

    {commentsOpen?<View style={styles.commentsSection}>
      {commentsLoading?<AppText variant="caption" muted>{t("common.loading")}</AppText>:null}

      {!commentsLoading&&commentsLoaded&&comments.length===0
        ?<AppText variant="caption" muted>{t("social.noComments")}</AppText>
        :null}

      {comments.map((comment)=><View
        key={comment.id}
        style={[styles.commentRow,{flexDirection:isRTL?"row-reverse":"row"}]}
      >
        {comment.profileImageUrl
          ?<Image source={{uri:comment.profileImageUrl}} style={styles.commentAvatar}/>
          :<View style={styles.commentFallback}>
            <AppText variant="caption" weight="bold" style={{color:colors.primary}}>
              {comment.displayName.trim().slice(0,2).toUpperCase()||"U"}
            </AppText>
          </View>}
        <View style={styles.commentBubble}>
          <AppText variant="caption" weight="bold">{comment.displayName}</AppText>
          <AppText variant="caption">{comment.body}</AppText>
        </View>
      </View>)}

      <TextField
        label={t("social.addComment")}
        value={commentDraft}
        onChangeText={setCommentDraft}
        placeholder={t("social.commentPlaceholder")}
        multiline
      />
      <Button
        label={t("social.postComment")}
        onPress={()=>void addComment()}
        loading={commentBusy}
        disabled={!commentDraft.trim()}
      />
    </View>:null}
  </Card>;
}

function SocialAction({
  icon,
  label,
  active=false,
  busy=false,
  onPress,
}:{
  icon:keyof typeof Ionicons.glyphMap;
  label:string;
  active?:boolean;
  busy?:boolean;
  onPress:()=>void;
}){
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    disabled={busy}
    onPress={onPress}
    style={({pressed})=>[
      styles.socialAction,
      (active||pressed)&&styles.socialActionActive,
      busy&&styles.socialActionBusy,
    ]}
  >
    <Ionicons name={icon} size={20} color={active?colors.primary:colors.textMuted}/>
    <AppText variant="caption" weight="semibold" style={active?{color:colors.primary}:undefined}>{label}</AppText>
  </Pressable>;
}

const styles=StyleSheet.create({
  topActions:{
    gap:spacing.sm,
  },
  emptyCard:{
    gap:spacing.md,
    padding:spacing.lg,
  },
  emptyIcon:{
    width:52,
    height:52,
    borderRadius:26,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:colors.primarySoft,
  },
  postCard:{
    gap:spacing.md,
    padding:spacing.md,
  },
  authorRow:{
    minHeight:52,
    alignItems:"center",
    gap:spacing.sm,
  },
  authorImage:{
    width:46,
    height:46,
    borderRadius:23,
  },
  authorFallback:{
    width:46,
    height:46,
    borderRadius:23,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:colors.primarySoft,
  },
  authorCopy:{
    flex:1,
    gap:2,
  },
  pressed:{
    opacity:0.72,
  },
  timestamp:{
    gap:2,
  },
  postImage:{
    width:"100%",
    height:220,
    borderRadius:radius.md,
    backgroundColor:colors.surfaceMuted,
  },
  countRow:{
    justifyContent:"space-between",
    gap:spacing.sm,
  },
  actionDivider:{
    height:1,
    backgroundColor:colors.border,
  },
  socialActions:{
    gap:spacing.xs,
  },
  socialAction:{
    flex:1,
    minHeight:44,
    borderRadius:radius.md,
    alignItems:"center",
    justifyContent:"center",
    flexDirection:"row",
    gap:spacing.xs,
  },
  socialActionActive:{
    backgroundColor:colors.primarySoft,
  },
  socialActionBusy:{
    opacity:0.55,
  },
  commentsSection:{
    gap:spacing.sm,
    borderTopWidth:1,
    borderTopColor:colors.border,
    paddingTop:spacing.md,
  },
  commentRow:{
    alignItems:"flex-start",
    gap:spacing.sm,
  },
  commentAvatar:{
    width:34,
    height:34,
    borderRadius:17,
  },
  commentFallback:{
    width:34,
    height:34,
    borderRadius:17,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:colors.primarySoft,
  },
  commentBubble:{
    flex:1,
    gap:2,
    paddingHorizontal:spacing.sm,
    paddingVertical:spacing.xs,
    borderRadius:radius.md,
    backgroundColor:colors.surfaceMuted,
  },
});
