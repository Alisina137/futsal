import { colors, spacing } from "@leaguekick/design-tokens";
import { View } from "react-native";
import { OwnerDashboard } from "../../../src/components/owner/OwnerDashboard";
import { AppText } from "../../../src/components/ui/AppText";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";
import { useNetwork } from "../../../src/providers/NetworkProvider";

export default function HomeScreen(){
  const {session}=useAuth();
  const user=session?.user;
  if(user?.roles.includes("VENUE_OWNER")) return <OwnerDashboard/>;

  const {t,language,isRTL}=useLocale();
  const {isOnline}=useNetwork();
  const role=user?.roles[0]??"PLAYER";
  return <Screen>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("home.greeting",{name:user?.displayName??""})}</AppText>
      <AppText muted>{t("home.foundationBody")}</AppText>
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
      <AppText weight="semibold">{t("home.nextTitle")}</AppText>
      <AppText>{t("home.nextBody")}</AppText>
    </Card>
  </Screen>;
}
function InfoRow({label,value,rtl,ltrValue=false}:{label:string;value:string;rtl:boolean;ltrValue?:boolean}){return <View style={{flexDirection:rtl?"row-reverse":"row",justifyContent:"space-between",gap:spacing.md}}><AppText muted>{label}</AppText><AppText weight="semibold" forceLtr={ltrValue}>{value}</AppText></View>}
