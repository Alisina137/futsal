import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { SocialFeedPostDto, SocialPostCommentDto } from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, PanResponder, Platform, Pressable,
  ScrollView, StyleSheet, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { marketingApi, resolveMediaImageUrl } from "../../../../src/lib/api";
import { formatPostTimeAgo } from "../../../../src/lib/date-time";
import { usePostTimeNow } from "../../../../src/hooks/usePostTimeNow";
import { AppText } from "../../../../src/components/ui/AppText";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

/**
 * An in-app comments sheet, presented over the social feed by Expo Router.
 * The conversation scrolls independently; the avatar/composer/send action
 * remain docked at the bottom above the keyboard.
 */
export default function PostCommentsScreen(){
  const {postId}=useLocalSearchParams<{postId:string}>();
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const postNow=usePostTimeNow();
  const inputRef=useRef<TextInput>(null);
  const scrollRef=useRef<ScrollView>(null);
  const sheetSwipe=useRef(PanResponder.create({
    onMoveShouldSetPanResponder:(_event,gesture)=>
      gesture.dy>8 && Math.abs(gesture.dy)>Math.abs(gesture.dx),
    onPanResponderRelease:(_event,gesture)=>{
      if(gesture.dy>80||gesture.vy>1.2)router.back();
    },
  })).current;

  const [post,setPost]=useState<SocialFeedPostDto|null>(null);
  const [comments,setComments]=useState<SocialPostCommentDto[]>([]);
  const [draft,setDraft]=useState("");
  const [replyTo,setReplyTo]=useState<{id:string;name:string}|null>(null);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [editingBody,setEditingBody]=useState("");
  const [busyId,setBusyId]=useState<string|null>(null);
  const [posting,setPosting]=useState(false);
  const [postLikeBusy,setPostLikeBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [expandedPost,setExpandedPost]=useState(false);

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
    }else if(post.authorType==="USER"){
      router.push({pathname:"/people/[userId]",params:{userId:post.authorId}});
    }else{
      router.push({pathname:"/competitions/[competitionId]",params:{competitionId:post.authorId}});
    }
  }

  function openCommentAuthor(comment:SocialPostCommentDto){
    router.push({pathname:"/people/[userId]",params:{userId:comment.userId}});
  }

  async function togglePostLike(){
    if(!session||!postId||!post||postLikeBusy)return;
    setPostLikeBusy(true);setError(null);
    try{
      const result=post.likedByMe
        ?await marketingApi.unlikeSocialPost(session.accessToken,postId)
        :await marketingApi.likeSocialPost(session.accessToken,postId);
      setPost(result.post);
    }catch{
      setError(t("social.likeError"));
    }finally{setPostLikeBusy(false);}
  }

  async function addComment(){
    const body=draft.trim();
    if(!session||!postId||!body||posting||body.length>1000)return;
    setPosting(true);setError(null);
    try{
      const {comment}=await marketingApi.addSocialComment(session.accessToken,postId,{body});
      setComments(current=>[...current,comment]);
      setDraft("");
      setReplyTo(null);
      setPost(current=>current?{...current,commentCount:current.commentCount+1}:current);
      inputRef.current?.blur();
      requestAnimationFrame(()=>scrollRef.current?.scrollToEnd({animated:true}));
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
      setComments(current=>current.map(item=>item.id===next.id?next:item));
    }catch{
      setError(t("social.commentLikeError"));
    }finally{setBusyId(null);}
  }

  // Replies are mentions using the existing comment API, not fake threaded replies.
  function replyToComment(comment:SocialPostCommentDto){
    setReplyTo({id:comment.id,name:comment.displayName});
    setDraft(current=>current.trim()?current:`@${comment.displayName} `);
    inputRef.current?.focus();
  }

  function cancelReply(){
    setReplyTo(null);
    setDraft(current=>current.startsWith(`@${replyTo?.name} `)?current.slice((replyTo?.name.length??0)+2):current);
  }

  function beginEdit(comment:SocialPostCommentDto){
    setEditingId(comment.id);
    setEditingBody(comment.body);
  }

  async function saveEdit(commentId:string){
    const body=editingBody.trim();
    if(!session||!postId||!body||body.length>1000||busyId)return;
    setBusyId(commentId);setError(null);
    try{
      const {comment}=await marketingApi.updateSocialComment(session.accessToken,postId,commentId,{body});
      setComments(current=>current.map(item=>item.id===comment.id?comment:item));
      setEditingId(null);setEditingBody("");
    }catch{
      setError(t("social.commentEditError"));
    }finally{setBusyId(null);}
  }

  function confirmDelete(comment:SocialPostCommentDto){
    Alert.alert(t("social.deleteCommentTitle"),t("social.deleteCommentBody"),[
      {text:t("common.cancel"),style:"cancel"},
      {text:t("social.deleteComment"),style:"destructive",onPress:()=>void deleteComment(comment.id)},
    ]);
  }

  async function deleteComment(commentId:string){
    if(!session||!postId||busyId)return;
    setBusyId(commentId);setError(null);
    try{
      await marketingApi.deleteSocialComment(session.accessToken,postId,commentId);
      setComments(current=>current.filter(item=>item.id!==commentId));
      setPost(current=>current?{...current,commentCount:Math.max(0,current.commentCount-1)}:current);
      if(editingId===commentId){setEditingId(null);setEditingBody("");}
      if(replyTo?.id===commentId)setReplyTo(null);
    }catch{
      setError(t("social.commentDeleteError"));
    }finally{setBusyId(null);}
  }

  function showCommentOptions(comment:SocialPostCommentDto){
    if(!comment.canManage)return;
    Alert.alert(comment.displayName,t("social.commentOptions"),[
      {text:t("social.editComment"),onPress:()=>beginEdit(comment)},
      {text:t("social.deleteComment"),style:"destructive",onPress:()=>confirmDelete(comment)},
      {text:t("common.cancel"),style:"cancel"},
    ]);
  }

  const composerAvatar=resolveMediaImageUrl(session?.user.profileImageUrl);
  const userInitials=(session?.user.displayName??"FT").trim().slice(0,2).toUpperCase();
  const canPost=Boolean(draft.trim()&&!posting&&draft.trim().length<=1000);
  const commentCount=post?.commentCount??comments.length;

  return <View style={styles.overlayRoot}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("social.closeComments")}
      onPress={()=>router.back()}
      style={styles.scrim}
    />
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS==="ios"?"padding":undefined}
      pointerEvents="box-none"
    >
      <SafeAreaView style={styles.sheet} edges={["bottom"]}>
        <View style={styles.handleArea} {...sheetSwipe.panHandlers} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.handle}/>
        </View>

        <View style={[styles.sheetTitleRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.headerSpacer}/>
          <AppText weight="bold" variant="bodyLarge" style={styles.sheetTitle}>{t("social.commentsPageTitle")}</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("social.closeComments")}
            onPress={()=>router.back()}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={22} color={colors.text}/>
          </Pressable>
        </View>

        {post?<View style={[styles.engagementStrip,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("social.likes",{count:post.likeCount})}
            onPress={()=>void togglePostLike()} disabled={postLikeBusy}
            style={[styles.engagementGroup,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <View style={styles.blueLike}><Ionicons name="thumbs-up" color="#FFFFFF" size={12}/></View>
            <AppText variant="caption" weight="medium" muted>{post.likeCount}</AppText>
          </Pressable>
          <AppText variant="caption" muted>{t("social.comments",{count:commentCount})}</AppText>
        </View>:null}

        {error?<View style={styles.errorRow}>
          <AppText variant="caption" accessibilityRole="alert" style={{color:colors.danger,flex:1}}>{error}</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel={t("common.retry")} onPress={()=>void load()}>
            <Ionicons name="refresh" size={19} color={colors.primary}/>
          </Pressable>
        </View>:null}

        <ScrollView
          ref={scrollRef}
          style={styles.commentScroller}
          contentContainerStyle={styles.commentContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading?<DataLoadingState variant="list" minHeight={250}/>:null}

          {!loading&&post?<View style={styles.contextCard}>
            <Pressable
              accessibilityRole="button"
              onPress={openAuthor}
              style={[styles.authorRow,{flexDirection:isRTL?"row-reverse":"row"}]}
            >
              <Avatar uri={resolveMediaImageUrl(post.authorImageUrl)} initials={post.authorName.slice(0,2).toUpperCase()} size={35}/>
              <View style={[styles.authorText,{alignItems:isRTL?"flex-end":"flex-start"}]}>
                <AppText weight="semibold" numberOfLines={1}>{post.authorName}</AppText>
                <AppText variant="caption" muted>{formatPostTimeAgo(post.publishedAt,language,postNow)} · {t(`social.entity.${post.authorType}` as never)}</AppText>
              </View>
              <Ionicons name={isRTL?"chevron-back":"chevron-forward"} color={colors.textMuted} size={17}/>
            </Pressable>
            {post.body?<Pressable
              accessibilityRole="button"
              accessibilityLabel={t("social.showOriginalPost")}
              onPress={()=>setExpandedPost(value=>!value)}
            >
              <AppText numberOfLines={expandedPost?undefined:2}>{post.body}</AppText>
              {post.body.length>125&&!expandedPost?<AppText weight="semibold" variant="caption" style={{color:colors.primary}}>
                {t("social.seeMore")}
              </AppText>:null}
            </Pressable>:null}
            {post.imageUrl?<Pressable
              accessibilityRole="button"
              accessibilityLabel={t("social.showOriginalPost")}
              onPress={()=>setExpandedPost(value=>!value)}
              style={styles.postThumbnailRow}
            >
              <Image source={{uri:resolveMediaImageUrl(post.imageUrl)!}} style={styles.postThumbnail} resizeMode="cover"/>
              <AppText variant="caption" muted>{t("social.originalPostPhoto")}</AppText>
            </Pressable>:null}
            <Pressable accessibilityRole="button"
              accessibilityLabel={t("social.like")}
              onPress={()=>void togglePostLike()}
              disabled={postLikeBusy}
              style={[styles.likePostButton,{flexDirection:isRTL?"row-reverse":"row"}]}
            >
              <Ionicons name={post.likedByMe?"thumbs-up":"thumbs-up-outline"} size={16}
                color={post.likedByMe?colors.primary:colors.textMuted}/>
              <AppText variant="caption" weight="semibold"
                style={post.likedByMe?{color:colors.primary}:undefined}>{t("social.like")}</AppText>
            </Pressable>
          </View>:null}

          {!loading&&comments.length===0&&!error?<View style={styles.emptyComments}>
            <Ionicons name="chatbubbles-outline" size={42} color={colors.textMuted}/>
            <AppText weight="semibold">{t("social.noComments")}</AppText>
            <AppText variant="caption" muted>{t("social.firstCommentHint")}</AppText>
          </View>:null}

          {!loading?comments.map(comment=>{
            const editing=editingId===comment.id;
            return <View
              key={comment.id}
              style={[styles.commentRow,{flexDirection:isRTL?"row-reverse":"row"}]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={comment.displayName}
                onPress={()=>openCommentAuthor(comment)}
              >
                <Avatar uri={resolveMediaImageUrl(comment.profileImageUrl)}
                  initials={comment.displayName.slice(0,2).toUpperCase()} size={38}/>
              </Pressable>

              <View style={styles.commentMain}>
                <View style={[styles.commentBubble,{alignItems:isRTL?"flex-end":"flex-start"}]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={comment.displayName}
                    onPress={()=>openCommentAuthor(comment)}
                    style={styles.authorPress}
                  >
                    <AppText variant="caption" weight="bold">{comment.displayName}</AppText>
                  </Pressable>

                  {editing?<View style={styles.editContainer}>
                    <TextInput
                      multiline
                      maxLength={1000}
                      value={editingBody}
                      onChangeText={setEditingBody}
                      accessibilityLabel={t("social.editComment")}
                      placeholderTextColor={colors.textMuted}
                      style={[styles.editInput,{textAlign:isRTL?"right":"left",writingDirection:isRTL?"rtl":"ltr"}]}
                    />
                    <View style={[styles.editActions,{flexDirection:isRTL?"row-reverse":"row"}]}>
                      <Pressable disabled={!editingBody.trim()||busyId===comment.id}
                        accessibilityRole="button" accessibilityLabel={t("common.save")}
                        onPress={()=>void saveEdit(comment.id)} style={styles.editButton}>
                        <AppText weight="semibold" style={{color:colors.primary}}>{t("common.save")}</AppText>
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")}
                        onPress={()=>{setEditingId(null);setEditingBody("");}}>
                        <AppText variant="caption" muted>{t("common.cancel")}</AppText>
                      </Pressable>
                    </View>
                  </View>:<AppText>{comment.body}</AppText>}
                </View>

                {comment.likeCount>0?<View style={[styles.commentLikeBadge,isRTL?styles.likeBadgeLeft:styles.likeBadgeRight]}>
                  <View style={styles.smallLike}><Ionicons name="thumbs-up" size={10} color="#FFFFFF"/></View>
                  <AppText variant="caption" muted>{comment.likeCount}</AppText>
                </View>:null}

                <View style={[styles.commentActions,{flexDirection:isRTL?"row-reverse":"row"}]}>
                  <AppText variant="caption" muted>{formatPostTimeAgo(comment.createdAt,language,postNow)}</AppText>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("social.like")}
                    disabled={busyId===comment.id}
                    onPress={()=>void toggleCommentLike(comment)}>
                    <AppText variant="caption" weight="semibold"
                      style={comment.likedByMe?{color:colors.primary}:styles.actionLabel}>
                      {comment.likedByMe?t("social.unlikeComment"):t("social.like")}
                    </AppText>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("social.replyComment")}
                    onPress={()=>replyToComment(comment)}>
                    <AppText variant="caption" weight="semibold" style={styles.actionLabel}>{t("social.replyComment")}</AppText>
                  </Pressable>
                  {comment.editedAt?<AppText variant="caption" muted>{t("social.edited")}</AppText>:null}
                  {comment.canManage?<Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("social.commentOptions")}
                    onPress={()=>showCommentOptions(comment)}
                    style={styles.commentMore}
                  >
                    <Ionicons name="ellipsis-horizontal" size={17} color={colors.textMuted}/>
                  </Pressable>:null}
                </View>
              </View>
            </View>;
          }):null}
          {!loading&&comments.length>0?<View style={styles.endSpacer}/>:null}
        </ScrollView>

        <View style={styles.composerDock}>
          {replyTo?<View style={[styles.replyBanner,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Ionicons name="return-down-forward-outline" size={17} color={colors.primary}/>
            <AppText variant="caption" style={{flex:1}} numberOfLines={1}>
              {t("social.replyingTo",{name:replyTo.name})}
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel={t("social.cancelReply")}
              onPress={cancelReply} style={styles.cancelReplyButton}>
              <Ionicons name="close" size={18} color={colors.textMuted}/>
            </Pressable>
          </View>:null}
          <View style={[styles.composerRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Avatar uri={composerAvatar} initials={userInitials} size={36}/>
            <View style={[styles.composerPill,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <TextInput
                ref={inputRef}
                testID="social-comment-composer"
                accessibilityLabel={t("social.commentPlaceholder")}
                placeholder={t("social.commentPlaceholder")}
                placeholderTextColor={colors.textMuted}
                value={draft}
                onChangeText={setDraft}
                maxLength={1000}
                multiline
                blurOnSubmit={false}
                editable={!posting&&Boolean(session)}
                style={[styles.composerInput,{textAlign:isRTL?"right":"left",writingDirection:isRTL?"rtl":"ltr"}]}
              />
              <Pressable
                testID="social-comment-send"
                accessibilityRole="button"
                accessibilityLabel={t("social.postComment")}
                accessibilityState={{disabled:!canPost}}
                disabled={!canPost}
                onPress={()=>void addComment()}
                style={[styles.sendButton,!canPost&&styles.sendButtonDisabled]}
              >
                {posting?<ActivityIndicator size="small" color="#FFFFFF"/>:
                  <Ionicons name="send" size={19} color="#FFFFFF" style={isRTL?{transform:[{scaleX:-1}]}:undefined}/>}
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  </View>;
}

function Avatar({uri,initials,size}:{uri:string|null;initials:string;size:number}){
  const circle={height:size,width:size,borderRadius:size/2};
  return uri?<Image source={{uri}} style={[styles.avatar,circle]}/>:
    <View style={[styles.avatarFallback,circle]}>
      <AppText weight="bold" variant="caption" style={{color:colors.primary}}>{initials||"FT"}</AppText>
    </View>;
}

const styles=StyleSheet.create({
  overlayRoot:{flex:1,backgroundColor:"transparent",justifyContent:"flex-end"},
  scrim:{position:"absolute",top:0,bottom:0,left:0,right:0,backgroundColor:"rgba(12,19,32,.55)"},
  keyboardContainer:{flex:1,width:"100%",justifyContent:"flex-end"},
  sheet:{height:"91%",width:"100%",maxWidth:740,alignSelf:"center",backgroundColor:colors.surface,
    borderTopLeftRadius:24,borderTopRightRadius:24,overflow:"hidden",shadowColor:"#000000",
    shadowOpacity:.22,shadowRadius:20,elevation:14},
  handleArea:{height:19,alignItems:"center",justifyContent:"center"},
  handle:{width:40,height:5,borderRadius:3,backgroundColor:"#D1D5DB"},
  sheetTitleRow:{alignItems:"center",minHeight:48,paddingHorizontal:spacing.md,
    borderBottomColor:colors.border,borderBottomWidth:1},
  headerSpacer:{height:38,width:38},
  sheetTitle:{flex:1,textAlign:"center",fontSize:18},
  closeButton:{height:38,width:38,alignItems:"center",justifyContent:"center",
    borderRadius:19,backgroundColor:"#EFF2F6"},
  engagementStrip:{minHeight:38,justifyContent:"space-between",alignItems:"center",
    paddingHorizontal:spacing.md,borderBottomWidth:1,borderBottomColor:"#EDF0F4"},
  engagementGroup:{alignItems:"center",gap:5},
  blueLike:{width:19,height:19,borderRadius:10,backgroundColor:colors.primary,
    alignItems:"center",justifyContent:"center"},
  errorRow:{backgroundColor:"#FFF5F5",flexDirection:"row",alignItems:"center",
    gap:spacing.sm,paddingHorizontal:spacing.md,paddingVertical:spacing.sm},
  commentScroller:{flex:1},
  commentContent:{paddingHorizontal:spacing.md,paddingVertical:spacing.md,gap:spacing.md,flexGrow:1},
  contextCard:{borderBottomWidth:1,borderBottomColor:colors.border,paddingBottom:spacing.md,gap:spacing.sm},
  authorRow:{alignItems:"center",gap:spacing.sm},
  authorText:{flex:1,gap:1},
  postThumbnailRow:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
  postThumbnail:{width:72,height:60,borderRadius:radius.sm,backgroundColor:colors.surfaceMuted},
  likePostButton:{alignSelf:"flex-start",alignItems:"center",gap:spacing.xs,minHeight:30},
  emptyComments:{flex:1,minHeight:170,alignItems:"center",justifyContent:"center",gap:spacing.sm,padding:spacing.md},
  commentRow:{alignItems:"flex-start",gap:spacing.sm,marginBottom:2},
  commentMain:{flex:1,minWidth:0,position:"relative",alignItems:"stretch"},
  commentBubble:{backgroundColor:"#F0F2F5",borderRadius:18,paddingVertical:spacing.sm,
    paddingHorizontal:spacing.md,gap:3,alignSelf:"stretch"},
  authorPress:{alignSelf:"stretch"},
  commentActions:{alignItems:"center",flexWrap:"wrap",gap:spacing.md,paddingHorizontal:spacing.sm,
    minHeight:30,paddingTop:3},
  actionLabel:{color:"#4B5563"},
  commentLikeBadge:{position:"absolute",bottom:23,backgroundColor:colors.surface,
    borderRadius:radius.pill,paddingHorizontal:5,paddingVertical:2,
    flexDirection:"row",alignItems:"center",gap:3,elevation:2,
    shadowColor:"#000000",shadowOpacity:.09,shadowRadius:3},
  likeBadgeRight:{right:4},
  likeBadgeLeft:{left:4},
  smallLike:{width:16,height:16,borderRadius:8,backgroundColor:colors.primary,
    alignItems:"center",justifyContent:"center"},
  commentMore:{width:26,height:27,alignItems:"center",justifyContent:"center"},
  editContainer:{width:"100%",gap:spacing.sm},
  editInput:{width:"100%",minHeight:55,maxHeight:145,padding:spacing.sm,
    borderRadius:radius.sm,backgroundColor:colors.surface,fontSize:15,color:colors.text,
    textAlignVertical:"top"},
  editActions:{gap:spacing.md,alignItems:"center",minHeight:34},
  editButton:{padding:spacing.xs},
  endSpacer:{height:spacing.md},
  composerDock:{paddingHorizontal:spacing.md,paddingTop:spacing.sm,
    paddingBottom:spacing.sm,borderTopWidth:1,borderColor:"#E4E8EE",backgroundColor:colors.surface},
  composerRow:{alignItems:"flex-end",gap:spacing.sm},
  composerPill:{flex:1,minHeight:46,alignItems:"flex-end",borderRadius:24,
    backgroundColor:"#F0F2F5",paddingHorizontal:spacing.sm,paddingVertical:5,gap:spacing.xs},
  composerInput:{flex:1,minHeight:35,maxHeight:110,fontSize:15,lineHeight:21,
    paddingHorizontal:spacing.sm,paddingVertical:6,color:colors.text,textAlignVertical:"center"},
  sendButton:{width:37,height:37,borderRadius:19,backgroundColor:colors.primary,
    alignItems:"center",justifyContent:"center"},
  sendButtonDisabled:{backgroundColor:"#ACBDD6"},
  replyBanner:{minHeight:34,alignItems:"center",gap:spacing.sm,
    paddingHorizontal:spacing.sm,paddingBottom:spacing.sm},
  cancelReplyButton:{height:28,width:28,alignItems:"center",justifyContent:"center"},
  avatar:{backgroundColor:colors.primarySoft},
  avatarFallback:{alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
});
