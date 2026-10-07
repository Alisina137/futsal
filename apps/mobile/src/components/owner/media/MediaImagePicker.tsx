import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { VenueMediaAssetPurpose } from "@leaguekick/contracts";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import { ownerApi, resolveMediaImageUrl } from "../../../lib/api";
import { useLocale } from "../../../providers/LocaleProvider";
import { AppText } from "../../ui/AppText";

type Props={
  accessToken:string;
  purpose:VenueMediaAssetPurpose;
  label:string;
  value:string;
  onChange:(value:string)=>void;
  variant?:"post"|"profile"|"cover";
  disabled?:boolean;
};

function mimeFromName(name:string|null|undefined){
  const lower=(name??"").toLowerCase();
  if(lower.endsWith(".png"))return "image/png";
  if(lower.endsWith(".webp"))return "image/webp";
  if(lower.endsWith(".heic"))return "image/heic";
  if(lower.endsWith(".heif"))return "image/heif";
  return "image/jpeg";
}

export function MediaImagePicker({
  accessToken,purpose,label,value,onChange,variant="post",disabled=false,
}:Props){
  const {t,isRTL}=useLocale();
  const [busy,setBusy]=useState<"gallery"|"files"|null>(null);
  const [error,setError]=useState<string|null>(null);
  const resolved=resolveMediaImageUrl(value);

  async function upload(source:{uri:string;mimeType:string;size?:number|null},kind:"gallery"|"files"){
    setBusy(kind);setError(null);
    try{
      const {asset}=await ownerApi.uploadMediaAsset(accessToken,purpose,source);
      onChange(asset.imageUrl);
    }catch(cause){
      const code=(cause as {code?:string}).code;
      setError(code==="MEDIA_TOO_LARGE"?t("media.uploadTooLarge"):t("media.uploadError"));
    }finally{
      setBusy(null);
    }
  }

  async function pickGallery(){
    const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(!permission.granted){
      setError(t("media.galleryPermission"));
      return;
    }
    const options:ImagePicker.ImagePickerOptions={
      mediaTypes:["images"],
      allowsEditing:variant!=="post",
      quality:.82,
      selectionLimit:1,
    };
    if(variant==="profile")options.aspect=[1,1];
    if(variant==="cover")options.aspect=[16,6];
    const result=await ImagePicker.launchImageLibraryAsync(options);
    if(result.canceled)return;
    const asset=result.assets[0];
    if(!asset)return;
    await upload({
      uri:asset.uri,
      mimeType:asset.mimeType??mimeFromName(asset.fileName),
      ...(asset.fileSize!==undefined?{size:asset.fileSize}:{}),
    },"gallery");
  }

  async function pickFiles(){
    const result=await DocumentPicker.getDocumentAsync({
      type:["image/jpeg","image/png","image/webp","image/heic","image/heif"],
      copyToCacheDirectory:true,
      multiple:false,
    });
    if(result.canceled)return;
    const asset=result.assets[0];
    if(!asset)return;
    await upload({
      uri:asset.uri,
      mimeType:asset.mimeType??mimeFromName(asset.name),
      ...(asset.size!==undefined?{size:asset.size}:{}),
    },"files");
  }

  return <View style={styles.wrapper}>
    <AppText weight="bold">{label}</AppText>

    <View style={[
      styles.preview,
      variant==="profile"&&styles.profilePreview,
      variant==="cover"&&styles.coverPreview,
    ]}>
      {resolved?<Image
        source={{uri:resolved}}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />:<View style={styles.placeholder}>
        <Ionicons
          name={variant==="profile"?"person-outline":"image-outline"}
          size={variant==="profile"?34:42}
          color={colors.textMuted}
        />
        <AppText variant="caption" muted>{t("media.noImageSelected")}</AppText>
      </View>}
      {busy?<View style={styles.busyOverlay}><ActivityIndicator size="large" color="#FFFFFF"/></View>:null}
    </View>

    <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <PickerAction
        icon="images-outline"
        label={t("media.chooseGallery")}
        disabled={disabled||busy!==null}
        loading={busy==="gallery"}
        onPress={()=>void pickGallery()}
      />
      <PickerAction
        icon="folder-open-outline"
        label={t("media.chooseFiles")}
        disabled={disabled||busy!==null}
        loading={busy==="files"}
        onPress={()=>void pickFiles()}
      />
      {value?<Pressable
        accessibilityRole="button"
        disabled={disabled||busy!==null}
        onPress={()=>{onChange("");setError(null);}}
        style={({pressed})=>[styles.removeButton,pressed&&styles.pressed]}
      >
        <Ionicons name="trash-outline" size={19} color={colors.danger}/>
      </Pressable>:null}
    </View>

    <AppText variant="caption" muted>{t("media.imageUploadHint")}</AppText>
    {error?<AppText variant="caption" style={{color:colors.danger}}>{error}</AppText>:null}
  </View>;
}

function PickerAction({
  icon,label,onPress,disabled,loading,
}:{
  icon:keyof typeof Ionicons.glyphMap;
  label:string;
  onPress:()=>void;
  disabled:boolean;
  loading:boolean;
}){
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    disabled={disabled}
    onPress={onPress}
    style={({pressed})=>[
      styles.action,
      pressed&&!disabled&&styles.pressed,
      disabled&&styles.disabled,
    ]}
  >
    {loading?<ActivityIndicator size="small" color={colors.primary}/>
      :<Ionicons name={icon} size={20} color={colors.primary}/>}
    <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>{label}</AppText>
  </Pressable>;
}

const styles=StyleSheet.create({
  wrapper:{gap:spacing.sm},
  preview:{
    width:"100%",
    height:220,
    borderRadius:radius.lg,
    overflow:"hidden",
    borderWidth:1,
    borderColor:colors.border,
    backgroundColor:colors.surfaceMuted,
  },
  profilePreview:{width:132,height:132,borderRadius:66,alignSelf:"center"},
  coverPreview:{height:180},
  placeholder:{flex:1,alignItems:"center",justifyContent:"center",gap:spacing.sm},
  busyOverlay:{position:"absolute",top:0,right:0,bottom:0,left:0,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(15,23,42,.48)"},
  actions:{gap:spacing.sm,alignItems:"center",flexWrap:"wrap"},
  action:{
    minHeight:44,
    flexGrow:1,
    minWidth:120,
    paddingHorizontal:spacing.md,
    borderRadius:radius.md,
    borderWidth:1,
    borderColor:colors.border,
    backgroundColor:colors.surface,
    alignItems:"center",
    justifyContent:"center",
    flexDirection:"row",
    gap:spacing.xs,
  },
  removeButton:{
    width:44,height:44,borderRadius:radius.md,
    alignItems:"center",justifyContent:"center",
    borderWidth:1,borderColor:"#FECACA",backgroundColor:"#FEF2F2",
  },
  pressed:{opacity:.72},
  disabled:{opacity:.5},
});
