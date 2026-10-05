import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "@leaguekick/design-tokens";
import { Tabs } from "expo-router";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function TabsLayout(){
  const {t,isRTL}=useLocale();
  const {session}=useAuth();
  const owner=session?.user.roles.includes("VENUE_OWNER")??false;
  const player=session?.user.roles.includes("PLAYER")??false;

  return <Tabs screenOptions={{
    headerShown:false,
    tabBarActiveTintColor:colors.primary,
    tabBarInactiveTintColor:colors.textMuted,
    tabBarLabelStyle:{fontSize:11,fontWeight:"600",marginTop:2},
    tabBarItemStyle:{paddingVertical:4},
    tabBarStyle:{
      height:70,
      paddingTop:6,
      paddingBottom:8,
      borderTopWidth:0,
      backgroundColor:colors.surface,
      direction:isRTL?"rtl":"ltr",
      shadowColor:"#0F172A",
      shadowOpacity:0.08,
      shadowRadius:12,
      shadowOffset:{width:0,height:-3},
      elevation:10,
    },
  }}>
    <Tabs.Screen name="home" options={{title:owner?t("owner.dashboardTitle"):t("home.title"),tabBarIcon:({color,size})=><Ionicons name={owner?"speedometer-outline":"home-outline"} color={color} size={size}/>}}/>
    <Tabs.Screen name="venues" options={{...(owner?{href:null}:{}),title:t("booking.venuesTitle"),tabBarIcon:({color,size})=><Ionicons name="business-outline" color={color} size={size}/>}}/>
    <Tabs.Screen name="bookings" options={{...((owner||!player)?{href:null}:{}),title:t("booking.myBookings"),tabBarIcon:({color,size})=><Ionicons name="calendar-outline" color={color} size={size}/>}}/>
    <Tabs.Screen name="feed" options={{...(owner?{href:null}:{}),title:t("feed.title"),tabBarIcon:({color,size})=><Ionicons name="newspaper-outline" color={color} size={size}/>}}/>
    <Tabs.Screen name="schedule" options={{...(!owner?{href:null}:{}),title:t("schedule.title"),tabBarIcon:({color,size})=><Ionicons name="time-outline" color={color} size={size}/>}}/>
    <Tabs.Screen name="settings" options={{title:t("profile.title"),tabBarIcon:({color,size})=><Ionicons name="person-circle-outline" color={color} size={size}/>}}/>
  </Tabs>;
}
