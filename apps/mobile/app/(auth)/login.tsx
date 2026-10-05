import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ApiRequestError } from "../../src/lib/api";
import { AuthHero } from "../../src/components/auth/AuthHero";
import { Button } from "../../src/components/ui/Button";
import { AppText } from "../../src/components/ui/AppText";
import { Card } from "../../src/components/ui/Card";
import { Screen } from "../../src/components/ui/Screen";
import { TextField } from "../../src/components/ui/TextField";
import { useAuth } from "../../src/providers/AuthProvider";
import { useLocale } from "../../src/providers/LocaleProvider";

export default function LoginScreen(){
  const {t,isRTL}=useLocale();
  const {signIn}=useAuth();
  const [identifier,setIdentifier]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  async function submit(){
    if(!identifier.trim()||!password){setError(t("validation.required"));return;}
    setBusy(true);
    setError(null);
    try{
      await signIn({identifier:identifier.trim(),password});
      router.replace("/home");
    }catch(cause){
      setError(cause instanceof ApiRequestError&&cause.code==="INVALID_CREDENTIALS"
        ?t("auth.invalidCredentials")
        :t("auth.genericError"));
    }finally{
      setBusy(false);
    }
  }

  return <Screen style={styles.screen}>
    <AuthHero/>

    <Card style={styles.formCard}>
      <View style={{gap:spacing.xs}}>
        <AppText variant="title" weight="bold">{t("auth.welcomeBack")}</AppText>
        <AppText muted>{t("auth.loginSubtitle")}</AppText>
      </View>

      <TextField
        label={t("auth.identifier")}
        placeholder={t("auth.placeholderIdentifier")}
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        forceLtr
      />

      <TextField
        label={t("auth.password")}
        placeholder={t("auth.placeholderPassword")}
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        secureTextEntry
      />

      {error?<View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.errorBox}>
        <Ionicons name="alert-circle-outline" size={19} color={colors.danger}/>
        <AppText variant="caption" style={{flex:1,color:colors.danger}}>{error}</AppText>
      </View>:null}

      <Button
        label={t("auth.login")}
        onPress={()=>void submit()}
        loading={busy}
        icon={<Ionicons name="log-in-outline" size={20} color="#FFFFFF"/>}
      />

      <View style={styles.securityRow}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.success}/>
        <AppText variant="caption" muted style={{flex:1}}>{t("settings.sessionProtected")}</AppText>
      </View>
    </Card>

    <View style={[styles.switchRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <AppText muted>{t("auth.noAccount")}</AppText>
      <Pressable accessibilityRole="button" onPress={()=>router.replace("/register")}>
        <AppText weight="bold" style={{color:colors.primary}}>{t("auth.createAccount")}</AppText>
      </Pressable>
    </View>
  </Screen>;
}

const styles=StyleSheet.create({
  screen:{paddingTop:spacing.md,gap:spacing.lg,justifyContent:"center"},
  formCard:{
    padding:spacing.lg,
    gap:spacing.md,
    borderRadius:radius.lg,
    borderColor:"#D6E2F0",
    shadowColor:"#0F172A",
    shadowOpacity:0.08,
    shadowRadius:18,
    shadowOffset:{width:0,height:8},
    elevation:4,
  },
  errorBox:{flexDirection:"row",alignItems:"center",gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:"#FFF4F2",borderWidth:1,borderColor:"#F5C5C1"},
  securityRow:{flexDirection:"row",alignItems:"center",gap:spacing.sm,paddingTop:spacing.xs},
  switchRow:{justifyContent:"center",alignItems:"center",gap:spacing.sm,paddingBottom:spacing.sm},
});
