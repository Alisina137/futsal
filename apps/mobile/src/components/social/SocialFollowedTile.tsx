import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius } from "@leaguekick/design-tokens";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { resolveMediaImageUrl } from "../../lib/api";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "../ui/AppText";

type Props={
  id:string;
  name:string;
  imageUrl:string|null;
  kind:"TEAM"|"COMPETITION";
  detailsLabel:string;
  actionLabel:string;
  onDetails:()=>void;
  onAction:()=>void;
  actionDisabled?:boolean;
  busy?:boolean;
};
export function SocialFollowedTile({id,name,imageUrl,kind,detailsLabel,actionLabel,onDetails,onAction,actionDisabled=false,busy=false}:Props){
  const {isRTL}=useLocale();
  const image=resolveMediaImageUrl(imageUrl);
  return <View testID={`social-followed-${id}`} style={styles.tile}>
    <Pressable testID={`social-followed-details-${id}`} accessibilityRole="button"
      accessibilityLabel={`${detailsLabel}: ${name}`} onPress={onDetails}
      style={({pressed})=>[styles.details,pressed&&styles.pressed]}>
      {image?<Image source={{uri:image}} resizeMode="cover" style={styles.logo}/>:
        <View style={[styles.logo,styles.fallback]}>
          <Ionicons name={kind==="TEAM"?"people-outline":"trophy-outline"} color={colors.primary} size={25}/>
        </View>}
      <AppText weight="semibold" variant="caption" numberOfLines={2} style={styles.name}>{name}</AppText>
      <View style={[styles.cue,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <AppText variant="caption" weight="semibold" numberOfLines={2} style={styles.cueText}>{detailsLabel}</AppText>
        <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={15} color={colors.primary}/>
      </View>
    </Pressable>
    <Pressable testID={`social-followed-action-${id}`} accessibilityRole="button"
      accessibilityLabel={`${actionLabel}: ${name}`}
      accessibilityState={{disabled:actionDisabled||busy}} disabled={actionDisabled||busy}
      onPress={onAction} style={({pressed})=>[styles.action,(actionDisabled||busy)&&styles.disabled,pressed&&styles.pressed]}>
      <AppText variant="caption" weight="bold" numberOfLines={2} style={styles.actionText}>{actionLabel}</AppText>
    </Pressable>
  </View>;
}
const styles=StyleSheet.create({
  tile:{width:148,minHeight:208,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,
    backgroundColor:colors.surface,padding:6,gap:6,justifyContent:"space-between"},
  details:{flex:1,minHeight:148,alignItems:"center",justifyContent:"flex-start",
    borderRadius:radius.sm,paddingHorizontal:4,paddingTop:8,paddingBottom:5,gap:5},
  logo:{width:64,height:64,borderRadius:32,backgroundColor:colors.surfaceMuted},
  fallback:{alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  name:{width:"100%",textAlign:"center",minHeight:35},
  cue:{alignItems:"center",justifyContent:"center",gap:2,width:"100%",minHeight:28,
    marginTop:"auto",borderRadius:radius.sm,backgroundColor:colors.primarySoft,paddingHorizontal:3},
  cueText:{color:colors.primary,textAlign:"center",flexShrink:1},
  action:{width:"100%",minHeight:44,borderRadius:radius.sm,backgroundColor:colors.primary,
    alignItems:"center",justifyContent:"center",paddingHorizontal:4,paddingVertical:4},
  actionText:{color:"#FFFFFF",textAlign:"center"},
  disabled:{opacity:.55},
  pressed:{opacity:.75},
});
