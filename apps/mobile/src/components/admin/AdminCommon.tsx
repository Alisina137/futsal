import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import {View} from "react-native";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";

type Tone="success"|"warning"|"danger"|"neutral";
const palettes={
  success:{background:"#E6F7ED",color:"#166534",border:"#B6E6C8"},
  warning:{background:"#FFFAE5",color:"#92400E",border:"#F5DB9A"},
  danger:{background:"#FFF0EE",color:"#B42318",border:"#FFC9C2"},
  neutral:{background:"#F1F5F9",color:"#475569",border:"#D5DEE8"},
};
export function AdminStatusBadge({label,tone="neutral"}:{label:string;tone?:Tone}){
  const p=palettes[tone];
  return <View style={{backgroundColor:p.background,borderColor:p.border,borderWidth:1,
    borderRadius:radius.pill,paddingHorizontal:spacing.sm,paddingVertical:5,
    alignSelf:"flex-start"}}>
    <AppText variant="caption" weight="bold" style={{color:p.color}}>{label}</AppText>
  </View>;
}
export function AdminEmptyState({title,description,onRetry,retryLabel}:{
  title:string;description?:string;onRetry?:()=>void;retryLabel?:string;
}){
  return <View style={{minHeight:170,alignItems:"center",justifyContent:"center",
    padding:spacing.lg,gap:spacing.sm}}>
    <Ionicons name="file-tray-outline" size={30} color={colors.textMuted}/>
    <AppText weight="semibold" style={{textAlign:"center"}}>{title}</AppText>
    {description?<AppText variant="caption" muted style={{textAlign:"center"}}>{description}</AppText>:null}
    {onRetry&&retryLabel?<Button label={retryLabel} variant="secondary" onPress={onRetry}/>:null}
  </View>;
}
