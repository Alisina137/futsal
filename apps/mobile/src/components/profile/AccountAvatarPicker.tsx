import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import { ApiRequestError, resolveMediaImageUrl, type LocalMediaUpload } from "../../lib/api";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "../ui/AppText";

type Props={
  value:string|null;
  disabled?:boolean;
  onUpload:(source:LocalMediaUpload)=>Promise<unknown>;
};

function mimeFromName(name:string|null|undefined){
  const n=(name??"").toLowerCase();
  if(n.endsWith(".png"))return "image/png";
  if(n.endsWith(".webp"))return "image/webp";
  if(n.endsWith(".heic"))return "image/heic";
  if(n.endsWith(".heif"))return "image/heif";
  if(n.endsWith(".jpg")||n.endsWith(".jpeg"))return "image/jpeg";
  return "application/octet-stream";
}

export function AccountAvatarPicker({value,disabled=false,onUpload}:Props){
  const {t,isRTL}=useLocale();
  const [busy,setBusy]=useState<"gallery"|"files"|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [previewFailed,setPreviewFailed]=useState(false);
  const [localPreview,setLocalPreview]=useState<{url:string;uri:string}|null>(null);

  const savedUrl=resolveMediaImageUrl(value);
  const preview=localPreview?.url===value?localPreview.uri:savedUrl;

  useEffect(()=>{setPreviewFailed(false);setError(null);},[value]);

  function translateError(cause:unknown){
    if(!(cause instanceof ApiRequestError))return t("media.uploadError");
    if(cause.code==="MEDIA_TOO_LARGE")return t("media.uploadTooLarge");
    if(cause.code==="MEDIA_EMPTY"||cause.code==="MEDIA_READ_ERROR")return t("media.fileUnavailable");
    if(cause.code==="MEDIA_TYPE_NOT_ALLOWED"||cause.code==="MEDIA_INVALID_IMAGE"||cause.code==="MEDIA_BODY_REQUIRED")return t("media.unsupportedImage");
    if(cause.isNetworkError)return t("media.uploadNetworkError");
    return t("media.uploadError");
  }

  async function upload(source:LocalMediaUpload,kind:"gallery"|"files"){
    setBusy(kind);setError(null);
    try{
      await onUpload(source);
      // The session gets the durable server URL and refreshes the header/profile immediately.
      // Keep a device-local preview only for the newly uploaded URL until it changes.
      setLocalPreview(null);
    }catch(cause){
      setError(translateError(cause));
    }finally{setBusy(null);}
  }

  async function pickGallery(){
    if(disabled||busy)return;
    setError(null);
    try{
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted){setError(t("media.galleryPermission"));return;}
      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:["images"],allowsEditing:true,aspect:[1,1],quality:.82,selectionLimit:1,
      });
      if(result.canceled)return;
      const image=result.assets[0];
      if(!image)return;
      await upload({
        uri:image.uri,
        mimeType:image.mimeType??mimeFromName(image.fileName),
        size:image.fileSize??null,
      },"gallery");
    }catch{setError(t("media.fileUnavailable"));}
  }

  async function pickFiles(){
    if(disabled||busy)return;
    setError(null);
    try{
      const result=await DocumentPicker.getDocumentAsync({
        type:"image/*",copyToCacheDirectory:true,multiple:false,
      });
      if(result.canceled)return;
      const file=result.assets[0];
      if(!file)return;
      await upload({
        uri:file.uri,
        mimeType:file.mimeType?.startsWith("image/")?file.mimeType:mimeFromName(file.name),
        size:file.size??null,
      },"files");
    }catch{setError(t("media.fileUnavailable"));}
  }

  return <View style={styles.wrapper}>
    <AppText weight="bold">{t("profile.image")}</AppText>
    <View style={styles.avatarBox}>
      {preview&&!previewFailed
        ?<Image key={preview} source={{uri:preview}} style={styles.avatarImage}
          onError={()=>{setPreviewFailed(true);setError(t("media.previewError"));}}/>
        :<View style={styles.fallback}><Ionicons name="person-outline" size={40} color={colors.primary}/></View>}
      {busy?<View style={styles.overlay}><ActivityIndicator color="#FFFFFF" size="large"/></View>:null}
    </View>
    <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <PickerButton label={t("media.chooseGallery")} icon="images-outline"
        disabled={disabled||busy!==null} loading={busy==="gallery"} onPress={()=>void pickGallery()}/>
      <PickerButton label={t("media.chooseFiles")} icon="folder-open-outline"
        disabled={disabled||busy!==null} loading={busy==="files"} onPress={()=>void pickFiles()}/>
    </View>
    <AppText variant="caption" muted>{t("profile.avatarUploadHint")}</AppText>
    {error?<AppText variant="caption" accessibilityRole="alert" accessibilityLiveRegion="assertive"
      style={{color:colors.danger}}>{error}</AppText>:null}
  </View>;
}

function PickerButton({label,icon,disabled,loading,onPress}:{
  label:string;icon:keyof typeof Ionicons.glyphMap;disabled:boolean;loading:boolean;onPress:()=>void;
}){
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    disabled={disabled} onPress={onPress} style={({pressed})=>[
      styles.action,disabled&&styles.disabled,pressed&&!disabled&&styles.pressed,
    ]}>
    {loading?<ActivityIndicator size="small" color={colors.primary}/>
      :<Ionicons name={icon} size={20} color={colors.primary}/>}
    <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>{label}</AppText>
  </Pressable>;
}

const styles=StyleSheet.create({
  wrapper:{gap:spacing.sm},
  avatarBox:{width:136,height:136,borderRadius:68,overflow:"hidden",alignSelf:"center",
    borderColor:"#BCD4FF",borderWidth:2,backgroundColor:colors.primarySoft},
  avatarImage:{height:"100%",width:"100%"},
  fallback:{flex:1,alignItems:"center",justifyContent:"center"},
  overlay:{position:"absolute",top:0,bottom:0,left:0,right:0,backgroundColor:"rgba(15,23,42,.48)",alignItems:"center",justifyContent:"center"},
  actions:{gap:spacing.sm,flexWrap:"wrap"},
  action:{minHeight:48,minWidth:122,flexGrow:1,paddingHorizontal:spacing.sm,borderWidth:1,borderRadius:radius.md,
    borderColor:colors.border,backgroundColor:colors.surface,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:spacing.xs},
  disabled:{opacity:.5},
  pressed:{opacity:.75},
});
