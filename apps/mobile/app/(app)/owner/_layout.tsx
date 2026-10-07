import { colors, spacing } from "@leaguekick/design-tokens";
import { Slot, usePathname } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OwnerTopNav } from "../../../src/components/owner/OwnerTopNav";
import { isTimetableRoute, TimetableSubNav } from "../../../src/components/owner/timetable/TimetableSubNav";
import { AppHeader } from "../../../src/components/ui/AppHeader";

export default function OwnerLayout(){
  const pathname=usePathname();
  const showTimetableNav=isTimetableRoute(pathname);
  return <SafeAreaView style={styles.safe} edges={["top","left","right"]}>
    <AppHeader/>
    <View style={styles.navFrame}>
      <OwnerTopNav/>
      {showTimetableNav?<TimetableSubNav/>:null}
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