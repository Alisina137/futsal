import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "@leaguekick/design-tokens";
import { Tabs } from "expo-router";
import { useLocale } from "../../../src/providers/LocaleProvider";
export default function TabsLayout(){const {t,isRTL}=useLocale(); return <Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:colors.primary,tabBarInactiveTintColor:colors.textMuted,tabBarStyle:{height:64,paddingTop:6,paddingBottom:8,borderTopColor:colors.border,backgroundColor:colors.surface,flexDirection:isRTL?"row-reverse":"row"}}}><Tabs.Screen name="home" options={{title:t("home.title"),tabBarIcon:({color,size})=><Ionicons name="home-outline" color={color} size={size}/>}}/><Tabs.Screen name="settings" options={{title:t("settings.title"),tabBarIcon:({color,size})=><Ionicons name="settings-outline" color={color} size={size}/>}}/></Tabs>;}
