import { colors, spacing } from "@leaguekick/design-tokens";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { ApiRequestError } from "../../src/lib/api";
import { Button } from "../../src/components/ui/Button";
import { AppText } from "../../src/components/ui/AppText";
import { Screen } from "../../src/components/ui/Screen";
import { TextField } from "../../src/components/ui/TextField";
import { LanguagePicker } from "../../src/components/LanguagePicker";
import { useAuth } from "../../src/providers/AuthProvider";
import { useLocale } from "../../src/providers/LocaleProvider";

export default function LoginScreen(){
  const {t,isRTL}=useLocale(); const {signIn}=useAuth(); const [identifier,setIdentifier]=useState(""); const [password,setPassword]=useState(""); const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null);
  async function submit(){ if(!identifier.trim()||!password){setError(t("validation.required"));return;} setBusy(true);setError(null);try{await signIn({identifier:identifier.trim(),password});router.replace("/home");}catch(e){setError(e instanceof ApiRequestError&&e.code==="INVALID_CREDENTIALS"?t("auth.invalidCredentials"):t("auth.genericError"));}finally{setBusy(false);} }
  return <Screen style={{justifyContent:"center"}}><View style={{gap:spacing.sm}}><AppText variant="display" weight="bold" style={{color:colors.primary}}>{t("common.appName")}</AppText><AppText variant="title" weight="semibold">{t("auth.welcomeBack")}</AppText><AppText muted>{t("auth.loginSubtitle")}</AppText></View><LanguagePicker/><TextField label={t("auth.identifier")} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" forceLtr/><TextField label={t("auth.password")} value={password} onChangeText={setPassword} secureTextEntry/><>{error?<AppText style={{color:colors.danger}}>{error}</AppText>:null}</><Button label={t("auth.login")} onPress={()=>void submit()} loading={busy}/><View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,justifyContent:"center",alignItems:"center"}}><AppText muted>{t("auth.noAccount")}</AppText><Pressable onPress={()=>router.push("/register")}><AppText weight="semibold" style={{color:colors.primary}}>{t("auth.createAccount")}</AppText></Pressable></View></Screen>;
}
