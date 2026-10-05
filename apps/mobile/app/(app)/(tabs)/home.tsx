import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
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
  if(user?.roles.includes("VENUE_OWNER")) return <OwnerDashboard/>;
  if(user?.roles.includes("PLAYER")) return <PlayerHome user={user}/>;
  return <BaseUserHome user={user}/>;
}

function BaseUserHome({user}:{user:UserDto|undefined}){
  const {t,isRTL}=useLocale();
  const {isOnline}=useNetwork();
  const active=user?.roles??[];
  const roleLabel=active.length
    ?active.map((role)=>t(("role."+role) as never)).join(", ")
    :t("roles.basicUser");

  return <Screen showHeader>
    <View style={styles.baseHero}>
      <View style={[styles.heroBadge,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="football" size={18} color="#86EFAC"/>
        <AppText variant="caption" weight="bold" style={{color:"#DDFBE6"}}>{t("auth.heroEyebrow")}</AppText>
      </View>
      <AppText variant="title" weight="bold" style={{color:"#FFFFFF"}}>{t("home.baseTitle")}</AppText>
      <AppText style={{color:"#C7D5E2"}}>{t("home.baseBody")}</AppText>
      <Button
        label={t("home.chooseRole")}
        onPress={()=>router.push("/roles")}
        icon={<Ionicons name="add-circle-outline" size={20} color="#FFFFFF"/>}
      />
    </View>

    <Card>
      <InfoRow label={t("settings.username")} value={user?.username?"@"+user.username:""} rtl={isRTL} ltrValue/>
      <InfoRow label={t("home.accountRole")} value={roleLabel} rtl={isRTL}/>
      <InfoRow label={t("home.connection")} value={isOnline?t("common.online"):t("network.offlineTitle")} rtl={isRTL}/>
    </Card>

    <Card style={{gap:spacing.md}}>
      <AppText variant="bodyLarge" weight="bold">{t("roles.basicUserBody")}</AppText>
      <Button label={t("booking.findVenue")} onPress={()=>router.push("/venues")}/>
      <Button label={t("feed.title")} onPress={()=>router.push("/feed")} variant="secondary"/>
      <Button label={t("competition.title")} onPress={()=>router.push("/competitions")} variant="secondary"/>
    </Card>
  </Screen>;
}

function PlayerHome({user}:{user:UserDto|undefined}){
  const {t,language,isRTL}=useLocale();
  const {isOnline}=useNetwork();
  const roles=user?.roles.length
    ?user.roles.map((role)=>t(("role."+role) as never)).join(", ")
    :t("roles.basicUser");

  return <Screen showHeader>
    <View style={styles.playerHero}>
      <AppText variant="title" weight="bold" style={{color:"#FFFFFF"}}>{t("home.greeting",{name:user?.displayName??""})}</AppText>
      <AppText style={{color:"#DCE8FF"}}>{t("home.foundationBody")}</AppText>
    </View>
    <Card>
      <AppText weight="semibold" style={{color:colors.primary}}>{t("home.foundationTitle")}</AppText>
      <View style={{gap:spacing.sm}}>
        <InfoRow label={t("home.accountRole")} value={roles} rtl={isRTL}/>
        <InfoRow label={t("home.connection")} value={isOnline?t("common.online"):t("network.offlineTitle")} rtl={isRTL}/>
        <InfoRow label={t("home.language")} value={language} rtl={isRTL} ltrValue/>
      </View>
    </Card>
    <Card style={{backgroundColor:colors.primarySoft}}>
      <AppText weight="semibold">{t("booking.quickStart")}</AppText>
      <AppText>{t("booking.quickStartBody")}</AppText>
      <Button label={t("booking.findVenue")} onPress={()=>router.push("/venues")} />
      <Button label={t("booking.myBookings")} onPress={()=>router.push("/bookings")} variant="secondary" />
      <Button label={t("competition.title")} onPress={()=>router.push("/competitions")} variant="secondary" />
      <Button label={t("settings.roles")} onPress={()=>router.push("/roles")} variant="ghost" />
    </Card>
  </Screen>;
}

function InfoRow({label,value,rtl,ltrValue=false}:{label:string;value:string;rtl:boolean;ltrValue?:boolean}){
  return <View style={{flexDirection:rtl?"row-reverse":"row",justifyContent:"space-between",gap:spacing.md}}>
    <AppText muted>{label}</AppText>
    <AppText weight="semibold" forceLtr={ltrValue} style={{flexShrink:1}}>{value}</AppText>
  </View>;
}

const styles={
  baseHero:{
    backgroundColor:"#071A2B",
    borderRadius:radius.lg,
    padding:spacing.lg,
    gap:spacing.md,
    shadowColor:"#071A2B",
    shadowOpacity:0.18,
    shadowRadius:14,
    shadowOffset:{width:0,height:6},
    elevation:4,
  },
  heroBadge:{alignSelf:"flex-start",alignItems:"center",gap:spacing.xs,paddingHorizontal:spacing.sm,paddingVertical:6,borderRadius:radius.pill,backgroundColor:"rgba(255,255,255,0.08)"},
  playerHero:{
    backgroundColor:colors.primary,
    borderRadius:20,
    padding:spacing.lg,
    gap:spacing.sm,
    shadowColor:colors.primary,
    shadowOpacity:0.18,
    shadowRadius:14,
    shadowOffset:{width:0,height:6},
    elevation:4,
  },
} as const;
