import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { SocialFeedPostDto, SocialPostCommentDto } from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Pressable, View } from "react-native";
import { marketingApi } from "../../../../src/lib/api";
import { formatLocalDateTimeParts } from "../../../../src/lib/date-time";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../../src/components/ui/Screen";
import { TextField } from "../../../../src/components/ui/TextField";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

export default function PostCommentsScreen(){
  const {postId}=useLocalSearchParams<{postId:string}>();
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const [post,setPost]=useState<SocialFeedPostDto|null>(null);
  const [comments,setComments]=useState<SocialPostCommentDto[]>([]);
  const [draft,setDraft]=useState("");
  const [editingId,setEditingId]=useState<string|null>(null);
  const [editingBody,setEditingBody]=useState("");
  const [busyId,setBusyId]=useState<string|null>(null);
  const [posting,setPosting]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!session||!postId)return;
    setLoading(true);setError(null);
    try{
      const data=await marketingApi.socialComments(session.accessToken,postId);
      setPost(data.post);
      setComments(data.comments);
    }catch{
      setError(t("social.commentsLoadError"));
    }finally{
      setLoading(false);
    }
  },[postId,session,t]);

  useEffect(()=>{void load();},[load]);

  function openAuthor(){
    if(!post)return;
    if(post.authorType==="VENUE"){
      router.push({pathname:"/venues/[venueId]",params:{venueId:post.authorId}});
    }else if(post.authorType==="TEAM"){
      router.push({pathname:"/teams/[teamId]",params:{teamId:post.authorId}});
    }else{
      router.push({pathname:"/competitions/[competitionId]",params:{competitionId:post.authorId}});
    }
  }

  async function addComment(){
    const body=draft.trim();
    if(!session||!postId||!body||posting)return;
    setPosting(true);setError(null);
    try{
      const {comment}=await marketingApi.addSocialComment(session.accessToken,postId,{body});
      setComments((current)=>[...current,comment]);
      setDraft("");
      setPost((current)=>current?{...current,commentCount:current.commentCount+1}:current);
    }catch{
      setError(t("social.commentError"));
    }finally{setPosting(false);}
  }

  async function toggleCommentLike(comment:SocialPostCommentDto){
    if(!session||!postId||busyId)return;
    setBusyId(comment.id);setError(null);
    try{
      const {comment:next}=comment.likedByMe
        ?await marketingApi.unlikeSocialComment(session.accessToken,postId,comment.id)
        :await marketingApi.likeSocialComment(session.accessToken,postId,comment.id);
      setComments((current)=>current.map((item)=>item.id===next.id?next:item));
    }catch{
      setError(t("social.commentLikeError"));
    }finally{setBusyId(null);}
  }

  function beginEdit(comment:SocialPostCommentDto){
    setEditingId(comment.id);
    setEditingBody(comment.body);
  }

  async function saveEdit(commentId:string){
    const body=editingBody.trim();
    if(!session||!postId||!body||busyId)return;
    setBusyId(commentId);setError(null);
    try{
      const {comment}=await marketingApi.updateSocialComment(session.accessToken,postId,commentId,{body});
      setComments((current)=>current.map((item)=>item.id===comment.id?comment:item));
      setEditingId(null);
      setEditingBody("");
    }catch{
      setError(t("social.commentEditError"));
    }finally{setBusyId(null);}
  }

  function confirmDelete(comment:SocialPostCommentDto){
    Alert.alert(
      t("social.deleteCommentTitle"),
      t("social.deleteCommentBody"),
      [
        {text:t("common.cancel"),style:"cancel"},
        {text:t("social.deleteComment"),style:"destructive",onPress:()=>void deleteComment(comment.id)},
      ],
    );
  }

  async function deleteComment(commentId:string){
    if(!session||!postId||busyId)return;
    setBusyId(commentId);setError(null);
    try{
      await marketingApi.deleteSocialComment(session.accessToken,postId,commentId);
      setComments((current)=>current.filter((item)=>item.id!==commentId));
      setPost((current)=>current?{...current,commentCount:Math.max(0,current.commentCount-1)}:current);
      if(editingId===commentId){setEditingId(null);setEditingBody("");}
    }catch{
      setError(t("social.commentDeleteError"));
    }finally{setBusyId(null);}
  }

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("social.commentsPageTitle")}</AppText>
      <AppText muted>{t("social.commentsPageSubtitle")}</AppText>
    </View>

    {loading?<DataLoadingState variant="list"/>:null}
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}

    {post?<Card style={{gap:spacing.md}}>
      <Pressable
        accessibilityRole="button"
        onPress={openAuthor}
        style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}
      >
        {post.authorImageUrl
          ?<Image source={{uri:post.authorImageUrl}} style={{width:46,height:46,borderRadius:23}}/>
          :<View style={{width:46,height:46,borderRadius:23,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft}}>
            <AppText weight="bold" style={{color:colors.primary}}>{post.authorName.slice(0,2).toUpperCase()}</AppText>
          </View>}
        <View style={{flex:1,alignItems:isRTL?"flex-end":"flex-start"}}>
          <AppText weight="bold">{post.authorName}</AppText>
          <AppText variant="caption" muted>{t(`social.entity.${post.authorType}` as never)}</AppText>
        </View>
        <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={18} color={colors.textMuted}/>
      </Pressable>
      <AppText>{post.body}</AppText>
      {post.imageUrl?<Image source={{uri:post.imageUrl}} style={{width:"100%",height:210,borderRadius:radius.md}} resizeMode="cover"/>:null}
      <View style={{flexDirection:isRTL?"row-reverse":"row",justifyContent:"space-between"}}>
        <AppText variant="caption" muted>{t("social.likes",{count:post.likeCount})}</AppText>
        <AppText variant="caption" muted>{t("social.comments",{count:post.commentCount})}</AppText>
      </View>
    </Card>:null}

    <Card style={{gap:spacing.sm}}>
      <TextField
        label={t("social.addComment")}
        value={draft}
        onChangeText={setDraft}
        placeholder={t("social.commentPlaceholder")}
        multiline
      />
      <Button
        label={t("social.postComment")}
        onPress={()=>void addComment()}
        loading={posting}
        disabled={!draft.trim()}
      />
    </Card>

    <View style={{gap:spacing.sm}}>
      <AppText variant="bodyLarge" weight="bold">{t("social.allComments")}</AppText>
      {!loading&&comments.length===0?<Card><AppText muted>{t("social.noComments")}</AppText></Card>:null}

      {comments.map((comment)=>{
        const created=formatLocalDateTimeParts(comment.createdAt,language);
        const editing=editingId===comment.id;
        return <View key={comment.id} style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"flex-start",gap:spacing.sm}}>
          {comment.profileImageUrl
            ?<Image source={{uri:comment.profileImageUrl}} style={{width:38,height:38,borderRadius:19}}/>
            :<View style={{width:38,height:38,borderRadius:19,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft}}>
              <AppText variant="caption" weight="bold" style={{color:colors.primary}}>{comment.displayName.slice(0,2).toUpperCase()}</AppText>
            </View>}
          <View style={{flex:1,gap:spacing.xs}}>
            <View style={{paddingHorizontal:spacing.md,paddingVertical:spacing.sm,borderRadius:radius.lg,backgroundColor:colors.surfaceMuted,gap:4}}>
              <AppText variant="caption" weight="bold">{comment.displayName}</AppText>
              {editing?<TextField
                label={t("social.editComment")}
                value={editingBody}
                onChangeText={setEditingBody}
                multiline
              />:<AppText>{comment.body}</AppText>}
              <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.xs,flexWrap:"wrap"}}>
                <AppText variant="caption" muted>{created.date} · {created.time}</AppText>
                {comment.editedAt?<AppText variant="caption" muted>· {t("social.edited")}</AppText>:null}
              </View>
            </View>

            <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.md,paddingHorizontal:spacing.xs}}>
              <Pressable
                accessibilityRole="button"
                disabled={busyId===comment.id}
                onPress={()=>void toggleCommentLike(comment)}
              >
                <AppText variant="caption" weight="semibold" style={comment.likedByMe?{color:colors.primary}:undefined}>
                  {comment.likedByMe?t("social.unlikeComment"):t("social.like")} {comment.likeCount>0?`· ${comment.likeCount}`:""}
                </AppText>
              </Pressable>

              {comment.canManage&&!editing?<Pressable onPress={()=>beginEdit(comment)}>
                <AppText variant="caption" weight="semibold">{t("social.editComment")}</AppText>
              </Pressable>:null}

              {comment.canManage&&!editing?<Pressable onPress={()=>confirmDelete(comment)}>
                <AppText variant="caption" weight="semibold" style={{color:colors.danger}}>{t("social.deleteComment")}</AppText>
              </Pressable>:null}

              {editing?<Pressable disabled={!editingBody.trim()||busyId===comment.id} onPress={()=>void saveEdit(comment.id)}>
                <AppText variant="caption" weight="bold" style={{color:colors.primary}}>{t("common.save")}</AppText>
              </Pressable>:null}

              {editing?<Pressable onPress={()=>{setEditingId(null);setEditingBody("");}}>
                <AppText variant="caption" weight="semibold">{t("common.cancel")}</AppText>
              </Pressable>:null}
            </View>
          </View>
        </View>;
      })}
    </View>
  </Screen>;
}
