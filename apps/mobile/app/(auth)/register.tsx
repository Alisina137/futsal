import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ApiRequestError } from "../../src/lib/api";
import { AuthHero } from "../../src/components/auth/AuthHero";
import { AppText } from "../../src/components/ui/AppText";
import { Button } from "../../src/components/ui/Button";
import { Card } from "../../src/components/ui/Card";
import { Screen } from "../../src/components/ui/Screen";
import { TextField } from "../../src/components/ui/TextField";
import { useAuth } from "../../src/providers/AuthProvider";
import { useLocale } from "../../src/providers/LocaleProvider";

export default function RegisterScreen(){
  const {t,language,isRTL}=useLocale();
  const {register}=useAuth();

  const [username,setUsername]=useState("");
  const [phone,setPhone]=useState("");
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const passwordHasLength=password.length>=8;
  const passwordHasLetter=/\p{L}/u.test(password);
  const passwordHasNumber=/\p{N}/u.test(password);
  const passwordHasSpecial=/[^\p{L}\p{N}\s]/u.test(password);
  const passwordsMatch=password.length>0&&password===confirmPassword;
  const usernameValid=/^[A-Za-z0-9_]{3,30}$/.test(username.trim());

  const rules=useMemo(()=>[
    {key:"length",label:t("auth.passwordRuleLength"),met:passwordHasLength},
    {key:"lettersNumbers",label:t("auth.passwordRuleLettersNumbers"),met:passwordHasLetter&&passwordHasNumber},
    {key:"special",label:t("auth.passwordRuleSpecial"),met:passwordHasSpecial},
    {key:"match",label:t("auth.passwordRuleMatch"),met:passwordsMatch},
  ],[passwordHasLength,passwordHasLetter,passwordHasNumber,passwordHasSpecial,passwordsMatch,t]);

  async function submit(){
    if(!usernameValid){setError(t("auth.usernameHint"));return;}
    if(!phone.trim()){setError(t("validation.phone"));return;}
    if(!passwordHasLength||!passwordHasLetter||!passwordHasNumber||!passwordHasSpecial){setError(t("validation.password"));return;}
    if(!passwordsMatch){setError(t("auth.passwordMismatch"));return;}

    setBusy(true);
    setError(null);
    try{
      await register({
        username:username.trim(),
        phone:phone.trim(),
        password,
        confirmPassword,
        preferredLanguage:language,
      });
      router.replace("/home");
    }catch(cause){
      if(cause instanceof ApiRequestError&&cause.code==="IDENTITY_ALREADY_EXISTS"){
        setError(t("auth.duplicateIdentity"));
      }else if(cause instanceof ApiRequestError&&cause.code==="INVALID_PHONE"){
        setError(t("validation.phone"));
      }else{
        setError(t("auth.genericError"));
      }
    }finally{
      setBusy(false);
    }
  }

  return <Screen style={styles.screen}>
    <AuthHero/>

    <Card style={styles.formCard}>
      <View style={{gap:spacing.xs}}>
        <AppText variant="title" weight="bold">{t("auth.registerTitle")}</AppText>
        <AppText muted>{t("auth.registerSubtitle")}</AppText>
      </View>

      <View style={styles.identityNote}>
        <Ionicons name="person-circle-outline" size={22} color={colors.primary}/>
        <AppText variant="caption" style={{flex:1,color:colors.primary}}>{t("auth.baseAccountNote")}</AppText>
      </View>

      <TextField
        label={t("auth.username")}
        placeholder={t("auth.placeholderUsername")}
        hint={t("auth.usernameHint")}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        forceLtr
      />

      <TextField
        label={t("auth.phone")}
        placeholder={t("auth.placeholderPhone")}
        hint={t("auth.phoneHint")}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        forceLtr
      />

      <TextField
        label={t("auth.password")}
        placeholder={t("auth.placeholderNewPassword")}
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        secureTextEntry
      />

      <TextField
        label={t("auth.confirmPassword")}
        placeholder={t("auth.placeholderConfirmPassword")}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        secureTextEntry
      />

      <View style={styles.rules}>
        <AppText weight="semibold">{t("auth.passwordGuideTitle")}</AppText>
        {rules.map((rule)=><View
          key={rule.key}
          style={[styles.ruleRow,{flexDirection:isRTL?"row-reverse":"row"}]}
        >
          <Ionicons
            name={rule.met?"checkmark-circle":"ellipse-outline"}
            size={19}
            color={rule.met?colors.success:colors.textMuted}
          />
          <AppText variant="caption" style={{flex:1,color:rule.met?colors.success:colors.textMuted}}>
            {rule.label}
          </AppText>
        </View>)}
      </View>

      {error?<View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.errorBox}>
        <Ionicons name="alert-circle-outline" size={19} color={colors.danger}/>
        <AppText variant="caption" style={{flex:1,color:colors.danger}}>{error}</AppText>
      </View>:null}

      <Button
        label={t("auth.register")}
        onPress={()=>void submit()}
        loading={busy}
        icon={<Ionicons name="arrow-forward-circle-outline" size={20} color="#FFFFFF"/>}
      />
    </Card>

    <View style={[styles.switchRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <AppText muted>{t("auth.haveAccount")}</AppText>
      <Pressable accessibilityRole="button" onPress={()=>router.replace("/login")}>
        <AppText weight="bold" style={{color:colors.primary}}>{t("auth.login")}</AppText>
      </Pressable>
    </View>
  </Screen>;
}

const styles=StyleSheet.create({
  screen:{paddingTop:spacing.md,gap:spacing.lg},
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
  identityNote:{
    flexDirection:"row",
    alignItems:"center",
    gap:spacing.sm,
    padding:spacing.md,
    borderRadius:radius.md,
    backgroundColor:colors.primarySoft,
    borderWidth:1,
    borderColor:"#C7D7F7",
  },
  rules:{gap:spacing.sm,padding:spacing.md,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
  ruleRow:{alignItems:"center",gap:spacing.sm},
  errorBox:{flexDirection:"row",alignItems:"center",gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:"#FFF4F2",borderWidth:1,borderColor:"#F5C5C1"},
  switchRow:{justifyContent:"center",alignItems:"center",gap:spacing.sm,paddingBottom:spacing.sm},
});
