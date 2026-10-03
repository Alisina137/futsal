import { colors, spacing } from "@leaguekick/design-tokens";
import { View } from "react-native";
import { LanguagePicker } from "../../../src/components/LanguagePicker";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function SettingsScreen(){const {session,signOut}=useAuth();const {t,isRTL}=useLocale();const user=session?.user;return <Screen><AppText variant="title" weight="bold">{t("settings.title")}</AppText><Card><AppText weight="semibold">{t("settings.language")}</AppText><LanguagePicker/></Card><Card><AppText weight="semibold">{t("settings.account")}</AppText><View style={{gap:spacing.sm}}><Row label={t("auth.displayName")} value={user?.displayName??""} rtl={isRTL}/><Row label={t("auth.phone")} value={user?.phone??""} rtl={isRTL} ltr/><Row label={t("home.accountRole")} value={user?.roles.map((r)=>t(`role.${r}` as never)).join(", ")??""} rtl={isRTL}/></View></Card><Card><AppText weight="semibold">{t("settings.security")}</AppText><AppText muted>{t("settings.sessionProtected")}</AppText></Card><Button variant="secondary" label={t("common.signOut")} onPress={()=>void signOut()} style={{borderColor:colors.danger}}/></Screen>}
function Row({label,value,rtl,ltr=false}:{label:string;value:string;rtl:boolean;ltr?:boolean}){return <View style={{flexDirection:rtl?"row-reverse":"row",justifyContent:"space-between",gap:spacing.md}}><AppText muted>{label}</AppText><AppText weight="medium" forceLtr={ltr}>{value}</AppText></View>}
