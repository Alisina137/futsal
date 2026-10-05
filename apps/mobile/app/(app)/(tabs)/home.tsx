import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { OwnerDashboard } from "../../../src/components/owner/OwnerDashboard";
import { AppText } from "../../../src/components/ui/AppText";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function HomeScreen(){
  const {session}=useAuth();
  const owner=session?.user.roles.includes("VENUE_OWNER")??false;

  if(owner) return <OwnerDashboard/>;

  return <DiscoveryHome/>;
}

function DiscoveryHome(){
  const {t,isRTL}=useLocale();

  const actions=[
    {
      key:"venues",
      icon:"business-outline" as const,
      title:t("booking.findVenue"),
      body:t("home.discoveryVenuesBody"),
      onPress:()=>router.push("/venues"),
    },
    {
      key:"feed",
      icon:"newspaper-outline" as const,
      title:t("feed.title"),
      body:t("home.discoveryFeedBody"),
      onPress:()=>router.push("/feed"),
    },
    {
      key:"competitions",
      icon:"trophy-outline" as const,
      title:t("competition.title"),
      body:t("home.discoveryCompetitionsBody"),
      onPress:()=>router.push("/competitions"),
    },
  ];

  return <Screen showHeader>
    <View style={styles.hero}>
      <View style={[styles.heroBadge,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="football" size={18} color="#86EFAC"/>
        <AppText variant="caption" weight="bold" style={styles.heroBadgeText}>{t("auth.heroEyebrow")}</AppText>
      </View>
      <AppText variant="title" weight="bold" style={styles.heroTitle}>{t("home.discoveryTitle")}</AppText>
      <AppText style={styles.heroBody}>{t("home.discoveryBody")}</AppText>
    </View>

    <View style={styles.grid}>
      {actions.map((action)=><Card key={action.key} style={styles.actionCard}>
        <View style={[styles.actionTop,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.actionIcon}>
            <Ionicons name={action.icon} size={24} color={colors.primary}/>
          </View>
          <View style={styles.actionCopy}>
            <AppText variant="bodyLarge" weight="bold">{action.title}</AppText>
            <AppText variant="caption" muted>{action.body}</AppText>
          </View>
        </View>
        <View
          accessibilityRole="button"
          accessibilityLabel={action.title}
          onTouchEnd={action.onPress}
          style={[styles.openRow,{flexDirection:isRTL?"row-reverse":"row"}]}
        >
          <AppText weight="semibold" style={{color:colors.primary}}>{t("common.open")}</AppText>
          <Ionicons name={isRTL?"arrow-back":"arrow-forward"} size={18} color={colors.primary}/>
        </View>
      </Card>)}
    </View>
  </Screen>;
}

const styles=StyleSheet.create({
  hero:{
    backgroundColor:"#071A2B",
    borderRadius:radius.lg,
    padding:spacing.lg,
    gap:spacing.sm,
    shadowColor:"#071A2B",
    shadowOpacity:0.18,
    shadowRadius:14,
    shadowOffset:{width:0,height:6},
    elevation:4,
  },
  heroBadge:{
    alignSelf:"flex-start",
    alignItems:"center",
    gap:spacing.xs,
    paddingHorizontal:spacing.sm,
    paddingVertical:6,
    borderRadius:radius.pill,
    backgroundColor:"rgba(255,255,255,0.08)",
  },
  heroBadgeText:{color:"#DDFBE6"},
  heroTitle:{color:"#FFFFFF"},
  heroBody:{color:"#C7D5E2"},
  grid:{gap:spacing.md},
  actionCard:{gap:spacing.md,padding:spacing.lg},
  actionTop:{alignItems:"center",gap:spacing.md},
  actionIcon:{
    width:50,
    height:50,
    borderRadius:16,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:colors.primarySoft,
  },
  actionCopy:{flex:1,gap:spacing.xs},
  openRow:{
    minHeight:44,
    alignItems:"center",
    justifyContent:"flex-end",
    gap:spacing.xs,
    borderTopWidth:1,
    borderTopColor:colors.border,
    paddingTop:spacing.sm,
  },
});
