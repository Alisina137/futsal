import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { resolveMediaImageUrl } from "../../lib/api";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "../ui/AppText";

type Props={
  id:string;
  name:string;
  detail:string;
  imageUrl:string|null;
  kind:"TEAM"|"COMPETITION";
  detailsLabel:string;
  actionLabel:string;
  onDetails:()=>void;
  onAction:()=>void;
  actionDisabled?:boolean;
  busy?:boolean;
  badge?:string;
  /** Team directory only; competitions can keep their existing compact card. */
  statusLabel?:string;
  statusTone?:"success"|"warning"|"muted";
  twoColumn?:boolean;
  testID?:string;
};

/** The venue 25/75 layout, adapted to team and competition actions. */
export function SocialDirectoryCard({
  id,name,detail,imageUrl,kind,detailsLabel,actionLabel,onDetails,onAction,
  actionDisabled=false,busy=false,badge,statusLabel,statusTone="muted",twoColumn=false,testID,
}:Props){
  const {isRTL}=useLocale();
  const image=resolveMediaImageUrl(imageUrl);
  return <View testID={testID??`social-directory-card-${id}`}
    style={[styles.card,twoColumn&&styles.gridCard,{flexDirection:isRTL?"row-reverse":"row"}]}>
    <View style={styles.imageColumn}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${detailsLabel}: ${name}`}
        onPress={onDetails} style={({pressed})=>[styles.imageButton,pressed&&styles.pressed]}>
        {image?<Image source={{uri:image}} resizeMode="cover" style={styles.image}/>:
          <View style={styles.fallback}>
            <Ionicons name={kind==="TEAM"?"people-outline":"trophy-outline"} size={28} color={colors.primary}/>
          </View>}
      </Pressable>
    </View>
    <View style={[styles.content,{paddingLeft:isRTL?spacing.sm:0,paddingRight:isRTL?0:spacing.sm}]}>
      <View style={styles.identity}>
        <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={onDetails}>
          <AppText weight="bold" numberOfLines={2}>{name}</AppText>
        </Pressable>
        <AppText variant="caption" muted numberOfLines={2}>{detail}</AppText>
        {badge?<View style={[styles.metaRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="people-outline" size={14} color={colors.primary}/>
          <AppText variant="caption" weight="semibold" numberOfLines={1}
            style={{color:colors.primary,flexShrink:1}}>{badge}</AppText>
        </View>:null}
        {statusLabel?<View style={[styles.status,{
          alignSelf:isRTL?"flex-end":"flex-start",
          backgroundColor:statusTone==="success"?"#DCFCE7":statusTone==="warning"?"#FEF3C7":colors.surfaceMuted,
          borderColor:statusTone==="success"?"#BBF7D0":statusTone==="warning"?"#FDE68A":colors.border,
        }]}>
          <Ionicons name={statusTone==="success"?"checkmark-circle-outline":
            statusTone==="warning"?"time-outline":"lock-closed-outline"} size={13}
            color={statusTone==="success"?"#166534":statusTone==="warning"?"#92400E":colors.textMuted}/>
          <AppText variant="caption" weight="semibold" numberOfLines={1} style={{fontSize:10,
            color:statusTone==="success"?"#166534":statusTone==="warning"?"#92400E":colors.textMuted}}>
            {statusLabel}
          </AppText>
        </View>:null}
      </View>
      <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Pressable testID={`social-details-${id}`} accessibilityRole="button" accessibilityLabel={detailsLabel}
          style={({pressed})=>[styles.button,styles.outline,pressed&&styles.pressed]} onPress={onDetails}>
          <AppText variant="caption" numberOfLines={2} weight="semibold"
            style={styles.detailsText}>{detailsLabel}</AppText>
        </Pressable>
        {actionLabel?<Pressable testID={`social-action-${id}`} accessibilityRole="button" accessibilityLabel={actionLabel}
          accessibilityState={{disabled:actionDisabled||busy}}
          disabled={actionDisabled||busy} onPress={onAction}
          style={({pressed})=>[styles.button,styles.primary,(actionDisabled||busy)&&styles.disabled,pressed&&styles.pressed]}>
          <AppText variant="caption" weight="bold" numberOfLines={2}
            style={styles.actionText}>{actionLabel}</AppText>
        </Pressable>:null}
      </View>
    </View>
  </View>;
}
const styles=StyleSheet.create({
  card:{width:"100%",minHeight:134,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.lg,backgroundColor:colors.surface,overflow:"hidden"},
  gridCard:{width:"48.5%"},
  metaRow:{alignItems:"center",gap:4},
  status:{flexDirection:"row",alignItems:"center",gap:4,paddingHorizontal:7,paddingVertical:3,
    borderWidth:1,borderRadius:radius.pill,maxWidth:"100%"},
  imageColumn:{width:"25%",alignItems:"center",justifyContent:"center",paddingHorizontal:6,paddingVertical:spacing.sm},
  imageButton:{width:"100%",maxWidth:112,aspectRatio:1,borderRadius:radius.md,overflow:"hidden"},
  image:{width:"100%",height:"100%"},
  fallback:{width:"100%",height:"100%",backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  content:{width:"75%",minWidth:0,paddingVertical:spacing.sm,gap:spacing.sm,justifyContent:"space-between"},
  identity:{minWidth:0,gap:5},
  actions:{gap:6},
  button:{flex:1,minWidth:0,minHeight:46,alignItems:"center",justifyContent:"center",
    borderRadius:radius.sm,borderWidth:1,paddingHorizontal:3,paddingVertical:5},
  outline:{backgroundColor:colors.surface,borderColor:colors.primary},
  primary:{backgroundColor:colors.primary,borderColor:colors.primary},
  detailsText:{color:colors.primary,textAlign:"center"},
  actionText:{color:"#FFFFFF",textAlign:"center"},
  disabled:{opacity:.5},
  pressed:{opacity:.75},
});
