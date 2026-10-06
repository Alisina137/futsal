import { Tabs } from "expo-router";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function TabsLayout(){
  const {t}=useLocale();
  const {session}=useAuth();
  const owner=session?.user.roles.includes("VENUE_OWNER")??false;

  return <Tabs screenOptions={{
    headerShown:false,
    tabBarStyle:{display:"none"},
  }}>
    <Tabs.Screen name="home" options={{title:owner?t("owner.dashboardTitle"):t("home.title")}}/>
    <Tabs.Screen name="venues" options={{title:t("booking.venuesTitle")}}/>
    <Tabs.Screen name="bookings" options={{title:t("booking.myBookings")}}/>
    <Tabs.Screen name="feed" options={{title:t("feed.title")}}/>
    <Tabs.Screen name="schedule" options={{...(!owner?{href:null}:{}),title:t("schedule.title")}}/>
    <Tabs.Screen name="settings" options={{title:t("profile.title")}}/>
  </Tabs>;
}
