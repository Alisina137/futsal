import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,spacing} from "@leaguekick/design-tokens";
import {Redirect,router} from "expo-router";
import {View} from "react-native";
import {AppText} from "../../src/components/ui/AppText";
import {Button} from "../../src/components/ui/Button";
import {Card} from "../../src/components/ui/Card";
import {Screen} from "../../src/components/ui/Screen";
import {useAuth} from "../../src/providers/AuthProvider";
import {useLocale} from "../../src/providers/LocaleProvider";
import {TeamManagerDashboard} from "../../src/components/team-manager/TeamManagerDashboard";
import {PlayerDashboard} from "../../src/components/player/PlayerDashboard";

export default function DashboardScreen(){
  const {session}=useAuth(),{t}=useLocale();
  const roles=session?.user.roles??[];
  if(roles.includes("PLATFORM_ADMIN"))return <Redirect href="/admin"/>;
  if(roles.includes("VENUE_OWNER"))return <Redirect href="/owner/competitions"/>;
  if(roles.includes("TEAM_MANAGER"))return <TeamManagerDashboard/>;
  // Normal accounts have the free player dashboard even without an explicit PLAYER role.
  if(!roles.includes("REFEREE")||roles.includes("PLAYER"))return <PlayerDashboard/>;
  return <Screen showHeader>
    <Card style={{gap:spacing.md}}>
      <View style={{alignItems:"center",gap:spacing.sm}}>
        <Ionicons name="flag-outline" size={32} color={colors.primary}/>
        <AppText variant="title" weight="bold">{t("dashboard.refereeTitle")}</AppText>
        <AppText muted>{t("dashboard.refereeBody")}</AppText>
      </View>
      <Button label={t("competition.title")} onPress={()=>router.push("/competitions")}/>
      <Button label={t("pd1.playerDashboard")} variant="secondary" onPress={()=>router.push("/dashboard/player")}/>
    </Card>
  </Screen>;
}
