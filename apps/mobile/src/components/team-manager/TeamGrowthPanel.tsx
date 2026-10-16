import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {TeamDto,TeamDirectoryItemDto} from "@leaguekick/contracts";
import {router} from "expo-router";
import {useEffect,useRef,useState} from "react";
import {Image,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {ApiRequestError,marketingApi,resolveMediaImageUrl,teamApi,teamGrowthApi,
  type TeamGrowthData,type TeamGrowthPost} from "../../lib/api";
import {formatCompetitionDateTime} from "../../lib/date-time";
import {kabulDay} from "../../lib/team-manager-schedule";
import {analyticsSeasons,rankTeamPlayers,scopedTeamAnalytics,
  type AnalyticsFilters,type AnalyticsRange} from "../../lib/team-manager-analytics";
import {DirectoryFilterSelect} from "../social/DirectoryFilterSelect";
import {useLocale} from "../../providers/LocaleProvider";
import {useAuth} from "../../providers/AuthProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";
import {DateTimePickerField} from "../ui/DateTimePickerField";
import {TextField} from "../ui/TextField";

type Tab="media"|"statistics"|"matches";
function Counter({label,value}:{label:string;value:number|string}){
  return <View style={styles.stat}><AppText variant="title" weight="bold" style={{color:colors.primary}}>{value}</AppText>
    <AppText variant="caption" muted style={{textAlign:"center"}}>{label}</AppText></View>;
}
function Options({items,current,onChange}:{items:{id:string;name:string}[];current:string;onChange:(id:string)=>void}){
  const {isRTL}=useLocale();
  return <ScrollView horizontal contentContainerStyle={{gap:spacing.sm,alignItems:"center",flexDirection:isRTL?"row-reverse":"row"}} showsHorizontalScrollIndicator={false}>
    {items.map(item=><Pressable key={item.id} onPress={()=>onChange(item.id)}
      accessibilityRole="button" accessibilityState={{selected:current===item.id}}
      style={[styles.chip,item.id===current&&styles.active]}>
      <AppText variant="caption" weight="semibold" style={item.id===current?{color:colors.primary}:undefined}>{item.name}</AppText>
    </Pressable>)}
  </ScrollView>;
}

export function TeamGrowthPanel({tab,team,token,canWrite}:{tab:Tab;team:TeamDto;token:string;canWrite:boolean}){
  const {t,language,isRTL}=useLocale();
  const {session}=useAuth();
  const draftKey=session?.user.id?`@leaguekick:media-draft:v1:${session.user.id}:${team.id}`:null;
  const draftKeyRef=useRef(draftKey);
  draftKeyRef.current=draftKey;
  const tr=(key:string)=>t(`tm3.${key}` as never);
  const date=(x:string)=>formatCompetitionDateTime(x,language);
  const [data,setData]=useState<TeamGrowthData|null>(null);
  const [loadedDataKey,setLoadedDataKey]=useState<string|null>(null);
  const [teams,setTeams]=useState<TeamDirectoryItemDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false),[uploading,setUploading]=useState(false);
  const [error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null);
  const [refresh,setRefresh]=useState(0);
  const [postBody,setPostBody]=useState("");
  const [imageUrl,setImageUrl]=useState<string|null>(null);
  const [postEditing,setPostEditing]=useState<string|null>(null);
  const [composerOpen,setComposerOpen]=useState(false);
  const [draftAvailable,setDraftAvailable]=useState(false);
  const [draftBusy,setDraftBusy]=useState(false);
  const [postFilter,setPostFilter]=useState<"ALL"|"PHOTOS"|"TEXT">("ALL");
  const [postQuery,setPostQuery]=useState("");
  const [announcementOpen,setAnnouncementOpen]=useState(false);
  const [announcementToDelete,setAnnouncementToDelete]=useState<string|null>(null);
  const [announcementTitle,setAnnouncementTitle]=useState("");
  const [announcementBody,setAnnouncementBody]=useState("");
  const [challengeTarget,setChallengeTarget]=useState("");
  const [challengeSearch,setChallengeSearch]=useState("");
  const [challengeTime,setChallengeTime]=useState("");
  const [challengeVenue,setChallengeVenue]=useState("");
  const [challengeMessage,setChallengeMessage]=useState("");
  const [showChallengeForm,setShowChallengeForm]=useState(false);
  const [challengeFilter,setChallengeFilter]=useState<"PENDING"|"ACCEPTED"|"HISTORY"|"ALL">("PENDING");
  const [cancelChallengeId,setCancelChallengeId]=useState<string|null>(null);
  const [mediaSection,setMediaSection]=useState<"POSTS"|"PHOTOS"|"ANNOUNCEMENTS">("POSTS");
  const [deleteCandidate,setDeleteCandidate]=useState<string|null>(null);
  const currentTeam=useRef(team.id);
  currentTeam.current=team.id;
  const [statSection,setStatSection]=useState<"PERFORMANCE"|"PLAYERS"|"TRENDS"|"HISTORY">("PERFORMANCE");
  const [statCompetition,setStatCompetition]=useState("ALL");
  const [statSeason,setStatSeason]=useState("ALL");
  const [statRange,setStatRange]=useState<AnalyticsRange>("ALL");
  const [statMetric,setStatMetric]=useState<"GOALS"|"ASSISTS"|"APPEARANCES">("GOALS");
  const [statSearch,setStatSearch]=useState("");

  // Never retain an editable post or uploaded photo when switching licensed teams.
  useEffect(()=>{
    setPostBody("");setImageUrl(null);setPostEditing(null);setDeleteCandidate(null);
    setComposerOpen(false);setDraftAvailable(false);setDraftBusy(false);
    setPostFilter("ALL");setPostQuery("");setAnnouncementOpen(false);setAnnouncementToDelete(null);
    setAnnouncementTitle("");setAnnouncementBody("");setUploading(false);setMediaSection("POSTS");
    setChallengeTarget("");setChallengeSearch("");setChallengeTime("");setChallengeVenue("");
    setChallengeMessage("");setShowChallengeForm(false);setChallengeFilter("PENDING");
    setCancelChallengeId(null);setTeams([]);setBusy(false);
    setData(null);setLoadedDataKey(null);
    setStatSection("PERFORMANCE");setStatCompetition("ALL");
    setStatSeason("ALL");setStatRange("ALL");setStatMetric("GOALS");
    setStatSearch("");
  },[team.id,draftKey]);
  useEffect(()=>{
    let active=true;setDraftAvailable(false);
    if(draftKey)void AsyncStorage.getItem(draftKey).then(value=>{
      if(active)setDraftAvailable(!!value);
    }).catch(()=>{});
    return()=>{active=false;};
  },[draftKey]);
  useEffect(()=>{
    let current=true;
    setLoading(true);setError(null);setData(null);setLoadedDataKey(null);
    void teamGrowthApi.list(token,team.id)
      .then(value=>{if(current){setData(value);setLoadedDataKey(draftKey);}})
      .catch(err=>{if(current){setData(null);setError(err instanceof ApiRequestError?err.message:t("tm3.loadError"));}})
      .finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[token,team.id,draftKey,refresh,t]);
  useEffect(()=>{
    if(tab!=="matches")return;
    let current=true;
    void teamApi.directory(token).then(v=>{if(current)setTeams(v.teams);}).catch(()=>{});
    return()=>{current=false;};
  },[tab,token,team.id]);

  async function execute(fn:()=>Promise<unknown>,after?:()=>void){
    if(busy)return;
    const teamAtStart=team.id,keyAtStart=draftKeyRef.current;
    const current=()=>currentTeam.current===teamAtStart&&draftKeyRef.current===keyAtStart;
    setBusy(true);setError(null);setMessage(null);
    try{
      await fn();
      if(!current())return;
      after?.();setMessage(t("tm3.saved"));setRefresh(v=>v+1);
    }catch(e){if(current())setError(e instanceof ApiRequestError?e.message:t("tm3.actionFailed"));}
    finally{if(current())setBusy(false);}
  }
  async function selectPhoto(){
    if(!canWrite||uploading)return;
    const selectedTeam=team.id;
    const draftAtStart=draftKeyRef.current;
    try{
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted){
        if(currentTeam.current===selectedTeam)setError(tr("photoPermission"));
        return;
      }
      const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],quality:0.8});
      if(result.canceled||!result.assets[0]||currentTeam.current!==selectedTeam||draftKeyRef.current!==draftAtStart)return;
      setUploading(true);setError(null);
      const asset=result.assets[0];
      const image=await marketingApi.uploadUserPostImage(token,{
        uri:asset.uri,mimeType:asset.mimeType??"image/jpeg",
        ...(asset.fileSize!==undefined?{size:asset.fileSize}:{}),
      });
      if(currentTeam.current===selectedTeam&&draftKeyRef.current===draftAtStart)setImageUrl(image.imageUrl);
    }catch(e){
      if(currentTeam.current===selectedTeam&&draftKeyRef.current===draftAtStart)
        setError(e instanceof ApiRequestError?e.message:t("tm3.uploadError"));
    }finally{if(currentTeam.current===selectedTeam&&draftKeyRef.current===draftAtStart)setUploading(false);}
  }
  async function selectFilePhoto(){
    if(!canWrite||uploading)return;
    const teamAtStart=team.id,keyAtStart=draftKeyRef.current;
    try{
      const file=await DocumentPicker.getDocumentAsync({type:"image/*",multiple:false,copyToCacheDirectory:true});
      if(file.canceled||!file.assets[0]||currentTeam.current!==teamAtStart||
        draftKeyRef.current!==keyAtStart)return;
      const asset=file.assets[0];
      setUploading(true);setError(null);
      const image=await marketingApi.uploadUserPostImage(token,{
        uri:asset.uri,mimeType:asset.mimeType??"image/jpeg",
        ...(asset.size!==undefined?{size:asset.size}:{}),
      });
      if(currentTeam.current===teamAtStart&&draftKeyRef.current===keyAtStart)
        setImageUrl(image.imageUrl);
    }catch(e){
      if(currentTeam.current===teamAtStart&&draftKeyRef.current===keyAtStart)
        setError(e instanceof ApiRequestError?e.message:t("tm3.uploadError"));
    }finally{
      if(currentTeam.current===teamAtStart&&draftKeyRef.current===keyAtStart)setUploading(false);
    }
  }
  function editPost(post:TeamGrowthPost){
    setPostEditing(post.id);setPostBody(post.body);setImageUrl(post.imageUrl);
    setComposerOpen(true);setMediaSection("POSTS");
  }
  function resetPost(){setPostBody("");setImageUrl(null);setPostEditing(null);}
  async function saveDraft(){
    if(!draftKey||draftBusy||(!postBody.trim()&&!imageUrl)||postEditing)return;
    setDraftBusy(true);setError(null);
    try{
      await AsyncStorage.setItem(draftKey,JSON.stringify({body:postBody.trim(),imageUrl}));
      if(draftKeyRef.current===draftKey){setDraftAvailable(true);setMessage(t("tm6.draftSaved"));}
    }catch{if(draftKeyRef.current===draftKey)setError(t("tm6.draftError"));}
    finally{if(draftKeyRef.current===draftKey)setDraftBusy(false);}
  }
  async function restoreDraft(){
    if(!draftKey||draftBusy)return;
    setDraftBusy(true);
    try{
      const stored=await AsyncStorage.getItem(draftKey);
      if(draftKeyRef.current!==draftKey)return;
      if(!stored){setDraftAvailable(false);return;}
      const content=JSON.parse(stored) as {body?:unknown;imageUrl?:unknown};
      setPostBody(typeof content.body==="string"?content.body.slice(0,2000):"");
      setImageUrl(typeof content.imageUrl==="string"?content.imageUrl:null);
      setPostEditing(null);setMediaSection("POSTS");setComposerOpen(true);
    }catch{if(draftKeyRef.current===draftKey)setError(t("tm6.draftError"));}
    finally{if(draftKeyRef.current===draftKey)setDraftBusy(false);}
  }
  async function discardDraft(){
    if(!draftKey||draftBusy)return;
    setDraftBusy(true);
    try{
      await AsyncStorage.removeItem(draftKey);
      if(draftKeyRef.current===draftKey){setDraftAvailable(false);setMessage(t("tm6.draftDiscarded"));}
    }catch{if(draftKeyRef.current===draftKey)setError(t("tm6.draftError"));}
    finally{if(draftKeyRef.current===draftKey)setDraftBusy(false);}
  }
  function newPost(){resetPost();setComposerOpen(true);setMediaSection("POSTS");}
  const shownPosts=(data?.posts??[]).filter(post=>
    (postFilter==="ALL"||postFilter==="PHOTOS"&&!!post.imageUrl||postFilter==="TEXT"&&!post.imageUrl)&&
    post.body.toLowerCase().includes(postQuery.trim().toLowerCase()));
  const analytics=data?.stats.analytics;
  const analyticsFilters:AnalyticsFilters={competitionId:statCompetition,season:statSeason,range:statRange};
  const scoped=analytics?scopedTeamAnalytics(analytics,team.id,analyticsFilters):null;
  // All-time is still shown on servers that predate detailed analytics.
  const statistics=scoped?.stats??data?.stats;
  const seasons=analytics?analyticsSeasons(analytics.matches):[];
  const filteredPlayers=rankTeamPlayers(scoped?.players??data?.stats.players??[],statMetric)
    .filter(player=>player.displayName.toLowerCase().includes(statSearch.trim().toLowerCase()));
  const statHistory=(data?.stats.competitionHistory??[]).filter(c=>
    (statCompetition==="ALL"||c.id===statCompetition)&&
    (statSeason==="ALL"&&statRange==="ALL"||
      !!scoped?.matchingCompetitionIds.has(c.id)));
  const filteredChallenges=data?.challenges.filter(c=>challengeFilter==="ALL"||
    challengeFilter==="HISTORY"&&["DECLINED","CANCELLED"].includes(c.status)||
    c.status===challengeFilter)??[];
  const discovery=teams.filter(item=>item.id!==team.id&&item.status==="ACTIVE"&&
    (!challengeSearch||item.name.toLowerCase().includes(challengeSearch.toLowerCase())||
      item.city.toLowerCase().includes(challengeSearch.toLowerCase()))).slice(0,30);

  return <View style={{gap:spacing.md}}>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary" onPress={()=>setRefresh(x=>x+1)}/></Card>:null}
    {message?<Card style={{backgroundColor:colors.primarySoft}}><AppText style={{color:colors.primary}}>{message}</AppText></Card>:null}
    {loading||loadedDataKey!==draftKey?<DataLoadingState variant="list" minHeight={300}/>:data?<>
      {tab==="media"?<>
        <Card testID="tm6-media-header" style={styles.mediaHeader}>
          <View style={[styles.mediaHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Ionicons name="megaphone-outline" color={colors.primary} size={24}/>
            <View style={{flex:1,gap:spacing.xs}}>
              <AppText variant="bodyLarge" weight="bold">{t("tm6.mediaTitle")}</AppText>
              <AppText variant="caption" muted>{t("tm6.mediaHelp")}</AppText>
            </View>
          </View>
          <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Button testID="tm6-new-post" label={tr("createPost")}
              disabled={!canWrite} onPress={newPost}/>
            {draftAvailable?<Button testID="tm6-restore-draft" variant="secondary"
              label={t("tm6.resumeDraft")} loading={draftBusy} onPress={()=>void restoreDraft()}/>:null}
          </View>
          {draftAvailable?<Button variant="ghost" label={t("tm6.discardDraft")}
            disabled={draftBusy} onPress={()=>void discardDraft()}/>:null}
          <AppText variant="caption" muted>{t("tm6.draftDeviceHint")}</AppText>
        </Card>
        <Options items={[{id:"POSTS",name:tr("publicPosts")},{id:"PHOTOS",name:tr("phase5Photos")},
          {id:"ANNOUNCEMENTS",name:tr("privateAnnouncements")}]}
          current={mediaSection} onChange={id=>setMediaSection(id as typeof mediaSection)}/>
        {mediaSection==="POSTS"?<>
          {composerOpen?<Card testID="tm6-post-composer">
            <AppText variant="bodyLarge" weight="bold">{postEditing?tr("editPost"):tr("createPost")}</AppText>
            <AppText variant="caption" muted>{tr("postHelp")}</AppText>
            <TextField label={tr("postBody")} value={postBody} multiline onChangeText={setPostBody} maxLength={2000}/>
            <AppText variant="caption" muted>{t("tm6.publicOnly")}</AppText>
            {imageUrl?<Image source={{uri:resolveMediaImageUrl(imageUrl)??imageUrl}} resizeMode="cover" style={styles.mediaImage}/>:null}
            <View style={styles.actions}>
              <Button label={tr("addPhoto")} variant="secondary" loading={uploading} disabled={!canWrite||busy}
                onPress={()=>void selectPhoto()}/>
              <Button label={t("tm6.chooseFiles")} variant="secondary" loading={uploading}
                disabled={!canWrite||busy} onPress={()=>void selectFilePhoto()}/>
              {imageUrl?<Button label={tr("removePhoto")} variant="ghost" onPress={()=>setImageUrl(null)}/>:null}
            </View>
            <Button testID="tm6-publish-now" label={postEditing?tr("savePost"):t("tm6.publishNow")} loading={busy}
              disabled={!canWrite||busy||uploading||(!postBody.trim()&&!imageUrl)}
              onPress={()=>void execute(async()=>{
                const input={body:postBody.trim(),imageUrl};
                if(postEditing)await teamGrowthApi.updatePost(token,team.id,postEditing,input);
                else await teamGrowthApi.createPost(token,team.id,input);
              },()=>{
                resetPost();setComposerOpen(false);
                if(!postEditing&&draftKey){
                  void AsyncStorage.removeItem(draftKey).then(()=>{
                    if(draftKeyRef.current===draftKey)setDraftAvailable(false);
                  }).catch(()=>{});
                }
              })}/>
            {!postEditing?<Button testID="tm6-save-draft" variant="secondary"
              label={t("tm6.saveDraft")} loading={draftBusy}
              disabled={!canWrite||draftBusy||busy||(!postBody.trim()&&!imageUrl)}
              onPress={()=>void saveDraft()}/>:null}
            <Button variant="ghost" label={t("common.cancel")}
              onPress={()=>{resetPost();setComposerOpen(false);}}/>
          </Card>:null}
          <Card testID="tm6-published-posts" style={styles.mediaList}>
            <AppText variant="bodyLarge" weight="bold">{tr("publishedPosts")} ({data.posts.length})</AppText>
            <TextField testID="tm6-post-search" label={t("tm6.searchPosts")}
              value={postQuery} onChangeText={setPostQuery} maxLength={100}/>
            <Options current={postFilter} onChange={next=>setPostFilter(next as typeof postFilter)}
              items={["ALL","PHOTOS","TEXT"].map(id=>({id,name:t(`tm6.filter.${id}` as never)}))}/>
            <AppText variant="caption" muted>{t("tm6.results",{count:shownPosts.length})}</AppText>
            {!shownPosts.length?<AppText muted>{data.posts.length?t("tm6.noMatches"):tr("noPosts")}</AppText>:null}
            {shownPosts.map(post=><View style={styles.item} key={post.id}>
              <AppText variant="caption" muted>{date(post.publishedAt)}</AppText>
              {post.body?<AppText>{post.body}</AppText>:null}
              {post.imageUrl?<Image source={{uri:resolveMediaImageUrl(post.imageUrl)??post.imageUrl}} resizeMode="cover" style={styles.mediaImage}/>:null}
              <View style={[styles.engagement,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <Ionicons name="heart-outline" color={colors.primary} size={16}/>
                <AppText variant="caption" muted>{t("tm6.likes",{count:post.likeCount??0})}</AppText>
                <Ionicons name="chatbubble-outline" color={colors.primary} size={16}/>
                <AppText variant="caption" muted>{t("tm6.comments",{count:post.commentCount??0})}</AppText>
              </View>
              <View style={styles.actions}>
                <Button label={tr("edit")} variant="secondary" disabled={!canWrite} onPress={()=>editPost(post)}/>
                <Button label={tr("delete")} variant="ghost" disabled={!canWrite||busy}
                  onPress={()=>setDeleteCandidate(post.id)}/>
                <Button label={tr("viewInteractions")} variant="secondary"
                  onPress={()=>router.push({pathname:"/posts/[postId]/comments",params:{postId:post.id}})}/>
              </View>
            </View>)}
            {deleteCandidate?<Card style={{borderColor:colors.danger}}>
              <AppText weight="semibold">{tr("phase5ConfirmDelete")}</AppText>
              <View style={styles.actions}>
                <Button label={tr("delete")} variant="danger" disabled={!canWrite}
                  loading={busy} onPress={()=>void execute(
                    ()=>teamGrowthApi.deletePost(token,team.id,deleteCandidate),
                    ()=>setDeleteCandidate(null))}/>
                <Button label={t("common.cancel")} variant="secondary"
                  onPress={()=>setDeleteCandidate(null)}/>
              </View>
            </Card>:null}
          </Card>
        </>:mediaSection==="PHOTOS"?<>
          <Card>
            <AppText variant="bodyLarge" weight="bold">{tr("phase5Photos")}</AppText>
            <AppText variant="caption" muted>{tr("phase5PhotoHint")}</AppText>
            <Button label={tr("addPhoto")} variant="secondary" disabled={!canWrite||busy}
              onPress={()=>{newPost();void selectPhoto();}}/>
            {data.posts.filter(post=>!!post.imageUrl).length===0?
              <AppText muted>{tr("phase5NoPhotos")}</AppText>:
              <View style={styles.photoGrid}>{data.posts.filter(post=>!!post.imageUrl).map(post=>
                <Pressable key={post.id} accessibilityRole="button" accessibilityLabel={post.body||tr("phase5Photos")}
                  onPress={()=>router.push({pathname:"/posts/[postId]",params:{postId:post.id}})}
                  style={styles.photoTile}>
                  <Image source={{uri:resolveMediaImageUrl(post.imageUrl)??post.imageUrl!}}
                    style={styles.photoImage} resizeMode="cover"/>
                </Pressable>)}</View>}
          </Card>
        </>:<>
          <Card testID="tm6-announcement-composer">
            <AppText variant="bodyLarge" weight="bold">{tr("privateAnnouncements")}</AppText>
            <AppText variant="caption" muted>{tr("announcementHelp")}</AppText>
            <Button label={tr("newAnnouncement")} disabled={!canWrite}
              onPress={()=>setAnnouncementOpen(value=>!value)} variant="secondary"/>
            {announcementOpen?<View style={styles.announcementForm}>
              <AppText variant="caption" weight="semibold">{t("tm6.membersOnly")}</AppText>
            <TextField label={tr("announcementTitle")} value={announcementTitle} maxLength={120} onChangeText={setAnnouncementTitle}/>
            <TextField label={tr("announcementBody")} value={announcementBody} maxLength={2000} multiline onChangeText={setAnnouncementBody}/>
            <Button label={tr("sendAnnouncement")} disabled={!canWrite||busy||announcementTitle.trim().length<2||announcementBody.trim().length<2}
              loading={busy} onPress={()=>void execute(()=>teamGrowthApi.createAnnouncement(token,team.id,{
                title:announcementTitle.trim(),body:announcementBody.trim(),
              }),()=>{setAnnouncementTitle("");setAnnouncementBody("");setAnnouncementOpen(false);})}/>
              <Button label={t("common.cancel")} variant="ghost"
                onPress={()=>setAnnouncementOpen(false)}/>
            </View>:null}
          </Card>
          <Card><AppText variant="bodyLarge" weight="bold">{tr("privateAnnouncements")}</AppText>
            <Button label={tr("memberView")} variant="secondary" onPress={()=>router.push({
              pathname:"/teams/[teamId]/announcements",params:{teamId:team.id},
            })}/>
            <AppText variant="caption" muted>{t("tm6.sentAnnouncements",{count:data.announcements.length})}</AppText>
            {!data.announcements.length?<AppText muted>{tr("noAnnouncements")}</AppText>:null}
            {data.announcements.map(a=><View key={a.id} style={styles.item}>
              <AppText weight="bold">{a.title}</AppText>
              <AppText variant="caption" muted>{date(a.createdAt)}</AppText>
              <AppText>{a.body}</AppText>
              <Button label={tr("delete")} variant="ghost" disabled={!canWrite||busy}
                onPress={()=>setAnnouncementToDelete(a.id)}/>
              {announcementToDelete===a.id?<View testID="tm6-announcement-delete-confirm"
                style={styles.confirmBox}>
                <AppText style={{color:colors.danger}}>{t("tm6.confirmAnnouncementDelete")}</AppText>
                <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
                  <Button label={tr("delete")} variant="danger" disabled={!canWrite||busy}
                    loading={busy} onPress={()=>void execute(
                      ()=>teamGrowthApi.deleteAnnouncement(token,team.id,a.id),
                      ()=>setAnnouncementToDelete(null))}/>
                  <Button label={t("common.cancel")} variant="secondary"
                    onPress={()=>setAnnouncementToDelete(null)}/>
                </View>
              </View>:null}
            </View>)}
          </Card>
        </>}
      </>:null}

      {tab==="statistics"?<View testID="tm7-analytics" style={styles.analyticsWorkspace}>
        <Card testID="tm7-filters" style={styles.analyticsFilters}>
          <View style={[styles.mediaHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Ionicons name="analytics-outline" size={23} color={colors.primary}/>
            <View style={{flex:1,gap:spacing.xs}}>
              <AppText variant="bodyLarge" weight="bold">{t("tm7.title")}</AppText>
              <AppText variant="caption" muted>{t("tm7.verifiedOnly")}</AppText>
            </View>
          </View>
          {analytics?<View style={styles.analyticsFilters}>
            <DirectoryFilterSelect testID="tm7-competition-select" compact
              label={t("tm7.competition")} allLabel={t("tm7.allCompetitions")}
              value={statCompetition==="ALL"?"":statCompetition}
              options={data.stats.competitionHistory.map(c=>({value:c.id,label:c.name}))}
              onSelect={value=>setStatCompetition(value||"ALL")}/>
            <View style={[styles.analyticsFilterRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <View style={styles.analyticsFilterHalf}>
                <DirectoryFilterSelect testID="tm7-season-select" compact
                  label={t("tm7.season")} allLabel={t("tm7.allSeasons")}
                  value={statSeason==="ALL"?"":statSeason}
                  options={seasons.map(value=>({value,label:value}))}
                  onSelect={value=>setStatSeason(value||"ALL")}/>
              </View>
              <View style={styles.analyticsFilterHalf}>
                <DirectoryFilterSelect testID="tm7-range-select" compact
                  label={t("tm7.dateRange")} allLabel={t("tm7.allDates")}
                  value={statRange==="ALL"?"":statRange}
                  options={(["D30","D90","D365"] as const).map(value=>({
                    value,label:t(`tm7.range.${value}` as never),
                  }))}
                  onSelect={value=>setStatRange((value||"ALL") as AnalyticsRange)}/>
              </View>
            </View>
            {statCompetition!=="ALL"||statSeason!=="ALL"||statRange!=="ALL"?
              <Button label={t("tm7.clearFilters")} variant="secondary"
                onPress={()=>{setStatCompetition("ALL");setStatSeason("ALL");setStatRange("ALL");}}/>:null}
          </View>:<AppText variant="caption" muted>{t("tm7.updateRequired")}</AppText>}
        </Card>
        <Options current={statSection} onChange={id=>setStatSection(id as typeof statSection)}
          items={["PERFORMANCE","PLAYERS","TRENDS","HISTORY"].map(id=>({
            id,name:id==="TRENDS"?t("tm7.trends"):tr("stats."+id),
          }))}/>

        {statSection==="PERFORMANCE"&&statistics?<View testID="tm7-performance" style={styles.analyticsWorkspace}>
          <View style={styles.stats}>
            <Counter label={tr("played")} value={statistics.played}/>
            <Counter label={tr("wins")} value={statistics.wins}/>
            <Counter label={tr("draws")} value={statistics.draws}/>
            <Counter label={tr("losses")} value={statistics.losses}/>
            <Counter label={tr("goalsFor")} value={statistics.goalsFor}/>
            <Counter label={tr("goalsAgainst")} value={statistics.goalsAgainst}/>
            <Counter label={tr("goalDifference")} value={statistics.goalDifference}/>
            <Counter label={tr("winRate")} value={statistics.winRate+"%"}/>
          </View>
          <Card style={styles.analyticsFilters}>
            <AppText weight="bold">{t("tm7.resultDistribution")}</AppText>
            {statistics.played>0?<View testID="tm7-distribution" style={styles.distribution}>
              {statistics.wins>0?<View style={[styles.distributionWin,{flex:statistics.wins}]}/>:null}
              {statistics.draws>0?<View style={[styles.distributionDraw,{flex:statistics.draws}]}/>:null}
              {statistics.losses>0?<View style={[styles.distributionLoss,{flex:statistics.losses}]}/>:null}
            </View>:<AppText muted>{t("tm7.noVerifiedMatches")}</AppText>}
            <AppText variant="caption" muted>{tr("officialStatsHint")}</AppText>
            <AppText weight="bold">{tr("titles")}: {statCompetition==="ALL"&&statSeason==="ALL"&&statRange==="ALL"?
              data.stats.championships:t("tm7.titlesAllTime")}</AppText>
          </Card>
        </View>:null}

        {statSection==="PLAYERS"?<Card testID="tm7-players" style={styles.analyticsFilters}>
          <AppText variant="bodyLarge" weight="bold">{tr("playerLeaders")}</AppText>
          <TextField testID="tm7-player-search" label={t("tm7.searchPlayer")}
            value={statSearch} onChangeText={setStatSearch} maxLength={100}/>
          <AppText variant="caption" muted>{t("tm7.rankBy")}</AppText>
          <Options current={statMetric} onChange={id=>setStatMetric(id as typeof statMetric)}
            items={["GOALS","ASSISTS","APPEARANCES"].map(id=>({
              id,name:t(`tm7.metric.${id}` as never),
            }))}/>
          <AppText variant="caption" muted>{t("tm7.playersFound",{count:filteredPlayers.length})}</AppText>
          {!filteredPlayers.length?<AppText muted>{tr("noPlayerStats")}</AppText>:null}
          {filteredPlayers.map((p,index)=><View key={p.userId} style={styles.item}>
            <View style={[styles.mediaHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <View style={styles.rankBadge}><AppText weight="bold" style={{color:colors.primary}}>
                {index+1}</AppText></View>
              <AppText weight="semibold" style={{flex:1}}>{p.displayName}</AppText>
            </View>
            <AppText variant="caption" muted>{tr("played")}: {p.matches} · {tr("goals")}: {p.goals} · {tr("assists")}: {p.assists}</AppText>
            <AppText variant="caption" muted>{tr("yellow")}: {p.yellowCards} · {tr("red")}: {p.redCards} · {tr("cleanSheets")}: {p.cleanSheets} · {tr("bestPlayer")}: {p.playerOfMatch}</AppText>
          </View>)}
          <AppText variant="caption" muted>{t("tm7.playerScopeHint")}</AppText>
        </Card>:null}

        {statSection==="TRENDS"?<Card testID="tm7-trends" style={styles.analyticsFilters}>
          <AppText variant="bodyLarge" weight="bold">{t("tm7.recentForm")}</AppText>
          {!analytics?<AppText muted>{t("tm7.updateRequired")}</AppText>:
            !scoped?.trend.length?<AppText muted>{t("tm7.noDatedMatches")}</AppText>:<>
              <View style={[styles.trendChips,{flexDirection:isRTL?"row-reverse":"row"}]}>
                {[...scoped.trend].reverse().map(match=><View key={match.id}
                  accessibilityLabel={t(`tm7.result.${match.result}` as never)}
                  style={[styles.trendChip,{backgroundColor:match.result==="WIN"?colors.primarySoft:
                    match.result==="DRAW"?colors.surfaceMuted:colors.background}]}>
                  <AppText weight="bold" style={{color:match.result==="WIN"?colors.primary:
                    match.result==="DRAW"?colors.textMuted:colors.danger}}>
                    {t(`tm7.short.${match.result}` as never)}
                  </AppText>
                </View>)}
              </View>
              {scoped.trend.map(match=><View style={styles.item} key={match.id}>
                <View style={[styles.mediaHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
                  <AppText weight="semibold" style={{flex:1}}>{data.stats.competitionHistory
                    .find(c=>c.id===match.competitionId)?.name??t("tm7.unknownCompetition")}</AppText>
                  <AppText weight="bold">{match.goalsFor} : {match.goalsAgainst}</AppText>
                </View>
                <AppText variant="caption" muted>{date(match.startsAt)} · {t(`tm7.result.${match.result}` as never)}</AppText>
              </View>)}
            </>}
          <AppText variant="caption" muted>{t("tm7.trendsHint")}</AppText>
        </Card>:null}

        {statSection==="HISTORY"?<Card testID="tm7-history" style={styles.analyticsFilters}>
          <AppText variant="bodyLarge" weight="bold">{tr("historyAndAwards")}</AppText>
          {!statHistory.length?<AppText muted>{tr("noHistory")}</AppText>:null}
          {(statSeason!=="ALL"||statRange!=="ALL")?
            <AppText variant="caption" muted>{t("tm7.historyPeriodHint")}</AppText>:null}
          {statHistory.map(c=><View key={c.id} style={styles.item}>
            <AppText weight="bold">{c.name} {c.champion?"🏆":""}</AppText>
            <AppText variant="caption" muted>{c.format.replaceAll("_"," ")} · {c.status.replaceAll("_"," ")} · {c.registrationStatus.replaceAll("_"," ")}</AppText>
            {c.champion?<AppText weight="semibold" style={{color:colors.primary}}>{tr("confirmedTitle")}</AppText>:null}
            {c.rewards.length?<><AppText weight="semibold">{tr("offeredRewards")}</AppText>
              {c.rewards.map((reward,i)=><AppText key={i} variant="caption">{reward.title} · {reward.prize} ({reward.category})</AppText>)}
            </>:null}
            <Button label={tr("competitionDetails")} variant="secondary" onPress={()=>router.push({
              pathname:"/competitions/[competitionId]",params:{competitionId:c.id},
            })}/>
          </View>)}
          <AppText variant="caption" muted>{tr("rewardCaution")}</AppText>
        </Card>:null}
      </View>:null}

      {tab==="matches"?<>
        <Card><AppText variant="bodyLarge" weight="bold">{tr("friendlyChallenges")}</AppText>
          <AppText variant="caption" muted>{tr("friendlyHelp")}</AppText>
          <Button label={tr("newChallenge")} disabled={!canWrite} onPress={()=>setShowChallengeForm(x=>!x)}/>
          {showChallengeForm?<View style={{gap:spacing.md}}>
            <TextField label={tr("findOpponent")} value={challengeSearch} onChangeText={setChallengeSearch}/>
            <Options items={discovery.map(c=>({id:c.id,name:c.name+" · "+c.city}))}
              current={challengeTarget} onChange={setChallengeTarget}/>
            {challengeTarget?<AppText variant="caption" muted>{tr("chosen")}: {teams.find(x=>x.id===challengeTarget)?.name}</AppText>:null}
            <DateTimePickerField label={tr("proposedTime")} value={challengeTime} minimumDate={new Date(Date.now()+30*60_000)}
              onChange={setChallengeTime}/>
            <TextField label={tr("venueName")} value={challengeVenue} onChangeText={setChallengeVenue}/>
            <TextField label={tr("challengeMessage")} value={challengeMessage} multiline onChangeText={setChallengeMessage}/>
            <Button label={tr("sendChallenge")} loading={busy} disabled={!canWrite||busy||!challengeTarget||
              !challengeTime||Date.parse(challengeTime)<Date.now()+30*60_000}
              onPress={()=>void execute(()=>teamGrowthApi.challenge(token,team.id,{
                toTeamId:challengeTarget,proposedAt:challengeTime,
                venueName:challengeVenue.trim()||null,message:challengeMessage.trim()||null,
              }),()=>{setChallengeTarget("");setChallengeTime("");setChallengeVenue("");setChallengeMessage("");setShowChallengeForm(false);})}/>
          </View>:null}
          <Options items={[
            {id:"PENDING",name:t("tm5.friendlyPending")},
            {id:"ACCEPTED",name:t("tm5.friendlyAccepted")},
            {id:"HISTORY",name:t("tm5.friendlyHistory")},
            {id:"ALL",name:t("tm5.matchStatus.ALL")},
          ]} current={challengeFilter} onChange={v=>setChallengeFilter(v as typeof challengeFilter)}/>
          {!filteredChallenges.length?<AppText muted>{tr("noChallenges")}</AppText>:null}
          {filteredChallenges.map(c=><View key={c.id} style={styles.item}>
            <AppText weight="semibold">{c.opponentName}</AppText>
            <AppText variant="caption" muted>{date(c.proposedAt)} · {tr("status."+c.status)}</AppText>
            {c.venueName?<AppText variant="caption">{c.venueName}</AppText>:null}
            {c.message?<AppText>{c.message}</AppText>:null}
            {c.status==="ACCEPTED"?<AppText variant="caption" muted>{t("tm5.friendlyAcceptedHint")}</AppText>:null}
            {c.status==="PENDING"&&Date.parse(c.proposedAt)<=Date.now()?
              <AppText variant="caption" style={{color:colors.warning}}>{t("tm5.friendlyExpired")}</AppText>:null}
            {c.toTeamId===team.id&&c.status==="PENDING"&&Date.parse(c.proposedAt)>Date.now()?
              <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Button label={tr("accept")} disabled={!canWrite||busy} loading={busy}
                onPress={()=>void execute(()=>teamGrowthApi.decideChallenge(token,team.id,c.id,"ACCEPTED"))}/>
              <Button label={tr("decline")} variant="secondary" disabled={!canWrite||busy}
                onPress={()=>void execute(()=>teamGrowthApi.decideChallenge(token,team.id,c.id,"DECLINED"))}/>
            </View>:null}
            {c.fromTeamId===team.id&&["PENDING","ACCEPTED"].includes(c.status)?<>
              <Button label={tr("cancelChallenge")} variant="secondary" disabled={!canWrite||busy}
                onPress={()=>setCancelChallengeId(c.id)}/>
              {cancelChallengeId===c.id?<View testID="tm5-friendly-cancel-confirm" style={styles.challengeConfirm}>
                <AppText variant="caption" style={{color:colors.danger}}>{t("tm5.confirmFriendlyCancel")}</AppText>
                <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
                  <Button label={tr("cancelChallenge")} variant="danger" disabled={!canWrite||busy}
                    loading={busy} onPress={()=>void execute(()=>teamGrowthApi.cancelChallenge(token,team.id,c.id),
                      ()=>setCancelChallengeId(null))}/>
                  <Button label={t("common.cancel")} variant="secondary" onPress={()=>setCancelChallengeId(null)}/>
                </View>
              </View>:null}
            </>:null}
          </View>)}
        </Card>
      </>:null}
    </>:null}
  </View>;
}
const styles=StyleSheet.create({
  analyticsWorkspace:{gap:spacing.md},
  analyticsFilters:{gap:spacing.md},
  analyticsFilterRow:{gap:spacing.sm,alignItems:"flex-start"},
  analyticsFilterHalf:{flex:1,minWidth:0},
  distribution:{height:16,flexDirection:"row",overflow:"hidden",
    borderRadius:radius.pill,backgroundColor:colors.surfaceMuted},
  distributionWin:{backgroundColor:colors.primary},
  distributionDraw:{backgroundColor:colors.textMuted},
  distributionLoss:{backgroundColor:colors.danger},
  rankBadge:{height:30,minWidth:30,paddingHorizontal:spacing.xs,
    borderRadius:radius.pill,backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"},
  trendChips:{gap:spacing.xs,flexWrap:"wrap"},
  trendChip:{width:31,height:31,alignItems:"center",justifyContent:"center",
    borderRadius:radius.md,borderWidth:1,borderColor:colors.border},
  mediaHeader:{gap:spacing.md,borderWidth:1,borderColor:colors.border},
  mediaHeading:{alignItems:"center",gap:spacing.sm},
  mediaList:{gap:spacing.sm},
  engagement:{alignItems:"center",gap:spacing.xs,flexWrap:"wrap"},
  announcementForm:{gap:spacing.sm},
  confirmBox:{gap:spacing.sm,padding:spacing.md,borderRadius:radius.md,
    borderWidth:1,borderColor:colors.danger},
  challengeConfirm:{gap:spacing.sm,borderRadius:radius.md,borderWidth:1,
    borderColor:colors.danger,padding:spacing.md},
  item:{borderTopWidth:1,borderColor:colors.border,paddingTop:spacing.md,marginTop:spacing.md,gap:spacing.sm},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm,alignItems:"center"},
  mediaImage:{width:"100%",height:190,borderRadius:radius.md,backgroundColor:colors.primarySoft},
  photoGrid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm,marginTop:spacing.sm},
  photoTile:{width:"31%",aspectRatio:1,borderRadius:radius.md,overflow:"hidden"},
  photoImage:{height:"100%",width:"100%"},
  chip:{backgroundColor:colors.surface,paddingHorizontal:spacing.md,paddingVertical:spacing.sm,
    borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,minHeight:40,justifyContent:"center"},
  active:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  stats:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  stat:{minWidth:70,flexBasis:"21%",flexGrow:1,backgroundColor:colors.surface,
    borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,padding:spacing.md,alignItems:"center",gap:spacing.xs},
});
