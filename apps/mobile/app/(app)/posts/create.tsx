import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Screen } from "../../../src/components/ui/Screen";
import { ApiRequestError, marketingApi, resolveMediaImageUrl, type LocalMediaUpload } from "../../../src/lib/api";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

function mimeFromName(name:string|null|undefined){
  const lower=(name??"").toLowerCase();
  if(lower.endsWith(".png"))return "image/png";
  if(lower.endsWith(".webp"))return "image/webp";
  if(lower.endsWith(".heic"))return "image/heic";
  if(lower.endsWith(".heif"))return "image/heif";
  if(lower.endsWith(".jpeg")||lower.endsWith(".jpg"))return "image/jpeg";
  return "application/octet-stream";
}

export default function CreatePersonalPostScreen(){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const [body,setBody]=useState("");
  const [imageUrl,setImageUrl]=useState<string|null>(null);
  const [previewUri,setPreviewUri]=useState<string|null>(null);
  const [uploading,setUploading]=useState(false);
  const [publishing,setPublishing]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const user=session?.user;
  const image=resolveMediaImageUrl(user?.profileImageUrl);
  const avatarInitial=(user?.displayName??"F").slice(0,1).toUpperCase();
  const saving=uploading||publishing;

  function explainError(cause:unknown){
    if(cause instanceof ApiRequestError){
      if(cause.code==="MEDIA_TOO_LARGE")return t("social.photoTooLarge");
      if(cause.code==="MEDIA_TYPE_NOT_ALLOWED"||cause.code==="MEDIA_INVALID_IMAGE")return t("media.unsupportedImage");
      if(cause.code==="MEDIA_READ_ERROR"||cause.code==="MEDIA_EMPTY")return t("media.fileUnavailable");
      if(cause.isNetworkError)return t("media.uploadNetworkError");
    }
    return t("social.publishError");
  }

  async function upload(source:LocalMediaUpload){
    if(!session||saving)return;
    setUploading(true);setError(null);
    try{
      const result=await marketingApi.uploadUserPostImage(session.accessToken,source);
      setImageUrl(result.imageUrl);
      setPreviewUri(source.uri);
    }catch(cause){setError(explainError(cause));}
    finally{setUploading(false);}
  }

  async function gallery(){
    if(saving)return;
    try{
      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:["images"],allowsEditing:false,quality:.78,selectionLimit:1,
      });
      if(result.canceled||!result.assets[0])return;
      const asset=result.assets[0];
      await upload({uri:asset.uri,mimeType:asset.mimeType??mimeFromName(asset.fileName),size:asset.fileSize??null});
    }catch{setError(t("media.fileUnavailable"));}
  }

  async function files(){
    if(saving)return;
    try{
      const result=await DocumentPicker.getDocumentAsync({type:"image/*",copyToCacheDirectory:true,multiple:false});
      if(result.canceled||!result.assets[0])return;
      const asset=result.assets[0];
      await upload({
        uri:asset.uri,
        mimeType:asset.mimeType?.startsWith("image/")?asset.mimeType:mimeFromName(asset.name),
        size:asset.size??null,
      });
    }catch{setError(t("media.fileUnavailable"));}
  }

  async function publish(){
    if(!session||saving||(!body.trim()&&!imageUrl))return;
    setPublishing(true);setError(null);
    try{
      await marketingApi.createUserPost(session.accessToken,{body:body.trim(),imageUrl});
      router.replace("/home");
    }catch(cause){setError(explainError(cause));}
    finally{setPublishing(false);}
  }

  return <Screen style={styles.page}>
    <View style={[styles.topBar,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")}
        onPress={()=>router.back()} style={styles.closeButton} disabled={saving}>
        <Ionicons name={isRTL?"arrow-forward":"arrow-back"} size={24} color={colors.text}/>
      </Pressable>
      <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>{t("social.createPostTitle")}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={t("social.publish")}
        disabled={saving||(!body.trim()&&!imageUrl)}
        onPress={()=>void publish()}
        style={[styles.publishButton,(saving||(!body.trim()&&!imageUrl))&&styles.disabled]}>
        {publishing?<ActivityIndicator color="#FFFFFF" size="small"/>:
          <AppText weight="bold" style={{color:"#FFFFFF"}}>{t("social.publish")}</AppText>}
      </Pressable>
    </View>

    <View style={[styles.userRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {image?<Image source={{uri:image}} style={styles.avatar}/>:
        <View style={[styles.avatar,styles.avatarFallback]}><AppText weight="bold" style={{color:colors.primary}}>{avatarInitial}</AppText></View>}
      <View style={{flex:1,alignItems:isRTL?"flex-end":"flex-start"}}>
        <AppText weight="bold">{user?.displayName??t("social.member")}</AppText>
        <View style={styles.publicPill}>
          <Ionicons name="earth-outline" size={14} color={colors.primary}/>
          <AppText variant="caption" style={{color:colors.primary}}>{t("social.publicPost")}</AppText>
        </View>
      </View>
    </View>

    <TextInput
      testID="social-post-composer"
      multiline
      autoFocus
      placeholder={t("social.composerPrompt")}
      placeholderTextColor={colors.textMuted}
      value={body}
      onChangeText={(text)=>setBody(text.slice(0,3000))}
      editable={!saving}
      maxLength={3000}
      style={[styles.bodyInput,{textAlign:isRTL?"right":"left",writingDirection:isRTL?"rtl":"ltr"}]}
      accessibilityLabel={t("social.composerPrompt")}
    />
    <AppText variant="caption" muted style={styles.charCount}>{body.length}/3000</AppText>

    {imageUrl?<View style={styles.imageFrame}>
      <Image source={{uri:previewUri??resolveMediaImageUrl(imageUrl)??""}} style={styles.imagePreview} resizeMode="contain"/>
      {!saving?<Pressable accessibilityRole="button" accessibilityLabel={t("social.removePhoto")}
        onPress={()=>{setImageUrl(null);setPreviewUri(null);}} style={styles.removePhoto}>
        <Ionicons name="close" size={21} color={colors.text}/>
      </Pressable>:null}
    </View>:null}
    {uploading?<View style={styles.busy}><ActivityIndicator color={colors.primary}/><AppText muted>{t("social.uploadingPhoto")}</AppText></View>:null}

    <View style={styles.photoActions}>
      <AppText weight="semibold">{t("social.addToPost")}</AppText>
      <View style={[styles.photoButtons,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Button label={t("media.chooseGallery")} onPress={()=>void gallery()} variant="secondary"
          disabled={saving} style={{flex:1}} icon={<Ionicons name="images-outline" color="#16A34A" size={20}/>}/>
        <Button label={t("media.chooseFiles")} onPress={()=>void files()} variant="secondary"
          disabled={saving} style={{flex:1}} icon={<Ionicons name="folder-open-outline" color={colors.primary} size={20}/>}/>
      </View>
      <AppText variant="caption" muted>{t("social.photoHint")}</AppText>
    </View>
    {error?<AppText accessibilityRole="alert" style={{color:colors.danger}}>{error}</AppText>:null}
    <Button label={t("social.publish")} onPress={()=>void publish()}
      loading={publishing} disabled={saving||(!body.trim()&&!imageUrl)}/>
  </Screen>;
}

const styles=StyleSheet.create({
  page:{paddingTop:0,gap:spacing.md},
  topBar:{minHeight:66,alignItems:"center",gap:spacing.sm,borderBottomWidth:1,borderColor:colors.border},
  closeButton:{width:44,height:44,alignItems:"center",justifyContent:"center"},
  publishButton:{backgroundColor:colors.primary,borderRadius:radius.pill,paddingHorizontal:spacing.lg,height:40,alignItems:"center",justifyContent:"center",minWidth:88},
  disabled:{opacity:.45},
  userRow:{alignItems:"center",gap:spacing.sm},
  avatar:{width:52,height:52,borderRadius:26},
  avatarFallback:{alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  publicPill:{flexDirection:"row",alignItems:"center",gap:spacing.xs,borderColor:"#BAD2FF",backgroundColor:colors.primarySoft,borderWidth:1,borderRadius:radius.pill,paddingHorizontal:spacing.sm,paddingVertical:2},
  bodyInput:{fontSize:19,lineHeight:29,color:colors.text,minHeight:170,textAlignVertical:"top",paddingVertical:spacing.sm},
  charCount:{alignSelf:"flex-end"},
  imageFrame:{height:270,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,backgroundColor:colors.surfaceMuted,overflow:"hidden"},
  imagePreview:{width:"100%",height:"100%"},
  removePhoto:{position:"absolute",top:spacing.sm,right:spacing.sm,width:38,height:38,borderRadius:19,alignItems:"center",justifyContent:"center",backgroundColor:colors.surface},
  photoActions:{gap:spacing.md,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.md,backgroundColor:colors.surface},
  photoButtons:{gap:spacing.sm},
  busy:{flexDirection:"row",alignItems:"center",gap:spacing.sm},
});
