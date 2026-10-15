import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {VenueMediaPageDto} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useEffect,useRef,useState} from "react";
import {Image,StyleSheet,View} from "react-native";
import {MediaImagePicker} from "../../../src/components/owner/media/MediaImagePicker";
import {ownerApi,resolveMediaImageUrl} from "../../../src/lib/api";
import {AppText} from "../../../src/components/ui/AppText";
import {Button} from "../../../src/components/ui/Button";
import {Card} from "../../../src/components/ui/Card";
import {DataLoadingState} from "../../../src/components/ui/DataLoadingState";
import {Screen} from "../../../src/components/ui/Screen";
import {TextField} from "../../../src/components/ui/TextField";
import {useAuth} from "../../../src/providers/AuthProvider";
import {useLocale} from "../../../src/providers/LocaleProvider";

export default function OwnerMediaProfileScreen(){
  const {session}=useAuth();
  const token=session?.accessToken;
  const {t,isRTL}=useLocale();
  const [page,setPage]=useState<VenueMediaPageDto|null>(null);
  const [loadedToken,setLoadedToken]=useState<string|null>(null);
  const [profileDraft,setProfileDraft]=useState("");
  const [coverDraft,setCoverDraft]=useState("");
  const [bioDraft,setBioDraft]=useState("");
  const [editing,setEditing]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [success,setSuccess]=useState(false);
  const generation=useRef(0);
  const current=loadedToken===token?page:null;

  const hydrate=(fresh:VenueMediaPageDto)=>{
    setProfileDraft(fresh.pageProfileImageUrl??"");
    setCoverDraft(fresh.pageCoverImageUrl??"");
    setBioDraft(fresh.pageBio??"");
  };
  const load=useCallback(async()=>{
    const request=++generation.current;
    if(!token){setPage(null);setLoadedToken(null);setLoading(false);return;}
    setLoading(true);setError(null);
    try{
      const result=await ownerApi.mediaPage(token);
      if(request!==generation.current)return;
      setPage(result.page);setLoadedToken(token);
      if(!editing)hydrate(result.page);
    }catch{if(request===generation.current)setError(t("owner.phase6.profileLoadError"));}
    finally{if(request===generation.current)setLoading(false);}
  },[token,editing,t]);

  useEffect(()=>{setEditing(false);setSuccess(false);setError(null);},[token]);
  useFocusEffect(useCallback(()=>{
    void load();
    return()=>{generation.current++;};
  },[load]));

  async function save(){
    if(!token||!current||saving)return;
    const request=++generation.current;
    setSaving(true);setSuccess(false);setError(null);
    try{
      const next=await ownerApi.updateMediaPage(token,{
        pageProfileImageUrl:profileDraft||null,
        pageCoverImageUrl:coverDraft||null,
        pageBio:bioDraft.trim()||null,
      });
      if(request!==generation.current)return;
      setPage(next.page);setLoadedToken(token);hydrate(next.page);
      setEditing(false);setSuccess(true);
    }catch{if(request===generation.current)setError(t("media.pageSaveError"));}
    finally{if(request===generation.current)setSaving(false);}
  }
  if(loading&&!current)return <Screen embedded><DataLoadingState variant="dashboard" minHeight={500}/></Screen>;
  return <Screen embedded refreshing={loading&&!!current} onRefresh={()=>void load()}>
    <View testID="owner-phase6-public-profile" style={styles.heading}>
      <AppText variant="title" weight="bold">{t("owner.dashboardSubnav.publicProfile")}</AppText>
      <AppText variant="caption" muted>{t("owner.phase6.profileSubtitle")}</AppText>
    </View>
    {error?<Card style={styles.stack}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button variant="secondary" label={t("common.retry")} onPress={()=>void load()}/>
    </Card>:null}
    {success?<Card><AppText style={{color:colors.success}}>{t("venueSettings.saved")}</AppText></Card>:null}
    {current?<Card style={styles.profile}>
      <View style={styles.cover}>
        {resolveMediaImageUrl(current.pageCoverImageUrl)
          ?<Image source={{uri:resolveMediaImageUrl(current.pageCoverImageUrl)!}}
            style={StyleSheet.absoluteFill} resizeMode="cover"/>:
          <View style={styles.coverFallback}>
            <Ionicons name="images-outline" size={42} color="#DBEAFE"/>
            <AppText style={{color:"#DBEAFE"}}>{t("media.addCover")}</AppText>
          </View>}
      </View>
      <View style={[styles.identity,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {resolveMediaImageUrl(current.pageProfileImageUrl)
          ?<Image source={{uri:resolveMediaImageUrl(current.pageProfileImageUrl)!}}
            style={styles.avatar}/>:
          <View style={[styles.avatar,styles.avatarEmpty]}>
            <Ionicons name="business-outline" size={27} color={colors.primary}/>
          </View>}
        <View style={{flex:1,gap:spacing.xs}}>
          <AppText variant="bodyLarge" weight="bold">{current.name}</AppText>
          <AppText variant="caption" muted>{current.city}, {current.province}</AppText>
          <AppText variant="caption" muted>{t("social.followers",{count:current.followerCount})}</AppText>
          <AppText variant="caption" muted>{t("media.postsCount",{count:current.postCount})}</AppText>
        </View>
      </View>
      {current.pageBio?<AppText>{current.pageBio}</AppText>:
        <AppText variant="caption" muted>{t("media.addBio")}</AppText>}
      <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Button style={{flex:1}} label={t("media.viewPage")} variant="secondary"
          onPress={()=>router.push({pathname:"/venues/[venueId]",params:{venueId:current.venueId}})}/>
        <Button style={{flex:1}} label={t("media.editPage")}
          onPress={()=>{hydrate(current);setEditing(true);setSuccess(false);}}/>
      </View>
    </Card>:null}
    {editing&&current&&token?<Card style={styles.stack}>
      <AppText variant="bodyLarge" weight="bold">{t("media.pageAppearance")}</AppText>
      <AppText variant="caption" muted>{t("media.pageAppearanceHint")}</AppText>
      <MediaImagePicker accessToken={token} purpose="COVER"
        label={t("media.coverPhoto")} value={coverDraft} onChange={setCoverDraft}
        variant="cover" disabled={saving}/>
      <MediaImagePicker accessToken={token} purpose="PROFILE"
        label={t("media.profilePhoto")} value={profileDraft} onChange={setProfileDraft}
        variant="profile" disabled={saving}/>
      <TextField label={t("media.pageBio")} value={bioDraft} onChangeText={setBioDraft}
        multiline maxLength={500} placeholder={t("media.pageBioPlaceholder")}/>
      <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Button style={{flex:1}} label={t("common.cancel")} variant="secondary"
          disabled={saving} onPress={()=>{hydrate(current);setEditing(false);}}/>
        <Button style={{flex:1}} label={t("common.save")} loading={saving}
          onPress={()=>void save()}/>
      </View>
    </Card>:null}
    <Button label={t("owner.dashboardSubnav.posts")} variant="ghost"
      onPress={()=>router.push("/owner/posts")}/>
  </Screen>;
}
const styles=StyleSheet.create({
  heading:{gap:spacing.xs},
  stack:{gap:spacing.md},profile:{gap:spacing.md,overflow:"hidden"},
  cover:{height:165,backgroundColor:"#1D4ED8",marginHorizontal:-spacing.md,marginTop:-spacing.md},
  coverFallback:{flex:1,alignItems:"center",justifyContent:"center",gap:spacing.xs},
  identity:{alignItems:"center",gap:spacing.md},
  avatar:{width:78,height:78,borderRadius:radius.lg},
  avatarEmpty:{backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"},
  row:{alignItems:"center",gap:spacing.sm},
});
