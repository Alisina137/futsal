import { Tabs } from "expo-router";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function TabsLayout(){
  const {t}=useLocale();
  return <Tabs screenOptions={{
    headerShown:false,
    animation:"none",
    tabBarStyle:{display:"none"},
  }}>
    <Tabs.Screen name="home" options={{title:t("home.title")}}/>
    <Tabs.Screen name="venues" options={{title:t("booking.venuesTitle")}}/>
    <Tabs.Screen name="bookings" options={{title:t("booking.myBookings")}}/>
    <Tabs.Screen name="feed" options={{title:t("feed.title")}}/>
    <Tabs.Screen name="schedule" options={{href:null,title:t("schedule.title")}}/>
    <Tabs.Screen name="settings" options={{title:t("profile.title")}}/>
  </Tabs>;
}
