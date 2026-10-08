import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { VenueMediaPageDto, VenuePostDto, VenuePostVisibility } from "@leaguekick/contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import { MediaImagePicker } from "../../../../src/components/owner/media/MediaImagePicker";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../../src/components/ui/Screen";
import { TextField } from "../../../../src/components/ui/TextField";
import { ownerApi, resolveMediaImageUrl } from "../../../../src/lib/api";
import { formatLocalDateTimeParts, formatPostTimeAgo } from "../../../../src/lib/date-time";
import { usePostTimeNow } from "../../../../src/hooks/usePostTimeNow";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

type Filter="ALL"|"PUBLISHED"|"DRAFT"|"SCHEDULED"|"PRIVATE";

function isPendingSchedule(post:VenuePostDto){
  return post.schedules.some((item)=>!item.executedAt&&!item.cancelledAt);
}

export default function OwnerPostsScreen(){
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const postNow=usePostTimeNow();
  const [items,setItems]=useState<VenuePostDto[]>([]);
  const [page,setPage]=useState<VenueMediaPageDto|null>(null);
  const [filter,setFilter]=useState<Filter>("ALL");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [editingPage,setEditingPage]=useState(false);
  const [pageSaving,setPageSaving]=useState(false);
  const [profileDraft,setProfileDraft]=useState("");
  const [coverDraft,setCoverDraft]=useState("");
  const [bioDraft,setBioDraft]=useState("");

  const load=useCallback(async()=>{
    if(!session)return;
    setLoading(true);setError(null);
    try{
      const [posts,pageResult]=await Promise.all([
        ownerApi.posts(session.accessToken),
        ownerApi.mediaPage(session.accessToken),
      ]);
      setItems(posts.posts);
      setPage(pageResult.page);
      if(!editingPage){
        setProfileDraft(pageResult.page.pageProfileImageUrl??"");
        setCoverDraft(pageResult.page.pageCoverImageUrl??"");
        setBioDraft(pageResult.page.pageBio??"");
      }
    }catch{
      setError(t("media.loadError"));
    }finally{setLoading(false);}
  },[editingPage,session,t]);

  useFocusEffect(useCallback(()=>{void load();},[load]));

  const visible=useMemo(()=>items.filter((item)=>{
    if(filter==="ALL")return true;
    if(filter==="PUBLISHED")return item.status==="PUBLISHED"&&item.visibility!=="PRIVATE";
    if(filter==="DRAFT")return item.status==="UNPUBLISHED"&&!isPendingSchedule(item);
    if(filter==="SCHEDULED")return isPendingSchedule(item);
    return item.visibility==="PRIVATE";
  }),[filter,items]);

  const stats=useMemo(()=>({
    published:items.filter((item)=>item.status==="PUBLISHED"&&item.visibility!=="PRIVATE").length,
    scheduled:items.filter(isPendingSchedule).length,
    drafts:items.filter((item)=>item.status==="UNPUBLISHED"&&!isPendingSchedule(item)).length,
  }),[items]);

  function startPageEdit(){
    if(!page)return;
    setProfileDraft(page.pageProfileImageUrl??"");
    setCoverDraft(page.pageCoverImageUrl??"");
    setBioDraft(page.pageBio??"");
    setEditingPage(true);
  }

  async function savePage(){
    if(!session||!page||pageSaving)return;
    setPageSaving(true);setError(null);
    try{
      const result=await ownerApi.updateMediaPage(session.accessToken,{
        pageProfileImageUrl:profileDraft||null,
        pageCoverImageUrl:coverDraft||null,
        pageBio:bioDraft.trim()||null,
      });
      setPage(result.page);
      setEditingPage(false);
    }catch{
      setError(t("media.pageSaveError"));
    }finally{setPageSaving(false);}
  }

  async function toggle(item:VenuePostDto){
    if(!session||busy)return;
    setBusy(item.id);setError(null);
    try{
      if(item.status==="PUBLISHED")await ownerApi.unpublishPost(session.accessToken,item.id);
      else await ownerApi.publishPost(session.accessToken,item.id);
      await load();
    }catch{setError(t("media.statusError"));}
    finally{setBusy(null);}
  }

  async function setVisibility(item:VenuePostDto,visibility:VenuePostVisibility){
    if(!session||busy||item.visibility===visibility)return;
    setBusy(item.id);setError(null);
    try{
      await ownerApi.setPostVisibility(session.accessToken,item.id,visibility);
      await load();
    }catch{setError(t("media.visibilityError"));}
    finally{setBusy(null);}
  }

  async function remove(item:VenuePostDto){
    if(!session||busy)return;
    setBusy(item.id);setError(null);
    try{
      await ownerApi.deletePost(session.accessToken,item.id);
      setItems((current)=>current.filter((value)=>value.id!==item.id));
      setPage((current)=>current?{...current,postCount:Math.max(0,current.postCount-1)}:current);
    }catch{setError(t("media.deleteError"));}
    finally{setBusy(null);}
  }

  function confirmDelete(item:VenuePostDto){
    Alert.alert(
      t("media.deleteTitle"),
      t("media.deleteBody"),
      [
        {text:t("common.cancel"),style:"cancel"},
        {text:t("media.delete"),style:"destructive",onPress:()=>void remove(item)},
      ],
    );
  }

  async function cancelSchedule(item:VenuePostDto,scheduleId:string){
    if(!session||busy)return;
    setBusy(item.id);setError(null);
    try{
      await ownerApi.cancelPostSchedule(session.accessToken,item.id,scheduleId);
      await load();
    }catch{setError(t("media.scheduleCancelError"));}
    finally{setBusy(null);}
  }

  if(loading)return <Screen embedded><DataLoadingState variant="dashboard" minHeight={650}/></Screen>;

  const profileImage=resolveMediaImageUrl(page?.pageProfileImageUrl);
  const coverImage=resolveMediaImageUrl(page?.pageCoverImageUrl);
  const initials=page?.name.trim().slice(0,2).toUpperCase()||"FT";

  return <Screen embedded style={styles.screen}>
    {page?<View style={styles.pageCard}>
      <View style={styles.cover}>
        {coverImage?<Image source={{uri:coverImage}} style={StyleSheet.absoluteFill} resizeMode="cover"/>
          :<View style={styles.coverFallback}>
            <Ionicons name="images-outline" size={42} color="#BFDBFE"/>
            <AppText style={{color:"#DBEAFE"}}>{t("media.addCover")}</AppText>
          </View>}
        <Pressable onPress={startPageEdit} style={styles.coverEdit}>
          <Ionicons name="camera" size={18} color={colors.text}/>
          <AppText variant="caption" weight="bold">{t("media.editCover")}</AppText>
        </Pressable>
      </View>

      <View style={styles.identityArea}>
        <View style={styles.avatarFrame}>
          {profileImage?<Image source={{uri:profileImage}} style={styles.avatar} resizeMode="cover"/>
            :<View style={[styles.avatar,styles.avatarFallback]}><AppText variant="title" weight="bold" style={{color:colors.primary}}>{initials}</AppText></View>}
          <Pressable onPress={startPageEdit} style={styles.avatarCamera}>
            <Ionicons name="camera" size={17} color="#FFFFFF"/>
          </Pressable>
        </View>

        <View style={styles.pageCopy}>
          <AppText variant="title" weight="bold" style={{textAlign:"center"}}>{page.name}</AppText>
          <View style={[styles.pageMeta,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <AppText variant="caption" muted>{t("social.followers",{count:page.followerCount})}</AppText>
            <View style={styles.dot}/>
            <AppText variant="caption" muted>{t("media.postsCount",{count:page.postCount})}</AppText>
          </View>
          <AppText variant="caption" muted>{page.city}, {page.province}</AppText>
          {page.pageBio?<AppText style={styles.bio}>{page.pageBio}</AppText>
            :<Pressable onPress={startPageEdit}><AppText variant="caption" weight="semibold" style={{color:colors.primary}}>{t("media.addBio")}</AppText></Pressable>}
        </View>

        <View style={[styles.pageActions,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Button
            label={t("media.viewPage")}
            onPress={()=>router.push({pathname:"/venues/[venueId]",params:{venueId:page.venueId}})}
            variant="secondary"
            style={{flex:1}}
          />
          <Button label={t("media.editPage")} onPress={startPageEdit} style={{flex:1}}/>
        </View>
      </View>
    </View>:null}

    {editingPage&&session?<Card style={styles.pageEditor}>
      <View style={[styles.sectionTitle,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.sectionIcon}><Ionicons name="color-wand-outline" size={20} color={colors.primary}/></View>
        <View style={{flex:1}}>
          <AppText variant="bodyLarge" weight="bold">{t("media.pageAppearance")}</AppText>
          <AppText variant="caption" muted>{t("media.pageAppearanceHint")}</AppText>
        </View>
      </View>

      <MediaImagePicker
        accessToken={session.accessToken}
        purpose="COVER"
        label={t("media.coverPhoto")}
        value={coverDraft}
        onChange={setCoverDraft}
        variant="cover"
        disabled={pageSaving}
      />
      <View style={styles.divider}/>
      <MediaImagePicker
        accessToken={session.accessToken}
        purpose="PROFILE"
        label={t("media.profilePhoto")}
        value={profileDraft}
        onChange={setProfileDraft}
        variant="profile"
        disabled={pageSaving}
      />
      <TextField
        label={t("media.pageBio")}
        value={bioDraft}
        onChangeText={setBioDraft}
        multiline
        maxLength={500}
        placeholder={t("media.pageBioPlaceholder")}
      />
      <View style={[styles.editorActions,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Button label={t("common.cancel")} variant="secondary" onPress={()=>setEditingPage(false)} style={{flex:1}}/>
        <Button label={t("common.save")} onPress={()=>void savePage()} loading={pageSaving} style={{flex:1}}/>
      </View>
    </Card>:null}

    {error?<Card style={styles.errorCard}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} onPress={()=>void load()} variant="secondary"/>
    </Card>:null}

    <Card style={styles.composer}>
      <View style={[styles.composerTop,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {profileImage?<Image source={{uri:profileImage}} style={styles.composerAvatar}/>
          :<View style={[styles.composerAvatar,styles.avatarFallback]}><AppText weight="bold" style={{color:colors.primary}}>{initials}</AppText></View>}
        <Pressable
          onPress={()=>router.push("/owner/posts/create")}
          style={({pressed})=>[styles.composerPrompt,pressed&&styles.pressed]}
        >
          <AppText muted>{t("media.composerPrompt")}</AppText>
        </Pressable>
      </View>
      <View style={styles.divider}/>
      <View style={[styles.quickActions,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <ComposerAction icon="image-outline" label={t("media.photo")} onPress={()=>router.push("/owner/posts/create")}/>
        <ComposerAction icon="trophy-outline" label={t("media.competitionShortcut")} onPress={()=>router.push({pathname:"/owner/posts/create",params:{type:"COMPETITION"}})}/>
        <ComposerAction icon="pricetag-outline" label={t("media.discountShortcut")} onPress={()=>router.push({pathname:"/owner/posts/create",params:{type:"PROMOTION"}})}/>
        <ComposerAction icon="football-outline" label={t("media.resultShortcut")} onPress={()=>router.push({pathname:"/owner/posts/create",params:{type:"RESULT"}})}/>
      </View>
    </Card>

    <View style={styles.insights}>
      <Insight icon="eye-outline" value={stats.published} label={t("media.stat.public")}/>
      <Insight icon="time-outline" value={stats.scheduled} label={t("media.stat.scheduled")}/>
      <Insight icon="document-text-outline" value={stats.drafts} label={t("media.filter.DRAFT")}/>
      <Insight icon="people-outline" value={page?.followerCount??0} label={t("media.followers")}/>
    </View>

    <View style={[styles.tabs,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {(["ALL","PUBLISHED","DRAFT","SCHEDULED","PRIVATE"] as const).map((value)=><Pressable
        key={value}
        onPress={()=>setFilter(value)}
        style={[styles.tab,filter===value&&styles.tabActive]}
      >
        <AppText variant="caption" weight={filter===value?"bold":"semibold"} style={filter===value?styles.tabTextActive:undefined}>
          {t(`media.filter.${value}` as never)}
        </AppText>
      </Pressable>)}
    </View>

    {!visible.length?<Card style={styles.emptyCard}>
      <View style={styles.emptyIcon}><Ionicons name="newspaper-outline" size={30} color={colors.primary}/></View>
      <AppText variant="bodyLarge" weight="bold">{t("media.emptyTitle")}</AppText>
      <AppText muted style={{textAlign:"center"}}>{t("media.emptyBody")}</AppText>
      <Button label={t("media.createPost")} onPress={()=>router.push("/owner/posts/create")}/>
    </Card>:null}

    {visible.map((item)=><MediaPostCard
      key={item.id}
      item={item}
      page={page}
      busy={busy===item.id}
      language={language}
      isRTL={isRTL}
      postNow={postNow}
      t={t}
      onToggle={()=>void toggle(item)}
      onVisibility={(visibility)=>void setVisibility(item,visibility)}
      onEdit={()=>router.push({pathname:"/owner/posts/create",params:{postId:item.id}})}
      onDelete={()=>confirmDelete(item)}
      onCancelSchedule={(scheduleId)=>void cancelSchedule(item,scheduleId)}
    />)}
  </Screen>;
}

function ComposerAction({icon,label,onPress}:{icon:keyof typeof Ionicons.glyphMap;label:string;onPress:()=>void}){
  return <Pressable onPress={onPress} style={({pressed})=>[styles.quickAction,pressed&&styles.pressed]}>
    <Ionicons name={icon} size={21} color={colors.primary}/>
    <AppText variant="caption" weight="semibold" numberOfLines={1}>{label}</AppText>
  </Pressable>;
}

function Insight({icon,value,label}:{icon:keyof typeof Ionicons.glyphMap;value:number;label:string}){
  return <View style={styles.insight}>
    <View style={styles.insightIcon}><Ionicons name={icon} size={18} color={colors.primary}/></View>
    <AppText weight="bold">{value}</AppText>
    <AppText variant="caption" muted numberOfLines={1}>{label}</AppText>
  </View>;
}

function MediaPostCard({
  item,page,busy,language,isRTL,postNow,t,onToggle,onVisibility,onEdit,onDelete,onCancelSchedule,
}:{
  item:VenuePostDto;
  page:VenueMediaPageDto|null;
  busy:boolean;
  language:Parameters<typeof formatLocalDateTimeParts>[1];
  isRTL:boolean;
  postNow:number;
  t:(key:any,params?:Record<string,string|number>)=>string;
  onToggle:()=>void;
  onVisibility:(value:VenuePostVisibility)=>void;
  onEdit:()=>void;
  onDelete:()=>void;
  onCancelSchedule:(id:string)=>void;
}){
  const published=formatPostTimeAgo(item.publishedAt,language,postNow);
  const pending=item.schedules.filter((schedule)=>!schedule.executedAt&&!schedule.cancelledAt);
  const avatar=resolveMediaImageUrl(page?.pageProfileImageUrl);
  const postImage=resolveMediaImageUrl(item.imageUrl);
  const initials=(page?.name??item.venueName).trim().slice(0,2).toUpperCase();

  return <View style={styles.feedPost}>
    <View style={[styles.postHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {avatar?<Image source={{uri:avatar}} style={styles.postAvatar}/>
        :<View style={[styles.postAvatar,styles.avatarFallback]}><AppText variant="caption" weight="bold" style={{color:colors.primary}}>{initials}</AppText></View>}
      <View style={{flex:1,alignItems:isRTL?"flex-end":"flex-start",gap:2}}>
        <AppText weight="bold">{page?.name??item.venueName}</AppText>
        <View style={[styles.metaInline,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <AppText variant="caption" muted>{published}</AppText>
          <Ionicons
            name={item.visibility==="PUBLIC"?"earth-outline":item.visibility==="FOLLOWERS"?"people-outline":"lock-closed-outline"}
            size={13}
            color={colors.textMuted}
          />
          <AppText variant="caption" muted>{t(`media.visibility.${item.visibility}` as never)}</AppText>
        </View>
      </View>
      <Pressable onPress={onEdit} style={styles.moreButton}><Ionicons name="ellipsis-horizontal" size={22} color={colors.textMuted}/></Pressable>
    </View>

    <View style={styles.postBody}>
      <View style={styles.typePill}><AppText variant="caption" weight="bold" style={{color:colors.primary}}>{t(`media.type.${item.postType}` as never)}</AppText></View>
      <AppText>{item.body}</AppText>
    </View>

    {postImage?<Image source={{uri:postImage}} style={styles.postImage} resizeMode="cover"/>:null}

    <View style={[styles.postState,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={[styles.stateDot,{backgroundColor:item.status==="PUBLISHED"?colors.success:colors.warning}]}/>
      <AppText variant="caption" weight="semibold">{item.status==="PUBLISHED"?t("media.published"):t("media.unpublished")}</AppText>
      {pending.length?<AppText variant="caption" muted>· {t("media.automationCount",{count:pending.length})}</AppText>:null}
    </View>

    <View style={styles.divider}/>

    <View style={[styles.postActions,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {item.socialPostId?<PostAction icon="chatbubble-outline" label={t("social.comment")} onPress={()=>
        router.push({pathname:"/posts/[postId]/comments",params:{postId:item.socialPostId!}})
      }/>:null}
      <PostAction icon="create-outline" label={t("media.edit")} onPress={onEdit}/>
      <PostAction
        icon={item.status==="PUBLISHED"?"eye-off-outline":"eye-outline"}
        label={item.status==="PUBLISHED"?t("media.unpublish"):t("media.publish")}
        onPress={onToggle}
        disabled={busy}
      />
    </View>

    <View style={styles.managePanel}>
      <AppText variant="caption" weight="bold">{t("media.postManagement")}</AppText>
      <View style={[styles.visibilityRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {(["PUBLIC","FOLLOWERS","PRIVATE"] as const).map((value)=><Pressable
          key={value}
          disabled={busy}
          onPress={()=>onVisibility(value)}
          style={[styles.visibilityChip,item.visibility===value&&styles.visibilityChipActive]}
        >
          <AppText variant="caption" weight="semibold" style={item.visibility===value?{color:colors.primary}:undefined}>
            {t(`media.visibility.${value}` as never)}
          </AppText>
        </Pressable>)}
      </View>

      {pending.length?<View style={styles.automationBox}>
        {pending.map((schedule)=>{
          const time=formatLocalDateTimeParts(schedule.executeAt,language);
          return <View key={schedule.id} style={[styles.scheduleRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Ionicons name="time-outline" size={17} color={colors.primary}/>
            <View style={{flex:1}}>
              <AppText variant="caption" weight="semibold">{t(`media.action.${schedule.action}` as never)}</AppText>
              <AppText variant="caption" muted>{time.date} · {time.time}</AppText>
            </View>
            <Pressable disabled={busy} onPress={()=>onCancelSchedule(schedule.id)}>
              <AppText variant="caption" weight="bold" style={{color:colors.danger}}>{t("common.cancel")}</AppText>
            </Pressable>
          </View>;
        })}
      </View>:null}

      <Pressable onPress={onDelete} style={({pressed})=>[styles.deleteAction,pressed&&styles.pressed]}>
        <Ionicons name="trash-outline" size={18} color={colors.danger}/>
        <AppText variant="caption" weight="bold" style={{color:colors.danger}}>{t("media.delete")}</AppText>
      </Pressable>
    </View>
  </View>;
}

function PostAction({
  icon,label,onPress,disabled=false,
}:{
  icon:keyof typeof Ionicons.glyphMap;
  label:string;
  onPress:()=>void;
  disabled?:boolean;
}){
  return <Pressable
    disabled={disabled}
    onPress={onPress}
    style={({pressed})=>[styles.postAction,pressed&&!disabled&&styles.postActionPressed,disabled&&{opacity:.5}]}
  >
    <Ionicons name={icon} size={20} color={colors.textMuted}/>
    <AppText variant="caption" weight="semibold">{label}</AppText>
  </Pressable>;
}

const styles=StyleSheet.create({
  screen:{gap:spacing.md,paddingHorizontal:0},
  pageCard:{backgroundColor:colors.surface,borderRadius:radius.lg,overflow:"hidden",borderWidth:1,borderColor:colors.border},
  cover:{height:190,backgroundColor:"#1D4ED8",position:"relative"},
  coverFallback:{flex:1,alignItems:"center",justifyContent:"center",gap:spacing.xs,backgroundColor:"#1E40AF"},
  coverEdit:{
    position:"absolute",right:spacing.sm,bottom:spacing.sm,
    minHeight:40,paddingHorizontal:spacing.sm,borderRadius:radius.md,
    backgroundColor:"rgba(255,255,255,.92)",flexDirection:"row",alignItems:"center",gap:spacing.xs,
  },
  identityArea:{alignItems:"center",paddingHorizontal:spacing.md,paddingBottom:spacing.md},
  avatarFrame:{width:118,height:118,borderRadius:59,marginTop:-54,padding:4,backgroundColor:"#FFFFFF",position:"relative"},
  avatar:{width:"100%",height:"100%",borderRadius:55},
  avatarFallback:{alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  avatarCamera:{position:"absolute",right:2,bottom:6,width:34,height:34,borderRadius:17,alignItems:"center",justifyContent:"center",backgroundColor:colors.primary,borderWidth:3,borderColor:"#FFFFFF"},
  pageCopy:{alignItems:"center",gap:4,marginTop:spacing.xs,maxWidth:560},
  pageMeta:{alignItems:"center",gap:spacing.xs},
  dot:{width:3,height:3,borderRadius:2,backgroundColor:colors.textMuted},
  bio:{textAlign:"center",marginTop:spacing.xs},
  pageActions:{width:"100%",gap:spacing.sm,marginTop:spacing.md},
  pageEditor:{gap:spacing.md,borderColor:"#BFDBFE",backgroundColor:"#F8FBFF"},
  sectionTitle:{alignItems:"center",gap:spacing.sm},
  sectionIcon:{width:40,height:40,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  editorActions:{gap:spacing.sm},
  errorCard:{borderColor:colors.danger},
  composer:{gap:spacing.md,padding:spacing.md},
  composerTop:{alignItems:"center",gap:spacing.sm},
  composerAvatar:{width:46,height:46,borderRadius:23},
  composerPrompt:{flex:1,minHeight:46,borderRadius:23,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surfaceMuted,justifyContent:"center",paddingHorizontal:spacing.md},
  quickActions:{gap:2},
  quickAction:{flex:1,minHeight:56,alignItems:"center",justifyContent:"center",gap:4,borderRadius:radius.md},
  pressed:{opacity:.7},
  divider:{height:1,backgroundColor:colors.border},
  insights:{flexDirection:"row",gap:spacing.xs,flexWrap:"wrap"},
  insight:{minWidth:"23%",flexGrow:1,alignItems:"center",paddingVertical:spacing.sm,paddingHorizontal:spacing.xs,borderRadius:radius.md,backgroundColor:colors.surface,gap:2,borderWidth:1,borderColor:colors.border},
  insightIcon:{width:30,height:30,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  tabs:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:4,gap:2,flexWrap:"wrap"},
  tab:{flexGrow:1,minHeight:40,paddingHorizontal:spacing.sm,alignItems:"center",justifyContent:"center",borderRadius:radius.sm},
  tabActive:{backgroundColor:colors.primarySoft},
  tabTextActive:{color:colors.primary},
  emptyCard:{alignItems:"center",gap:spacing.sm,padding:spacing.xl},
  emptyIcon:{width:56,height:56,borderRadius:28,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  feedPost:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,overflow:"hidden"},
  postHeader:{padding:spacing.md,alignItems:"center",gap:spacing.sm},
  postAvatar:{width:46,height:46,borderRadius:23},
  metaInline:{alignItems:"center",gap:4,flexWrap:"wrap"},
  moreButton:{width:40,height:40,borderRadius:20,alignItems:"center",justifyContent:"center",backgroundColor:colors.surfaceMuted},
  postBody:{paddingHorizontal:spacing.md,paddingBottom:spacing.md,gap:spacing.sm},
  typePill:{alignSelf:"flex-start",paddingHorizontal:spacing.sm,paddingVertical:4,borderRadius:radius.pill,backgroundColor:colors.primarySoft},
  postImage:{width:"100%",height:280,backgroundColor:colors.surfaceMuted},
  postState:{paddingHorizontal:spacing.md,paddingVertical:spacing.sm,alignItems:"center",gap:spacing.xs},
  stateDot:{width:7,height:7,borderRadius:4},
  postActions:{paddingHorizontal:spacing.sm,paddingVertical:4,gap:2},
  postAction:{flex:1,minHeight:44,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:spacing.xs,borderRadius:radius.md},
  postActionPressed:{backgroundColor:colors.surfaceMuted},
  managePanel:{margin:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:"#F8FAFC",gap:spacing.sm},
  visibilityRow:{gap:spacing.xs,flexWrap:"wrap"},
  visibilityChip:{minHeight:34,paddingHorizontal:spacing.sm,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,alignItems:"center",justifyContent:"center"},
  visibilityChipActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  automationBox:{gap:spacing.sm},
  scheduleRow:{alignItems:"center",gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surface},
  deleteAction:{minHeight:40,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:spacing.xs,borderRadius:radius.md,backgroundColor:"#FEF2F2"},
});
