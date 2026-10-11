import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,spacing} from "@leaguekick/design-tokens";
import {Pressable,View} from "react-native";
import {AppText} from "../ui/AppText";
import {useLocale} from "../../providers/LocaleProvider";

export function AdminPagination({page,total,pageSize,onPage,loading}:{
  page:number;total:number;pageSize:number;onPage:(page:number)=>void;loading?:boolean;
}){
  const {t,isRTL}=useLocale();
  const pages=Math.max(1,Math.ceil(total/pageSize));
  return <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",
    justifyContent:"space-between",gap:spacing.md,flexWrap:"wrap",
    borderTopWidth:1,borderColor:colors.border,paddingTop:spacing.md}}>
    <AppText variant="caption" muted>{t("phase7.admin.pageCount" as never,{
      from:total===0?0:(page-1)*pageSize+1,
      to:Math.min(total,page*pageSize),total,
    })}</AppText>
    <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,alignItems:"center"}}>
      <Pressable disabled={page<=1||loading} accessibilityRole="button"
        accessibilityLabel={t("phase7.admin.previous" as never)}
        style={{padding:spacing.sm,opacity:page<=1||loading?0.45:1}}
        onPress={()=>onPage(page-1)}>
        <Ionicons name="chevron-back" size={20} color={colors.primary}/>
      </Pressable>
      <AppText weight="semibold" forceLtr>{page} / {pages}</AppText>
      <Pressable disabled={page>=pages||loading} accessibilityRole="button"
        accessibilityLabel={t("phase7.admin.next" as never)}
        style={{padding:spacing.sm,opacity:page>=pages||loading?0.45:1}}
        onPress={()=>onPage(page+1)}>
        <Ionicons name="chevron-forward" size={20} color={colors.primary}/>
      </Pressable>
    </View>
  </View>;
}
