import Ionicons from "@expo/vector-icons/Ionicons";
import { radius, spacing } from "@leaguekick/design-tokens";
import { StyleSheet, View } from "react-native";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "../ui/AppText";

export function AuthHero() {
  const { t, isRTL } = useLocale();

  return <View style={styles.hero}>
    <View style={styles.pitchLineOuter} pointerEvents="none"/>
    <View style={styles.pitchLineCenter} pointerEvents="none"/>
    <View style={styles.pitchCircle} pointerEvents="none"/>

    <View style={[styles.topRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.mark}>
        <Ionicons name="football" size={28} color="#FFFFFF"/>
      </View>
      <View style={{flex:1,gap:2}}>
        <AppText variant="caption" weight="bold" style={styles.eyebrow}>{t("auth.heroEyebrow")}</AppText>
        <AppText variant="caption" style={styles.micro}>{t("profile.headerSubtitle")}</AppText>
      </View>
      <View style={styles.liveDot}/>
    </View>

    <View style={styles.copy}>
      <AppText variant="display" weight="bold" style={styles.title}>{t("auth.heroTitle")}</AppText>
      <AppText style={styles.body}>{t("auth.heroBody")}</AppText>
    </View>

    <View style={[styles.chips,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.chip}><Ionicons name="flash-outline" size={14} color="#CFF8DD"/><AppText variant="caption" weight="semibold" style={styles.chipText}>{t("common.online")}</AppText></View>
      <View style={styles.chip}><Ionicons name="shield-checkmark-outline" size={14} color="#CFF8DD"/><AppText variant="caption" weight="semibold" style={styles.chipText}>{t("settings.secureSession")}</AppText></View>
      <View style={styles.chip}><Ionicons name="trophy-outline" size={14} color="#CFF8DD"/><AppText variant="caption" weight="semibold" style={styles.chipText}>{t("common.appName")}</AppText></View>
    </View>
  </View>;
}

const styles=StyleSheet.create({
  hero:{
    minHeight:250,
    borderRadius:radius.lg+4,
    padding:spacing.lg,
    overflow:"hidden",
    backgroundColor:"#071A2B",
    gap:spacing.xl,
    shadowColor:"#071A2B",
    shadowOpacity:0.24,
    shadowRadius:18,
    shadowOffset:{width:0,height:9},
    elevation:7,
  },
  pitchLineOuter:{position:"absolute",right:-58,top:26,width:210,height:210,borderWidth:1,borderColor:"rgba(95,235,155,0.18)",borderRadius:8,transform:[{rotate:"18deg"}]},
  pitchLineCenter:{position:"absolute",right:38,top:0,bottom:0,width:1,backgroundColor:"rgba(95,235,155,0.14)",transform:[{rotate:"18deg"}]},
  pitchCircle:{position:"absolute",right:12,top:82,width:88,height:88,borderRadius:44,borderWidth:1,borderColor:"rgba(95,235,155,0.20)"},
  topRow:{alignItems:"center",gap:spacing.sm,zIndex:2},
  mark:{width:52,height:52,borderRadius:18,backgroundColor:"#16A34A",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"rgba(255,255,255,0.18)"},
  eyebrow:{color:"#86EFAC",letterSpacing:1.2},
  micro:{color:"#A9BED0"},
  liveDot:{width:9,height:9,borderRadius:5,backgroundColor:"#86EFAC",shadowColor:"#86EFAC",shadowOpacity:0.8,shadowRadius:8,elevation:2},
  copy:{gap:spacing.sm,zIndex:2,maxWidth:440},
  title:{color:"#FFFFFF",letterSpacing:-0.7},
  body:{color:"#C7D5E2",maxWidth:400},
  chips:{gap:spacing.sm,flexWrap:"wrap",zIndex:2},
  chip:{minHeight:30,borderRadius:999,paddingHorizontal:spacing.sm,flexDirection:"row",alignItems:"center",gap:5,backgroundColor:"rgba(255,255,255,0.08)",borderWidth:1,borderColor:"rgba(255,255,255,0.10)"},
  chipText:{color:"#E9FFF0",letterSpacing:0.5},
});
