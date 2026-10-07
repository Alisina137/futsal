import { colors, spacing } from "@leaguekick/design-tokens";
import type { UserDto } from "@leaguekick/contracts";
import { View } from "react-native";
import { router } from "expo-router";
import { OwnerDashboard } from "../../../src/components/owner/OwnerDashboard";
import { AppText } from "../../../src/components/ui/AppText";
import { Card } from "../../../src/components/ui/Card";
import { Button } from "../../../src/components/ui/Button";
import { Screen } from "../../../src/components/ui/Screen";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";
import { useNetwork } from "../../../src/providers/NetworkProvider";

export default function HomeScreen(){
  const {session}=useAuth();
  const user=session?.user;
  return user?.roles.includes("VENUE_OWNER") ? <OwnerDashboard/> : <PlayerHome user={user}/>;
}

function PlayerHome({user}:{user:UserDto|undefined}){
  const {t,language,isRTL}=useLocale();
  const {isOnline}=useNetwork();
  const role=user?.roles[0]??"PLAYER";
  return <Screen showHeader>
    <View style={{
      backgroundColor:colors.primary,
      borderRadius:20,
      padding:spacing.lg,
      gap:spacing.sm,
      shadowColor:colors.primary,
      shadowOpacity:0.18,
      shadowRadius:14,
      shadowOffset:{width:0,height:6},
      elevation:4,
    }}>
      <AppText variant="title" weight="bold" style={{color:"#FFFFFF"}}>{t("home.greeting",{name:user?.displayName??""})}</AppText>
      <AppText style={{color:"#DCE8FF"}}>{t("home.foundationBody")}</AppText>
    </View>
    <Card>
      <AppText weight="semibold" style={{color:colors.primary}}>{t("home.foundationTitle")}</AppText>
      <View style={{gap:spacing.sm}}>
        <InfoRow label={t("home.accountRole")} value={t(`role.${role}` as never)} rtl={isRTL}/>
        <InfoRow label={t("home.connection")} value={isOnline?t("common.online"):t("network.offlineTitle")} rtl={isRTL}/>
        <InfoRow label={t("home.language")} value={language} rtl={isRTL} ltrValue/>
      </View>
    </Card>
    <Card style={{backgroundColor:colors.primarySoft}}>
      <AppText weight="semibold">{t("booking.quickStart")}</AppText>
      <AppText>{t("booking.quickStartBody")}</AppText>
      <Button label={t("booking.findVenue")} onPress={()=>router.push("/venues")} />
      <Button label={t("booking.myBookings")} onPress={()=>router.push("/bookings")} variant="secondary" />
    </Card>
  </Screen>;
}

function InfoRow({label,value,rtl,ltrValue=false}:{label:string;value:string;rtl:boolean;ltrValue?:boolean}){
  return <View style={{flexDirection:rtl?"row-reverse":"row",justifyContent:"space-between",gap:spacing.md}}>
    <AppText muted>{label}</AppText>
    <AppText weight="semibold" forceLtr={ltrValue}>{value}</AppText>
  </View>;
}
