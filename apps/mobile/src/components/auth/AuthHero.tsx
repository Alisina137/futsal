import Ionicons from "@expo/vector-icons/Ionicons";
import { radius, spacing } from "@leaguekick/design-tokens";
import { Image, ImageBackground, StyleSheet, View } from "react-native";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "../ui/AppText";

export function AuthHero() {
  const { t, isRTL } = useLocale();

  return <ImageBackground
    testID="auth-court-background"
    source={require("../../../assets/auth-futsal-court.jpg")}
    resizeMode="cover"
    imageStyle={styles.heroImage}
    style={styles.hero}>
    {/* An even, translucent scrim keeps the supplied colorful futsal court
        visible while maintaining legible white copy on all screen sizes. */}
    <View style={styles.photoScrim} pointerEvents="none"/>

    <View style={[styles.topRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.mark}>
        <Image source={require("../../../assets/icon.png")} style={styles.markImage} accessibilityLabel={t("common.appName")}/>
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
      <View style={styles.chip}><Ionicons name="flash-outline" size={14} color="#C8EEFF"/><AppText variant="caption" weight="semibold" style={styles.chipText}>{t("common.online")}</AppText></View>
      <View style={styles.chip}><Ionicons name="shield-checkmark-outline" size={14} color="#C8EEFF"/><AppText variant="caption" weight="semibold" style={styles.chipText}>{t("settings.secureSession")}</AppText></View>
      <View style={styles.chip}><Ionicons name="trophy-outline" size={14} color="#C8EEFF"/><AppText variant="caption" weight="semibold" style={styles.chipText}>{t("common.appName")}</AppText></View>
    </View>
  </ImageBackground>;
}

const styles=StyleSheet.create({
  hero:{
    minHeight:268,
    borderRadius:radius.lg+4,
    padding:spacing.lg,
    overflow:"hidden",
    backgroundColor:"#0B2645",
    gap:spacing.xl,
    shadowColor:"#071A2B",
    shadowOpacity:0.24,
    shadowRadius:18,
    shadowOffset:{width:0,height:9},
    elevation:7,
  },
  heroImage:{borderRadius:radius.lg+4},
  photoScrim:{
    ...StyleSheet.absoluteFillObject,
    backgroundColor:"rgba(5,16,31,0.40)",
    borderRadius:radius.lg+4,
  },
  topRow:{alignItems:"center",gap:spacing.sm,zIndex:2},
  mark:{width:52,height:52,borderRadius:16,overflow:"hidden",backgroundColor:"#0B1D45",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"rgba(147,215,255,0.75)"},
  markImage:{width:"100%",height:"100%"},
  eyebrow:{color:"#7DD3FC",letterSpacing:1.2},
  micro:{color:"#A9BED0"},
  liveDot:{width:9,height:9,borderRadius:5,backgroundColor:"#7DD3FC",shadowColor:"#7DD3FC",shadowOpacity:0.8,shadowRadius:8,elevation:2},
  copy:{gap:spacing.sm,zIndex:2,maxWidth:440},
  title:{
    color:"#FFFFFF",letterSpacing:-0.7,
    textShadowColor:"rgba(0,0,0,0.78)",textShadowOffset:{width:0,height:2},
    textShadowRadius:6,
  },
  body:{
    color:"#F3F8FF",maxWidth:400,
    textShadowColor:"rgba(0,0,0,0.82)",textShadowOffset:{width:0,height:1},
    textShadowRadius:4,
  },
  chips:{gap:spacing.sm,flexWrap:"wrap",zIndex:2},
  chip:{minHeight:30,borderRadius:999,paddingHorizontal:spacing.sm,flexDirection:"row",alignItems:"center",gap:5,backgroundColor:"rgba(255,255,255,0.08)",borderWidth:1,borderColor:"rgba(255,255,255,0.10)"},
  chipText:{color:"#EAF7FF",letterSpacing:0.5},
});
