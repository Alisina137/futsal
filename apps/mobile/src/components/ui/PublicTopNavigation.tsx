import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, spacing } from "@leaguekick/design-tokens";
import { router, useFocusEffect, usePathname } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { notificationApi } from "../../lib/api";
import { onNotificationUnreadChange, publishNotificationUnread } from "../../lib/notification-events";
import { useAuth } from "../../providers/AuthProvider";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "./AppText";

type NavItem={
  key:"home"|"venues"|"teams"|"competitions"|"notifications";
  href:"/home"|"/venues"|"/teams"|"/competitions"|"/notifications";
  label:string;
  icon:keyof typeof Ionicons.glyphMap;
  selectedIcon:keyof typeof Ionicons.glyphMap;
};

/**
 * Shared Facebook-inspired top navigation. These five public destinations have
 * identical behavior across Normal User, Player, Venue Owner, Team Manager and
 * Referee. The platform admin uses a completely separate management interface.
 */
export function PublicTopNavigation(){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const pathname=usePathname();
  const [unread,setUnread]=useState(0);

  const isPlatformAdmin=session?.user.roles.includes("PLATFORM_ADMIN")??false;
  const token=!isPlatformAdmin?session?.accessToken:undefined;

  useFocusEffect(useCallback(()=>{
    if(!token){setUnread(0);return;}
    let active=true;
    const unsubscribe=onNotificationUnreadChange((source,count)=>{
      if(active&&source===token)setUnread(count);
    });
    notificationApi.list(token).then(({unreadCount})=>{
      if(active){setUnread(unreadCount);publishNotificationUnread(token,unreadCount);}
    }).catch(()=>{
      // No fabricated badge when offline. Navigation remains usable.
      if(active)setUnread(0);
    });
    return ()=>{active=false;unsubscribe();};
  },[token]));

  if(isPlatformAdmin)return null;

  const items:NavItem[]=[
    {key:"home",href:"/home",label:t("home.title"),icon:"home-outline",selectedIcon:"home"},
    {key:"venues",href:"/venues",label:t("booking.venuesTitle"),icon:"football-outline",selectedIcon:"football"},
    {key:"teams",href:"/teams",label:t("teams.title"),icon:"people-outline",selectedIcon:"people"},
    {key:"competitions",href:"/competitions",label:t("competition.title"),icon:"trophy-outline",selectedIcon:"trophy"},
    {key:"notifications",href:"/notifications",label:t("notifications.title"),icon:"notifications-outline",selectedIcon:"notifications"},
  ];

  return <View style={styles.container}>
    <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {items.map(item=>{
        const active=pathname===item.href||pathname.startsWith(item.href+"/");
        const badge=item.key==="notifications"&&unread>0;
        const accessibilityLabel=badge?`${item.label}, ${unread} ${t("notifications.unread")}`:item.label;
        return <Pressable
          key={item.key}
          testID={`public-nav-${item.key}`}
          accessibilityRole="tab"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{selected:active}}
          onPress={()=>{if(!active)router.navigate(item.href);}}
          style={({pressed})=>[styles.tab,pressed&&styles.pressed]}
        >
          <View style={styles.iconArea}>
            <Ionicons name={active?item.selectedIcon:item.icon} size={23} color={active?colors.primary:colors.textMuted}/>
            {badge?<View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <AppText variant="caption" weight="bold" style={styles.badgeText} forceLtr>{unread>99?"99+":String(unread)}</AppText>
            </View>:null}
          </View>
          <AppText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}
            variant="caption" weight={active?"bold":"medium"}
            style={[styles.label,active&&styles.labelActive]}>{item.label}</AppText>
          <View style={[styles.indicator,active&&styles.indicatorActive]}/>
        </Pressable>;
      })}
    </View>
  </View>;
}

const styles=StyleSheet.create({
  container:{width:"100%",maxWidth:720,alignSelf:"center",backgroundColor:colors.surface,borderBottomWidth:1,borderBottomColor:colors.border},
  row:{width:"100%",alignItems:"stretch"},
  tab:{flex:1,minWidth:0,height:64,alignItems:"center",justifyContent:"flex-end",paddingTop:3,paddingHorizontal:2},
  pressed:{backgroundColor:colors.surfaceMuted},
  iconArea:{height:34,minHeight:34,alignItems:"center",justifyContent:"center"},
  label:{color:colors.textMuted,textAlign:"center",fontSize:10,lineHeight:15,marginBottom:5,width:"100%"},
  labelActive:{color:colors.primary},
  indicator:{height:3,width:"100%",backgroundColor:"transparent",borderTopLeftRadius:4,borderTopRightRadius:4},
  indicatorActive:{backgroundColor:colors.primary},
  badge:{position:"absolute",top:0,right:-16,minWidth:19,height:19,paddingHorizontal:3,borderRadius:10,backgroundColor:"#DC2626",
    alignItems:"center",justifyContent:"center",borderColor:colors.surface,borderWidth:1},
  badgeText:{fontSize:10,lineHeight:13,color:"#FFFFFF"},
});
