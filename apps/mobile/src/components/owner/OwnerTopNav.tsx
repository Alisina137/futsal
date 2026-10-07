import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { router, usePathname } from "expo-router";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "../ui/AppText";

type OwnerSection="competitions"|"schedule"|"media"|"analysis"|"settings";

const items:{
  key:OwnerSection;
  icon:keyof typeof Ionicons.glyphMap;
  labelKey:
    |"owner.dashboardNav.competitions"
    |"owner.dashboardNav.schedule"
    |"owner.dashboardNav.posts"
    |"owner.dashboardNav.analysis"
    |"owner.dashboardNav.settings";
  href:"/owner/competitions"|"/schedule"|"/owner/posts"|"/owner/analytics"|"/owner/onboarding";
}[]=[
  {key:"competitions",icon:"trophy-outline",labelKey:"owner.dashboardNav.competitions",href:"/owner/competitions"},
  {key:"schedule",icon:"calendar-outline",labelKey:"owner.dashboardNav.schedule",href:"/schedule"},
  {key:"media",icon:"images-outline",labelKey:"owner.dashboardNav.posts",href:"/owner/posts"},
  {key:"analysis",icon:"stats-chart-outline",labelKey:"owner.dashboardNav.analysis",href:"/owner/analytics"},
  {key:"settings",icon:"settings-outline",labelKey:"owner.dashboardNav.settings",href:"/owner/onboarding"},
];

function activeSection(pathname:string):OwnerSection|null{
  if(pathname==="/dashboard"||pathname.startsWith("/owner/competitions"))return "competitions";
  if(pathname==="/schedule"||pathname.startsWith("/owner/manual-booking")||pathname.startsWith("/owner/block-time"))return "schedule";
  if(pathname.startsWith("/owner/posts")||pathname.startsWith("/owner/promotions"))return "media";
  if(pathname.startsWith("/owner/analytics"))return "analysis";
  if(pathname.startsWith("/owner/onboarding")||pathname.startsWith("/owner/subscription"))return "settings";
  return null;
}

export function OwnerTopNav(){
  const pathname=usePathname();
  const {t,isRTL}=useLocale();
  const active=activeSection(pathname);

  return <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={styles.nav}
    contentContainerStyle={[
      styles.navContent,
      {flexDirection:isRTL?"row-reverse":"row"},
    ]}
  >
    {items.map((item)=>{
      const selected=active===item.key;
      return <Pressable
        key={item.key}
        accessibilityRole="tab"
        accessibilityState={{selected}}
        accessibilityLabel={t(item.labelKey)}
        onPress={()=>{
          if(!selected)router.replace(item.href);
        }}
        style={({pressed})=>[
          styles.item,
          selected&&styles.itemActive,
          pressed&&!selected&&styles.itemPressed,
        ]}
      >
        <Ionicons
          name={item.icon}
          size={18}
          color={selected?colors.primary:colors.textMuted}
        />
        <AppText
          variant="caption"
          weight={selected?"bold":"semibold"}
          numberOfLines={1}
          style={selected?styles.labelActive:undefined}
        >
          {t(item.labelKey)}
        </AppText>
      </Pressable>;
    })}
  </ScrollView>;
}

const styles=StyleSheet.create({
  nav:{
    flexGrow:0,
    flexShrink:0,
    marginHorizontal:-spacing.xs,
    borderTopWidth:1,
    borderBottomWidth:1,
    borderTopColor:colors.border,
    borderBottomColor:colors.border,
    backgroundColor:colors.background,
  },
  navContent:{
    gap:spacing.sm,
    paddingHorizontal:spacing.xs,
    paddingVertical:spacing.xs,
    alignItems:"center",
    flexWrap:"nowrap",
  },
  item:{
    height:44,
    paddingHorizontal:spacing.md,
    borderRadius:radius.pill,
    borderWidth:1,
    borderColor:"transparent",
    backgroundColor:colors.surface,
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"center",
    gap:spacing.xs,
  },
  itemActive:{
    borderColor:colors.primary,
    backgroundColor:colors.primarySoft,
  },
  itemPressed:{
    borderColor:colors.border,
    backgroundColor:colors.surfaceMuted,
  },
  labelActive:{
    color:colors.primary,
  },
});