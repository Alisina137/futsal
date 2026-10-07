import { colors, radius, spacing, touchTarget } from "@leaguekick/design-tokens";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useAuth } from "../../providers/AuthProvider";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "./AppText";

export function AppHeader(){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const user=session?.user;

  const initials=useMemo(()=>{
    const words=(user?.displayName??"LK").trim().split(/\s+/).filter(Boolean);
    return words.slice(0,2).map((word)=>word[0]?.toUpperCase()??"").join("")||"LK";
  },[user?.displayName]);

  return <View style={[styles.header,{flexDirection:isRTL?"row-reverse":"row"}]}>
    <View style={{flex:1,gap:1}}>
      <AppText variant="bodyLarge" weight="bold" style={{color:colors.primary}}>
        {t("common.appName")}
      </AppText>
      <AppText variant="caption" muted>{t("profile.headerSubtitle")}</AppText>
    </View>

    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("profile.openProfile")}
      onPress={()=>router.navigate("/settings")}
      style={({pressed})=>[styles.profileButton,pressed&&styles.profileButtonPressed]}
    >
      <AppText weight="bold" style={{color:colors.primary}}>{initials}</AppText>
    </Pressable>
  </View>;
}

const styles=StyleSheet.create({
  header:{
    width:"100%",
    maxWidth:720,
    alignSelf:"center",
    minHeight:68,
    paddingHorizontal:spacing.md,
    paddingVertical:spacing.sm,
    alignItems:"center",
    gap:spacing.md,
    backgroundColor:colors.surface,
    borderBottomWidth:1,
    borderBottomColor:colors.border,
  },
  profileButton:{
    width:touchTarget,
    height:touchTarget,
    borderRadius:radius.pill,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:colors.primarySoft,
    borderWidth:1,
    borderColor:"#B9CEF8",
    shadowColor:colors.primary,
    shadowOpacity:0.1,
    shadowRadius:8,
    shadowOffset:{width:0,height:3},
    elevation:2,
  },
  profileButtonPressed:{
    opacity:0.76,
    transform:[{scale:0.97}],
  },
});
