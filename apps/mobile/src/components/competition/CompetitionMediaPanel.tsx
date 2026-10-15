import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {CompetitionDto,CompetitionMediaPostDto} from "@leaguekick/contracts";
import {useEffect,useRef,useState} from "react";
import {Image,Modal,Pressable,ScrollView,Share,StyleSheet,View} from "react-native";
import {competitionApi,resolveMediaImageUrl} from "../../lib/api";
import {formatPostTimeAgo} from "../../lib/date-time";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Card} from "../ui/Card";

type MediaView="UPDATES"|"PHOTOS";
type Sort="newest"|"oldest";
const PAGE_SIZE=12;

export function CompetitionMediaPanel({competition,view}:{
  competition:CompetitionDto;view:string;
}){
  const {t,isRTL,language}=useLocale();
  const kind:MediaView=view==="PHOTOS"?"PHOTOS":"UPDATES";
  const [sort,setSort]=useState<Sort>("newest");
  const [items,setItems]=useState<CompetitionMediaPostDto[]>([]);
  const [page,setPage]=useState(0);
  const [hasMore,setHasMore]=useState(false);
  const [loading,setLoading]=useState(true);
  const [loadingMore,setLoadingMore]=useState(false);
  const [error,setError]=useState(false);
  const [retry,setRetry]=useState(0);
  const [photoId,setPhotoId]=useState<string|null>(null);
  const [shareError,setShareError]=useState(false);
  const generation=useRef(0);

  // Switching competition, media tab, sorting or refreshing invalidates in-flight pages.
  useEffect(()=>{
    const token=++generation.current;
    setItems([]);setPage(0);setHasMore(false);setError(false);
    setPhotoId(null);setLoading(true);setLoadingMore(false);setShareError(false);
    void competitionApi.mediaPage(competition.id,{
      page:1,limit:PAGE_SIZE,kind:kind==="PHOTOS"?"photos":"all",sort,
    }).then(result=>{
      if(token!==generation.current)return;
      setItems(result.posts.filter(post=>post.competitionId===competition.id&&
        post.status==="PUBLISHED"));
      setPage(result.page);setHasMore(result.hasMore);
    }).catch(()=>{if(token===generation.current)setError(true);})
      .finally(()=>{if(token===generation.current)setLoading(false);});
    return()=>{generation.current++;};
  },[competition.id,kind,sort,retry]);

  async function loadMore(){
    if(loading||loadingMore||!hasMore)return;
    const token=generation.current,nextPage=page+1;
    setLoadingMore(true);
    try{
      const result=await competitionApi.mediaPage(competition.id,{
        page:nextPage,limit:PAGE_SIZE,kind:kind==="PHOTOS"?"photos":"all",sort,
      });
      if(token!==generation.current)return;
      setItems(current=>{
        const seen=new Set(current.map(item=>item.id));
        return [...current,...result.posts.filter(post=>{
          if(post.competitionId!==competition.id||post.status!=="PUBLISHED"||seen.has(post.id))
            return false;
          seen.add(post.id);return true;
        })];
      });
      setPage(result.page);setHasMore(result.hasMore);setError(false);
    }catch{if(token===generation.current)setError(true);}
    finally{if(token===generation.current)setLoadingMore(false);}
  }
  const photos=items.filter(post=>Boolean(resolveMediaImageUrl(post.imageUrl)));
  const photoIndex=photos.findIndex(post=>post.id===photoId);
  const selectedPhoto=photoIndex>=0?photos[photoIndex]:null;
  async function sharePost(post:CompetitionMediaPostDto){
    setShareError(false);
    try{await Share.share({message:post.body.trim()||competition.name});}
    catch{setShareError(true);}
  }
  const empty=kind==="PHOTOS"?t("competition.phase4.noPhotos"):t("competition.publicMediaEmpty");
  return <View testID="competition-phase7-media" style={styles.stack}>
    <View style={[styles.header,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={{flex:1,gap:2}}>
        <AppText weight="bold" variant="bodyLarge">
          {t(kind==="PHOTOS"?"competition.phase4.photos":"competition.profile.allPosts")}
        </AppText>
        <AppText variant="caption" muted>{t("competition.detail.phase7.publicOnly")}</AppText>
      </View>
      <Pressable accessibilityRole="button" testID="competition-media-refresh"
        accessibilityLabel={t("competition.detail.refresh")}
        onPress={()=>setRetry(n=>n+1)} style={styles.refresh}>
        <Ionicons name="refresh-outline" size={21} color={colors.primary}/>
      </Pressable>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.sortRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {(["newest","oldest"] as const).map(value=><Pressable key={value}
        testID={`competition-media-sort-${value}`} accessibilityRole="tab"
        accessibilityState={{selected:sort===value}} onPress={()=>setSort(value)}
        style={[styles.sortButton,sort===value&&styles.sortSelected]}>
        <Ionicons name={value==="newest"?"arrow-down-outline":"arrow-up-outline"}
          size={16} color={sort===value?"#FFFFFF":colors.primary}/>
        <AppText variant="caption" weight="semibold"
          style={{color:sort===value?"#FFFFFF":colors.primary}}>
          {t(value==="newest"?"competition.detail.phase7.newest":"competition.detail.phase7.oldest")}
        </AppText>
      </Pressable>)}
    </ScrollView>
    {shareError?<Card><AppText style={{color:colors.danger}}>
      {t("competition.detail.phase7.shareFailed")}
    </AppText></Card>:null}
    {loading?<Card style={styles.empty}><Ionicons name="hourglass-outline" size={24}
      color={colors.primary}/><AppText muted>{t("competition.detail.phase7.loading")}</AppText></Card>:null}
    {!loading&&items.length===0&&!error?<Card style={styles.empty}>
      <Ionicons name={kind==="PHOTOS"?"images-outline":"newspaper-outline"}
        color={colors.primary} size={26}/>
      <AppText muted style={{textAlign:"center"}}>{empty}</AppText>
    </Card>:null}
    {!loading&&kind==="UPDATES"?items.map(post=><Card key={post.id}
      testID={`competition-media-post-${post.id}`} style={styles.post}>
      <View style={[styles.header,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="trophy-outline" color={colors.primary} size={23}/>
        <View style={{flex:1,gap:2}}>
          <AppText weight="semibold" numberOfLines={2}>{competition.name}</AppText>
          <AppText variant="caption" muted>{formatPostTimeAgo(post.publishedAt,language)}</AppText>
        </View>
        <Pressable accessibilityRole="button"
          accessibilityLabel={t("competition.detail.phase7.sharePost")}
          onPress={()=>void sharePost(post)} style={styles.refresh}>
          <Ionicons name="share-social-outline" size={18} color={colors.primary}/>
        </Pressable>
      </View>
      {post.body.trim()?<AppText>{post.body}</AppText>:null}
      {resolveMediaImageUrl(post.imageUrl)?<Pressable accessibilityRole="button"
        accessibilityLabel={t("competition.phase4.openPhoto")}
        onPress={()=>setPhotoId(post.id)}>
        <Image source={{uri:resolveMediaImageUrl(post.imageUrl)!}}
          resizeMode="cover" style={styles.feedImage}/>
      </Pressable>:null}
    </Card>):null}
    {!loading&&kind==="PHOTOS"?<View testID="competition-phase7-gallery"
      style={[styles.gallery,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {photos.map(post=><Pressable key={post.id}
        testID={`competition-phase7-photo-${post.id}`} accessibilityRole="button"
        accessibilityLabel={t("competition.phase4.openPhoto")} style={styles.photoTile}
        onPress={()=>setPhotoId(post.id)}>
        <Image source={{uri:resolveMediaImageUrl(post.imageUrl)!}}
          resizeMode="cover" style={styles.photo}/>
      </Pressable>)}
    </View>:null}
    {error&&!loading?<Card style={styles.stack}>
      <AppText style={{color:colors.danger}}>
        {t("competition.detail.phase7.pageError")}
      </AppText>
      <Pressable accessibilityRole="button" style={styles.action}
        testID="competition-media-retry"
        onPress={()=>{if(page===0)setRetry(n=>n+1);else void loadMore();}}>
        <AppText weight="semibold" style={{color:colors.primary}}>{t("common.retry")}</AppText>
      </Pressable>
    </Card>:null}
    {!loading&&hasMore&&!error?<Pressable accessibilityRole="button"
      testID="competition-media-load-more" disabled={loadingMore}
      onPress={()=>void loadMore()} style={styles.action}>
      <AppText weight="semibold" style={{color:colors.primary}}>
        {t(loadingMore?"competition.detail.phase7.loading":"competition.detail.phase7.loadMore")}
      </AppText>
    </Pressable>:null}
    <Modal visible={Boolean(selectedPhoto)} transparent animationType="fade"
      onRequestClose={()=>setPhotoId(null)}>
      <View style={styles.viewer}>
        <Pressable accessibilityRole="button" testID="competition-phase7-photo-close"
          accessibilityLabel={t("common.cancel")} onPress={()=>setPhotoId(null)}
          style={styles.close}>
          <Ionicons name="close" size={25} color="#FFFFFF"/>
        </Pressable>
        {selectedPhoto?<Image source={{uri:resolveMediaImageUrl(selectedPhoto.imageUrl)!}}
          resizeMode="contain" style={styles.viewerImage}/>:null}
        <View style={styles.viewerFooter}>
          <AppText variant="caption" style={{color:"#FFFFFF",textAlign:"center"}}>
            {photoIndex+1} / {photos.length} · {selectedPhoto?
              formatPostTimeAgo(selectedPhoto.publishedAt,language):""}
          </AppText>
          {selectedPhoto?.body.trim()?<AppText numberOfLines={3}
            style={{color:"#FFFFFF",textAlign:"center"}}>{selectedPhoto.body}</AppText>:null}
          <View style={[styles.viewerControls,{flexDirection:isRTL?"row-reverse":"row"}]}>
            {([-1,1] as const).map(direction=><Pressable key={direction}
              accessibilityRole="button" style={styles.viewerControl}
              accessibilityLabel={t(direction<0?"competition.detail.phase7.previous":"competition.detail.phase7.next")}
              disabled={photoIndex+direction<0||photoIndex+direction>=photos.length}
              onPress={()=>setPhotoId(photos[photoIndex+direction]?.id??null)}>
              <Ionicons name={direction<0?"chevron-back":"chevron-forward"}
                size={22} color={photoIndex+direction<0||photoIndex+direction>=photos.length?"#77818E":"#FFFFFF"}/>
            </Pressable>)}
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  stack:{gap:spacing.md},header:{alignItems:"center",gap:spacing.sm},
  refresh:{width:44,height:44,borderRadius:22,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  sortRow:{gap:spacing.sm,alignItems:"center"},
  sortButton:{minHeight:44,borderRadius:radius.pill,paddingHorizontal:spacing.md,
    backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,
    flexDirection:"row",gap:6,alignItems:"center"},
  sortSelected:{backgroundColor:colors.primary,borderColor:colors.primary},
  post:{gap:spacing.md,padding:spacing.md},
  feedImage:{width:"100%",height:235,borderRadius:radius.md,backgroundColor:colors.primarySoft},
  empty:{minHeight:130,alignItems:"center",justifyContent:"center",gap:spacing.sm},
  gallery:{flexWrap:"wrap",gap:spacing.sm},
  photoTile:{width:"48.5%",aspectRatio:1,borderRadius:radius.md,overflow:"hidden",
    backgroundColor:colors.primarySoft},
  photo:{width:"100%",height:"100%"},
  action:{minHeight:46,borderRadius:radius.md,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center",paddingHorizontal:spacing.md},
  viewer:{flex:1,backgroundColor:"#071426",justifyContent:"center",padding:spacing.md},
  close:{position:"absolute",top:48,right:spacing.md,width:48,height:48,zIndex:2,
    borderRadius:24,backgroundColor:"#1E344D",alignItems:"center",justifyContent:"center"},
  viewerImage:{width:"100%",height:"67%"},
  viewerFooter:{gap:spacing.sm,paddingVertical:spacing.sm},
  viewerControls:{justifyContent:"space-between",paddingHorizontal:spacing.lg},
  viewerControl:{width:54,height:48,alignItems:"center",justifyContent:"center"},
});
