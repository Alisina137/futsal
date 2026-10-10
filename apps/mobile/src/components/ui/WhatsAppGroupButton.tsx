import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import {useState} from "react";
import {Linking,Pressable,StyleSheet} from "react-native";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "./AppText";

/** Only HTTPS WhatsApp group invites, never arbitrary links or schemes. */
export function isWhatsAppGroupInviteLink(value:string):boolean{
  try{
    const link=new URL(value.trim());
    return link.protocol==="https:"&&link.hostname==="chat.whatsapp.com"&&
      !link.port&&!link.username&&!link.password&&!link.hash&&
      /^\/[A-Za-z0-9]{16,64}\/?$/.test(link.pathname);
  }catch{return false;}
}
export function WhatsAppGroupButton({url}:{url:string}){
  const {t,isRTL}=useLocale();
  const [error,setError]=useState(false);
  if(!isWhatsAppGroupInviteLink(url))return null;
  const open=async()=>{
    setError(false);
    try{await Linking.openURL(url);}catch{setError(true);}
  };
  return <>
    <Pressable accessibilityRole="link" accessibilityLabel={t("teamWhatsApp.open")}
      testID="team-whatsapp-open" onPress={()=>void open()}
      style={[styles.button,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Ionicons name="logo-whatsapp" size={22} color="#128C7E"/>
      <AppText weight="semibold" style={{color:colors.primary}}>{t("teamWhatsApp.open")}</AppText>
      <Ionicons name="open-outline" size={17} color={colors.primary}/>
    </Pressable>
    {error?<AppText variant="caption" style={{color:colors.danger}}>{t("teamWhatsApp.openFailed")}</AppText>:null}
  </>;
}
const styles=StyleSheet.create({
  button:{alignItems:"center",gap:spacing.sm,alignSelf:"flex-start",
    paddingHorizontal:spacing.md,paddingVertical:spacing.sm,
    borderWidth:1,borderColor:colors.border,borderRadius:radius.md,
    backgroundColor:colors.primarySoft,minHeight:44},
});
