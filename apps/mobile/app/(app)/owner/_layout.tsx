import { colors, spacing } from "@leaguekick/design-tokens";
import { Redirect, Slot, usePathname } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OwnerTopNav } from "../../../src/components/owner/OwnerTopNav";
import { OwnerManagementSubNav } from "../../../src/components/owner/OwnerManagementSubNav";
import { useAuth } from "../../../src/providers/AuthProvider";
import { isTimetableRoute, TimetableSubNav } from "../../../src/components/owner/timetable/TimetableSubNav";
import { AppHeader } from "../../../src/components/ui/AppHeader";

export default function OwnerLayout(){
  const pathname=usePathname();
  const {session}=useAuth();
  if(session&&!session.user.roles.includes("VENUE_OWNER"))return <Redirect href="/dashboard"/>;
  const showTimetableNav=isTimetableRoute(pathname);
  return <SafeAreaView style={styles.safe} edges={["top","left","right"]}>
    <AppHeader/>
    <View style={styles.navFrame}>
      <OwnerTopNav/>
      {showTimetableNav?<TimetableSubNav/>:<OwnerManagementSubNav/>}
    </View>
    <View style={styles.content}>
      <Slot/>
    </View>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  safe:{
    flex:1,
    backgroundColor:colors.background,
  },
  navFrame:{
    width:"100%",
    maxWidth:720,
    alignSelf:"center",
    paddingHorizontal:spacing.md,
  },
  content:{
    flex:1,
    minHeight:0,
  },
});