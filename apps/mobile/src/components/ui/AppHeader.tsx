import { resolveMediaImageUrl } from "../../lib/api";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing, touchTarget } from "@leaguekick/design-tokens";
import { router, usePathname } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../providers/AuthProvider";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "./AppText";

type IconName = keyof typeof Ionicons.glyphMap;


export function AppHeader(){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const insets=useSafeAreaInsets();
  const {height:windowHeight}=useWindowDimensions();
  const pathname=usePathname();
  const [menuOpen,setMenuOpen]=useState(false);
  const user=session?.user;
  const hasDashboard=user?.roles.some((role)=>
    ["PLAYER","VENUE_OWNER","TEAM_MANAGER","REFEREE","PLATFORM_ADMIN"].includes(role)
  )??false;

  const initials=useMemo(()=>{
    const words=(user?.displayName??"LK").trim().split(/\s+/).filter(Boolean);
    return words.slice(0,2).map((word)=>word[0]?.toUpperCase()??"").join("")||"LK";
  },[user?.displayName]);

  const items:Array<{key:string;label:string;icon:IconName;href:string}>= [
    {
      key:"home",
      label:t("home.title"),
      icon:"home-outline",
      href:"/home",
    },
    ...(hasDashboard?[{
      key:"dashboard",
      label:t("dashboard.title"),
      icon:"grid-outline" as IconName,
      href:"/dashboard",
    }]:[]),
    {key:"venues",label:t("booking.venuesTitle"),icon:"football-outline",href:"/venues"},
    {key:"teams",label:t("teams.title"),icon:"people-outline",href:"/teams"},
    {key:"competitions",label:t("competition.title"),icon:"trophy-outline",href:"/competitions"},
    {key:"bookings",label:t("booking.myBookings"),icon:"calendar-outline",href:"/bookings"},
    {key:"profile",label:t("profile.title"),icon:"person-circle-outline",href:"/settings"},
  ];

  function navigate(href:string){
    setMenuOpen(false);
    router.navigate(href as never);
  }

  return <>
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("navigation.openMenu")}
        accessibilityState={{expanded:menuOpen}}
        onPress={()=>setMenuOpen(true)}
        style={({pressed})=>[styles.headerButton,pressed&&styles.buttonPressed]}
      >
        <Ionicons name="menu-outline" size={26} color={colors.primary}/>
      </Pressable>

      <View style={styles.brand}>
        <View style={[styles.brandIdentity,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Image
            source={require("../../../assets/icon.png")}
            style={styles.brandLogo}
            accessibilityLabel={t("common.appName")}
          />
          <AppText variant="bodyLarge" weight="bold" style={styles.brandTitle} numberOfLines={1}>
            {t("common.appName")}
          </AppText>
        </View>
        <AppText variant="caption" muted numberOfLines={1}>{t("profile.headerSubtitle")}</AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("profile.openProfile")}
        onPress={()=>router.navigate("/settings")}
        style={({pressed})=>[styles.profileButton,pressed&&styles.buttonPressed]}
      >
        {user?.profileImageUrl
          ?<Image source={{uri:resolveMediaImageUrl(user.profileImageUrl)!}} style={styles.profileImage}/>
          :<AppText weight="bold" style={{color:colors.primary}}>{initials}</AppText>}
      </Pressable>
    </View>

    <Modal
      visible={menuOpen}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={()=>setMenuOpen(false)}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("navigation.closeMenu")}
        style={styles.modalRoot}
        onPress={()=>setMenuOpen(false)}
      >
        <Pressable
          onPress={(event)=>event.stopPropagation()}
          style={[
            styles.drawer,
            {
              marginTop:insets.top+spacing.sm+20,
              marginLeft:spacing.sm,
              maxHeight:Math.max(240,windowHeight-(insets.top+spacing.lg)),
            },
          ]}
        >
          <View style={styles.drawerHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("navigation.closeMenu")}
              onPress={()=>setMenuOpen(false)}
              style={({pressed})=>[styles.closeButton,pressed&&styles.buttonPressed]}
            >
              <Ionicons name="close-outline" size={25} color={colors.text}/>
            </Pressable>
            <View style={[styles.drawerIdentity,{alignItems:isRTL?"flex-end":"flex-start"}]}>
              <AppText variant="bodyLarge" weight="bold">{t("common.appName")}</AppText>
              <AppText variant="caption" muted>{user?.displayName??""}</AppText>
            </View>
            <View style={styles.drawerBrandIcon}>
              <Image source={require("../../../assets/icon.png")} style={styles.drawerBrandLogo}/>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.menuList}
            showsVerticalScrollIndicator={false}
          >
            {items.map((item)=>{
              const active=pathname===item.href||pathname.startsWith(item.href+"/");
              return <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{selected:active}}
                onPress={()=>navigate(item.href)}
                style={({pressed})=>[
                  styles.menuItem,
                  {flexDirection:isRTL?"row-reverse":"row"},
                  active&&styles.menuItemActive,
                  pressed&&styles.menuItemPressed,
                ]}
              >
                <View style={[styles.menuIcon,active&&styles.menuIconActive]}>
                  <Ionicons name={item.icon} size={21} color={active?colors.primary:"#526274"}/>
                </View>
                <AppText weight={active?"bold":"medium"} style={[styles.menuLabel,active&&styles.menuLabelActive]}>
                  {item.label}
                </AppText>
                <Ionicons
                  name={isRTL?"chevron-back":"chevron-forward"}
                  size={18}
                  color={active?colors.primary:colors.textMuted}
                />
              </Pressable>;
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  </>;
}

const styles=StyleSheet.create({
  header:{
    width:"100%",
    maxWidth:720,
    alignSelf:"center",
    minHeight:68,
    paddingHorizontal:spacing.md,
    paddingVertical:spacing.sm,
    flexDirection:"row",
    alignItems:"center",
    gap:spacing.sm,
    backgroundColor:colors.surface,
    borderBottomWidth:1,
    borderBottomColor:colors.border,
  },
  headerButton:{
    width:touchTarget,
    height:touchTarget,
    borderRadius:radius.md,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:colors.surfaceMuted,
    borderWidth:1,
    borderColor:colors.border,
  },
  brand:{
    flex:1,
    minWidth:0,
    alignItems:"center",
    gap:1,
  },
  brandIdentity:{
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"center",
    gap:spacing.sm,
    minWidth:0,
  },
  brandLogo:{
    width:33,
    height:33,
    borderRadius:10,
  },
  brandTitle:{
    color:colors.primary,
    textAlign:"center",
    flexShrink:1,
  },
  profileButton:{
    width:touchTarget,
    height:touchTarget,
    borderRadius:radius.pill,
    alignItems:"center",
    justifyContent:"center",
    overflow:"hidden",
    backgroundColor:colors.primarySoft,
    borderWidth:1,
    borderColor:"#B9CEF8",
    shadowColor:colors.primary,
    shadowOpacity:0.1,
    shadowRadius:8,
    shadowOffset:{width:0,height:3},
    elevation:2,
  },
  profileImage:{
    width:"100%",
    height:"100%",
  },
  buttonPressed:{
    opacity:0.76,
    transform:[{scale:0.97}],
  },
  modalRoot:{
    flex:1,
    alignItems:"flex-start",
    backgroundColor:"rgba(7,26,43,0.46)",
  },
  drawer:{
    width:272,
    maxWidth:"82%",
    alignSelf:"flex-start",
    paddingHorizontal:spacing.sm,
    paddingTop:0,
    paddingBottom:spacing.md,
    backgroundColor:colors.surface,
    borderRadius:radius.lg,
    shadowColor:"#071A2B",
    shadowOpacity:0.2,
    shadowRadius:20,
    shadowOffset:{width:6,height:4},
    elevation:16,
  },
  drawerHeader:{
    minHeight:62,
    flexDirection:"row",
    alignItems:"center",
    gap:spacing.sm,
    borderBottomWidth:1,
    borderBottomColor:colors.border,
    marginBottom:spacing.md,
  },
  drawerIdentity:{
    flex:1,
    gap:2,
  },
  drawerBrandIcon:{
    width:38,
    height:38,
    borderRadius:12,
    overflow:"hidden",
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:"#0B1D45",
  },
  drawerBrandLogo:{width:38,height:38},
  closeButton:{
    width:touchTarget,
    height:touchTarget,
    alignItems:"center",
    justifyContent:"center",
    borderRadius:radius.md,
  },
  menuList:{
    gap:spacing.xs,
    paddingBottom:spacing.xs,
  },
  menuItem:{
    minHeight:52,
    alignItems:"center",
    gap:spacing.sm,
    paddingHorizontal:spacing.sm,
    borderRadius:radius.md,
  },
  menuItemActive:{
    backgroundColor:colors.primarySoft,
  },
  menuItemPressed:{
    opacity:0.72,
  },
  menuIcon:{
    width:40,
    height:40,
    borderRadius:12,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:colors.surfaceMuted,
  },
  menuIconActive:{
    backgroundColor:"#FFFFFF",
  },
  menuLabel:{
    flex:1,
  },
  menuLabelActive:{
    color:colors.primary,
  },
});
