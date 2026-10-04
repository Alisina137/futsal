import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "@leaguekick/design-tokens";
import { Tabs } from "expo-router";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function TabsLayout(){
  const {t,isRTL}=useLocale();
  const {session}=useAuth();
  const owner=session?.user.roles.includes("VENUE_OWNER")??false;
  return <Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:colors.primary,tabBarInactiveTintColor:colors.textMuted,tabBarStyle:{height:64,paddingTop:6,paddingBottom:8,borderTopColor:colors.border,backgroundColor:colors.surface,flexDirection:isRTL?"row-reverse":"row"}}}>
    <Tabs.Screen name="home" options={{title:owner?t("owner.dashboardTitle"):t("home.title"),tabBarIcon:({color,size})=><Ionicons name={owner?"speedometer-outline":"home-outline"} color={color} size={size}/>}}/>
    <Tabs.Screen name="venues" options={{href:owner?null:undefined,title:t("booking.venuesTitle"),tabBarIcon:({color,size})=><Ionicons name="business-outline" color={color} size={size}/>}}/>
    <Tabs.Screen name="bookings" options={{href:owner?null:undefined,title:t("booking.myBookings"),tabBarIcon:({color,size})=><Ionicons name="calendar-outline" color={color} size={size}/>}}/>
    <Tabs.Screen name="settings" options={{title:t("settings.title"),tabBarIcon:({color,size})=><Ionicons name="settings-outline" color={color} size={size}/>}}/>
  </Tabs>;
}
