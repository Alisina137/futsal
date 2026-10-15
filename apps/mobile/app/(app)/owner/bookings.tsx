import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,spacing} from "@leaguekick/design-tokens";
import {router} from "expo-router";
import {View} from "react-native";
import {OwnerPendingBookings} from "../../../src/components/owner/OwnerPendingBookings";
import {AppText} from "../../../src/components/ui/AppText";
import {Button} from "../../../src/components/ui/Button";
import {Screen} from "../../../src/components/ui/Screen";
import {useAuth} from "../../../src/providers/AuthProvider";
import {useLocale} from "../../../src/providers/LocaleProvider";

/** Phase 1 establishes the dedicated booking inbox without duplicating any
 * approve/reject write logic. Upcoming, All and History arrive in Phase 3. */
export default function OwnerBookingsScreen(){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  return <Screen embedded>
    <View testID="owner-phase1-bookings" style={{gap:spacing.md}}>
      <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,alignItems:"center"}}>
        <Ionicons name="receipt-outline" size={25} color={colors.primary}/>
        <View style={{flex:1,gap:3}}>
          <AppText variant="title" weight="bold">{t("owner.dashboardNav.bookings")}</AppText>
          <AppText variant="caption" muted>{t("owner.phase1.bookingsSubtitle")}</AppText>
        </View>
      </View>
      <OwnerPendingBookings token={session?.accessToken}/>
      <Button label={t("owner.phase1.openCalendar")} variant="secondary"
        onPress={()=>router.push("/owner/schedule")}/>
    </View>
  </Screen>;
}
