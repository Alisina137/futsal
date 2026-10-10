import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { SocialFeedPostDto } from "@leaguekick/contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { marketingApi, resolveMediaImageUrl } from "../../../src/lib/api";
import { formatPostTimeAgo } from "../../../src/lib/date-time";
import { OptimisticSocialLikes } from "../../../src/lib/optimistic-social-likes";
import { usePostTimeNow } from "../../../src/hooks/usePostTimeNow";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

type T = ReturnType<typeof useLocale>["t"];

export default function HomeScreen(){
  return <SocialHome/>;
}

/** The shared social-first Home, including for people who are venue owners. */
function SocialHome(){
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const postNow=usePostTimeNow();
  const [items,setItems]=useState<SocialFeedPostDto[]>([]);
  const [hiddenIds,setHiddenIds]=useState<string[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadedOnce,setLoadedOnce]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [likeErrors,setLikeErrors]=useState<Record<string,boolean>>({});
  const token=session?.accessToken??"";
  const currentTokenRef=useRef(token);
  currentTokenRef.current=token;
  const likes=useMemo(()=>new OptimisticSocialLikes(
    async(id,nextLiked)=>{
      const {post}=nextLiked
        ?await marketingApi.likeSocialPost(token,id)
        :await marketingApi.unlikeSocialPost(token,id);
      return {likedByMe:post.likedByMe,likeCount:post.likeCount};
    },
    (id,snapshot)=>{
      if(currentTokenRef.current!==token)return;
      setItems(current=>current.map(item=>item.id===id?{...item,...snapshot}:item));
    },
    id=>{
      if(currentTokenRef.current!==token)return;
      setLikeErrors(current=>({...current,[id]:true}));
    },
  ),[token]);

  const load=useCallback(async(refresh=false)=>{
    if(!session)return;
    if(refresh)setRefreshing(true);
    else if(!loadedOnce)setLoading(true);
    setError(null);
    const startedAtVersion=likes.version;
    try{
      const fresh=await marketingApi.socialFeed(session.accessToken);
      if(currentTokenRef.current!==session.accessToken)return;
      setItems(likes.mergeFeed(fresh.items,startedAtVersion));
    }catch{
      setError(t("social.feedLoadError"));
    }finally{
      setLoadedOnce(true);
      setLoading(false);
      setRefreshing(false);
    }
  },[loadedOnce,session,t,likes]);

  useFocusEffect(useCallback(()=>{void load();},[load]));

  function togglePostLike(post:SocialFeedPostDto){
    if(!token)return;
    setLikeErrors(current=>{
      if(!current[post.id])return current;
      const next={...current};delete next[post.id];return next;
    });
    // Optimistically update BOTH button and count before any network request resolves.
    likes.toggle(post);
  }

  function removePost(id:string){setItems(current=>current.filter(item=>item.id!==id));}

  const visible=items.filter(post=>!hiddenIds.includes(post.id));
  // These are real photo posts, not fabricated stories or expiring status media.
  const moments=visible.filter(post=>Boolean(post.imageUrl)).slice(0,12);

  return <Screen showHeader publicNav
    style={styles.feedContent}
    refreshing={refreshing}
    onRefresh={()=>void load(true)}
  >
    <View style={styles.composer}>
      <View style={[styles.composerRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <UserAvatar imageUrl={session?.user.profileImageUrl} name={session?.user.displayName??"F"} size={44}/>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("social.composerPrompt")}
          onPress={()=>router.push("/posts/create")}
          style={({pressed})=>[styles.composerInput,pressed&&styles.pressed]}
        >
          <AppText numberOfLines={1} style={{color:colors.text}}>{t("social.composerPrompt")}</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t("social.addPhoto")}
          onPress={()=>router.push("/posts/create")} style={styles.quickPhoto}>
          <Ionicons name="images" size={24} color="#16A34A"/>
          <AppText variant="caption" weight="medium">{t("social.addPhoto")}</AppText>
        </Pressable>
      </View>
    </View>

    <View style={styles.divider}/>

    <View style={styles.moments}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.momentsRow,{flexDirection:isRTL?"row-reverse":"row"}]}
      >
        <Pressable accessibilityRole="button" accessibilityLabel={t("social.createMoment")}
          onPress={()=>router.push("/posts/create")}
          style={[styles.storyCard,styles.createStory]}
        >
          <View style={styles.createStoryImage}>
            <UserAvatar imageUrl={session?.user.profileImageUrl} name={session?.user.displayName??"F"} size={62}/>
          </View>
          <View style={styles.storyPlus}><Ionicons name="add" color="#FFFFFF" size={23}/></View>
          <AppText weight="semibold" variant="caption" numberOfLines={2} style={styles.createStoryTitle}>
            {t("social.createMoment")}
          </AppText>
        </Pressable>

        {moments.map(post=><Pressable
          key={post.id}
          accessibilityRole="button"
          accessibilityLabel={post.authorName}
          onPress={()=>router.push({pathname:"/posts/[postId]/comments",params:{postId:post.id}})}
          style={styles.storyCard}
        >
          <Image source={{uri:resolveMediaImageUrl(post.imageUrl)!}} style={styles.storyPhoto} resizeMode="cover"/>
          <View style={styles.storyOverlay}/>
          <View style={styles.storyAvatar}><UserAvatar imageUrl={post.authorImageUrl} name={post.authorName} size={35}/></View>
          <AppText numberOfLines={2} weight="bold" variant="caption" style={styles.storyName}>{post.authorName}</AppText>
        </Pressable>)}

        {moments.length===0?<>
          <DiscoverMoment icon="football" label={t("booking.venuesTitle")} onPress={()=>router.push("/venues")}/>
          <DiscoverMoment icon="people" label={t("teams.title")} onPress={()=>router.push("/teams")}/>
          <DiscoverMoment icon="trophy" label={t("competition.title")} onPress={()=>router.push("/competitions")}/>
        </>:null}
      </ScrollView>
    </View>

    <View style={styles.divider}/>

    {error?<View style={styles.feedAlert}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary" onPress={()=>void load(true)}/>
    </View>:null}

    {loading?<DataLoadingState variant="list" minHeight={400}/>:null}

    {!loading&&!error&&visible.length===0?<Card style={styles.emptyCard}>
      <Ionicons name="people-outline" size={34} color={colors.primary}/>
      <AppText variant="bodyLarge" weight="bold">{t("social.emptyTitle")}</AppText>
      <AppText muted>{t("social.emptyBody")}</AppText>
      <View style={{gap:spacing.sm}}>
        <Button label={t("booking.venuesTitle")} onPress={()=>router.push("/venues")} variant="secondary"/>
        <Button label={t("teams.title")} onPress={()=>router.push("/teams")} variant="secondary"/>
        <Button label={t("competition.title")} onPress={()=>router.push("/competitions")} variant="secondary"/>
      </View>
    </Card>:null}

    {!loading?visible.map(post=><SocialPostCard
      key={post.id}
      post={post}
      token={session?.accessToken??""}
      userId={session?.user.id??""}
      isRTL={isRTL}
      language={language}
      postNow={postNow}
      t={t}
      onLike={()=>togglePostLike(post)}
      likeError={Boolean(likeErrors[post.id])}
      onHide={()=>setHiddenIds(ids=>[...ids,post.id])}
      onDelete={()=>removePost(post.id)}
    />):null}
  </Screen>;
}

function UserAvatar({imageUrl,name,size}:{imageUrl:string|null|undefined;name:string;size:number}){
  const uri=resolveMediaImageUrl(imageUrl);
  const circle={width:size,height:size,borderRadius:size/2};
  return uri?<Image source={{uri}} style={[styles.avatar,circle]}/>:
    <View style={[styles.avatarFallback,circle]}><AppText weight="bold" style={{color:colors.primary}}>
      {name.trim().slice(0,2).toUpperCase()||"FT"}
    </AppText></View>;
}

function DiscoverMoment({icon,label,onPress}:{icon:keyof typeof Ionicons.glyphMap;label:string;onPress:()=>void}){
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    style={[styles.storyCard,styles.discoverCard]} onPress={onPress}>
    <View style={styles.discoverGlyph}><Ionicons name={icon} size={40} color={colors.primary}/></View>
    <AppText variant="caption" weight="bold" style={styles.discoverName}>{label}</AppText>
  </Pressable>;
}

function SocialPostCard({
  post,token,userId,isRTL,language,postNow,t,onLike,likeError,onHide,onDelete,
}:{
  post:SocialFeedPostDto;
  token:string;
  userId:string;
  isRTL:boolean;
  language:Parameters<typeof formatPostTimeAgo>[1];
  postNow:number;
  t:T;
  onLike:()=>void;
  likeError:boolean;
  onHide:()=>void;
  onDelete:()=>void;
}){
  const [menuOpen,setMenuOpen]=useState(false);
  const [deleting,setDeleting]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const [imageOpen,setImageOpen]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const mine=post.authorType==="USER"&&post.authorId===userId;
  const published=formatPostTimeAgo(post.publishedAt,language,postNow);
  const image=resolveMediaImageUrl(post.imageUrl);

  function openAuthor(){
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

  function toggleLike(){
    if(!token)return;
    setError(null);
    onLike();
  }

  function openComments(){
    router.push({pathname:"/posts/[postId]/comments",params:{postId:post.id}});
  }

  async function sharePost(){
    try{await Share.share({message:`${post.authorName}\n\n${post.body}\n\nFutsal`});}
    catch{setError(t("social.shareError"));}
  }

  async function deleteOwnPost(){
    if(deleting)return;
    setDeleting(true);setMenuOpen(false);setError(null);
    try{
      await marketingApi.deleteUserPost(token,post.id);
      onDelete();
    }catch{setError(t("social.deletePostError"));}
    finally{setDeleting(false);}
  }

  function confirmDelete(){
    setMenuOpen(false);
    Alert.alert(t("social.deletePostTitle"),t("social.deletePostBody"),[
      {text:t("common.cancel"),style:"cancel"},
      {text:t("social.deletePost"),style:"destructive",onPress:()=>void deleteOwnPost()},
    ]);
  }

  return <View style={styles.postCard}>
    <View style={[styles.authorRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={post.authorName} onPress={openAuthor}>
        <UserAvatar imageUrl={post.authorImageUrl} name={post.authorName} size={45}/>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={openAuthor}
        style={[styles.authorCopy,{alignItems:isRTL?"flex-end":"flex-start"}]}>
        <AppText weight="bold" numberOfLines={1} style={styles.authorName}>{post.authorName}</AppText>
        <View style={[styles.postMeta,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <AppText variant="caption" muted>{published}</AppText>
          <AppText variant="caption" muted> · </AppText>
          <Ionicons name="earth-outline" color={colors.textMuted} size={13}/>
          <AppText variant="caption" muted>{t(`social.entity.${post.authorType}` as never)}</AppText>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t("social.postOptions")}
        onPress={()=>setMenuOpen(value=>!value)} style={styles.menuTrigger}>
        <Ionicons name="ellipsis-horizontal" size={23} color={colors.textMuted}/>
      </Pressable>
    </View>

    {menuOpen?<View style={[styles.postMenu,{alignItems:isRTL?"flex-end":"flex-start"}]}>
      <Pressable accessibilityRole="button" onPress={()=>{onHide();setMenuOpen(false);}} style={styles.postMenuButton}>
        <Ionicons name="eye-off-outline" size={19} color={colors.text}/>
        <AppText>{t("social.hidePost")}</AppText>
      </Pressable>
      {mine?<Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.postMenuButton} disabled={deleting}>
        <Ionicons name="trash-outline" size={19} color={colors.danger}/>
        <AppText style={{color:colors.danger}}>{t("social.deletePost")}</AppText>
      </Pressable>:null}
    </View>:null}

    {post.body?<>
      <AppText numberOfLines={expanded?undefined:5} style={styles.postBody}>{post.body}</AppText>
      {post.body.length>220&&!expanded?<Pressable accessibilityRole="button" onPress={()=>setExpanded(true)} style={styles.seeMore}>
        <AppText weight="semibold" style={{color:colors.textMuted}}>{t("social.seeMore")}</AppText>
      </Pressable>:null}
    </>:null}

    {image?<Pressable accessibilityRole="button" accessibilityLabel={t("social.openPhoto")}
      onPress={()=>setImageOpen(true)} style={styles.imageContainer}>
      <Image source={{uri:image}} style={styles.postImage} resizeMode="cover"/>
    </Pressable>:null}

    <View style={[styles.countRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Pressable accessibilityRole="button" onPress={toggleLike} style={styles.likesGroup}>
        <View style={styles.likeBubble}><Ionicons name="thumbs-up" size={11} color="#FFFFFF"/></View>
        <AppText variant="caption" muted>{t("social.likes",{count:post.likeCount})}</AppText>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={openComments}>
        <AppText variant="caption" muted>{t("social.comments",{count:post.commentCount})}</AppText>
      </Pressable>
    </View>
    <View style={styles.dividerLine}/>

    <View style={[styles.socialActions,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <SocialAction icon={post.likedByMe?"thumbs-up":"thumbs-up-outline"}
        label={t("social.like")} active={post.likedByMe} onPress={toggleLike}/>
      <SocialAction icon="chatbubble-outline" label={t("social.comment")} onPress={openComments}/>
      <SocialAction icon="share-social-outline" label={t("social.share")} onPress={()=>void sharePost()}/>
    </View>
    {likeError?<AppText variant="caption" accessibilityRole="alert" style={styles.postError}>{t("social.likeError")}</AppText>:null}
    {error?<AppText variant="caption" accessibilityRole="alert" style={styles.postError}>{error}</AppText>:null}
    {imageOpen&&image?<Modal visible transparent animationType="fade" statusBarTranslucent
      onRequestClose={()=>setImageOpen(false)}>
      <View style={styles.photoModal}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")}
          onPress={()=>setImageOpen(false)} style={styles.photoClose}>
          <Ionicons name="close" color="#FFFFFF" size={26}/>
        </Pressable>
        <Image source={{uri:image}} style={styles.photoFullscreen} resizeMode="contain"/>
      </View>
    </Modal>:null}
  </View>;
}

function SocialAction({icon,label,active=false,onPress}:{
  icon:keyof typeof Ionicons.glyphMap;label:string;active?:boolean;onPress:()=>void;
}){
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{selected:active}}
    onPress={onPress}
    style={({pressed})=>[styles.socialAction,pressed&&styles.pressed]}>
    <Ionicons name={icon} size={19} color={active?colors.primary:colors.textMuted}/>
    <AppText variant="caption" weight="semibold" style={active?{color:colors.primary}:undefined}>{label}</AppText>
  </Pressable>;
}

const styles=StyleSheet.create({
  feedContent:{paddingHorizontal:0,paddingTop:0,gap:0,backgroundColor:"#EDF1F6"},
  composer:{backgroundColor:colors.surface,paddingHorizontal:spacing.md,paddingVertical:spacing.md},
  composerRow:{alignItems:"center",gap:spacing.sm},
  composerInput:{flex:1,minHeight:43,borderWidth:1,borderColor:"#E4E9F1",borderRadius:radius.pill,
    paddingHorizontal:spacing.md,justifyContent:"center",backgroundColor:"#F7F9FC"},
  quickPhoto:{minWidth:55,alignItems:"center",justifyContent:"center",gap:2},
  avatar:{backgroundColor:colors.primarySoft},
  avatarFallback:{backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"},
  divider:{height:9,backgroundColor:"#EDF1F6"},
  moments:{backgroundColor:colors.surface,paddingVertical:spacing.sm,gap:spacing.sm},
  momentsRow:{paddingHorizontal:spacing.md,gap:spacing.sm,paddingBottom:spacing.sm},
  storyCard:{height:182,width:123,borderRadius:radius.md,overflow:"hidden",backgroundColor:"#E4EDFA",
    borderWidth:1,borderColor:"#DFE6F1"},
  createStory:{backgroundColor:colors.surface,alignItems:"center"},
  createStoryImage:{height:110,width:"100%",justifyContent:"center",alignItems:"center",backgroundColor:colors.primarySoft},
  storyPlus:{width:38,height:38,backgroundColor:colors.primary,borderRadius:19,marginTop:-19,
    alignItems:"center",justifyContent:"center",borderWidth:3,borderColor:colors.surface},
  createStoryTitle:{textAlign:"center",paddingHorizontal:6,marginTop:spacing.xs},
  storyPhoto:{position:"absolute",top:0,bottom:0,left:0,right:0,width:"100%",height:"100%"},
  storyOverlay:{position:"absolute",top:0,bottom:0,left:0,right:0,backgroundColor:"rgba(0,0,0,.25)"},
  storyAvatar:{position:"absolute",top:spacing.sm,left:spacing.sm,borderWidth:2,borderRadius:24,borderColor:colors.primary},
  storyName:{position:"absolute",bottom:spacing.sm,left:spacing.sm,right:spacing.sm,color:"#FFFFFF",
    textShadowColor:"rgba(0,0,0,.8)",textShadowOffset:{width:1,height:1},textShadowRadius:3},
  discoverCard:{padding:spacing.sm,justifyContent:"space-between",backgroundColor:colors.primarySoft},
  discoverGlyph:{flex:1,alignItems:"center",justifyContent:"center"},
  discoverName:{textAlign:"center",color:colors.primary,paddingBottom:spacing.sm},
  pressed:{opacity:.7},
  disabled:{opacity:.5},
  feedAlert:{padding:spacing.md,backgroundColor:colors.surface,gap:spacing.sm},
  emptyCard:{marginHorizontal:spacing.md,marginVertical:spacing.md,gap:spacing.md,padding:spacing.lg},
  postCard:{backgroundColor:colors.surface,marginBottom:9,paddingTop:spacing.md,paddingBottom:spacing.xs},
  authorRow:{paddingHorizontal:spacing.md,alignItems:"center",gap:spacing.sm,minHeight:48},
  authorCopy:{flex:1,gap:3},
  authorName:{fontSize:16},
  postMeta:{alignItems:"center",gap:3,flexWrap:"wrap"},
  menuTrigger:{width:42,height:42,alignItems:"center",justifyContent:"center"},
  postMenu:{paddingHorizontal:spacing.md,paddingVertical:spacing.sm,backgroundColor:"#F7F9FC",
    marginHorizontal:spacing.md,borderRadius:radius.md,marginTop:spacing.sm,gap:spacing.sm},
  postMenuButton:{minHeight:44,flexDirection:"row",gap:spacing.sm,alignItems:"center"},
  postBody:{fontSize:15,lineHeight:24,paddingHorizontal:spacing.md,paddingVertical:spacing.md},
  seeMore:{alignSelf:"flex-start",paddingHorizontal:spacing.md,paddingBottom:spacing.sm},
  imageContainer:{width:"100%",overflow:"hidden",backgroundColor:colors.surfaceMuted},
  postImage:{width:"100%",height:305},
  countRow:{paddingHorizontal:spacing.md,paddingVertical:spacing.sm,
    alignItems:"center",justifyContent:"space-between",minHeight:41},
  likesGroup:{flexDirection:"row",alignItems:"center",gap:6},
  likeBubble:{width:20,height:20,borderRadius:10,backgroundColor:colors.primary,
    alignItems:"center",justifyContent:"center"},
  dividerLine:{height:1,marginHorizontal:spacing.md,backgroundColor:colors.border},
  socialActions:{minHeight:51,alignItems:"center",paddingHorizontal:spacing.sm},
  socialAction:{flex:1,minHeight:47,flexDirection:"row",gap:spacing.xs,
    alignItems:"center",justifyContent:"center"},
  postError:{paddingHorizontal:spacing.md,color:colors.danger},
  photoModal:{flex:1,backgroundColor:"#080B15",justifyContent:"center"},
  photoClose:{position:"absolute",top:55,right:spacing.lg,zIndex:2,width:42,height:42,
    alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.17)",borderRadius:21},
  photoFullscreen:{width:"100%",height:"75%"},
});
