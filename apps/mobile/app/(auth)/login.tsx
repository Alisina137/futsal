import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
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
  const params=useLocalSearchParams<{reset?:string;next?:string}>();
  const identifierRef=useRef<TextInput>(null);
  const passwordRef=useRef<TextInput>(null);
  const [identifier,setIdentifier]=useState("");
  const [password,setPassword]=useState("");
  const [invalidIdentifier,setInvalidIdentifier]=useState(false);
  const [invalidPassword,setInvalidPassword]=useState(false);
  const [formError,setFormError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);

  function clearErrors(){
    setInvalidIdentifier(false);
    setInvalidPassword(false);
    setFormError(null);
  }

  async function submit(){
    const missingIdentifier=!identifier.trim();
    const missingPassword=!password;
    if(missingIdentifier||missingPassword){
      setInvalidIdentifier(missingIdentifier);
      setInvalidPassword(missingPassword);
      setFormError(t("auth.invalidCredentials"));
      requestAnimationFrame(()=>{
        if(missingIdentifier) identifierRef.current?.focus();
        else passwordRef.current?.focus();
      });
      return;
    }

    setBusy(true);
    clearErrors();
    try{
      await signIn({identifier:identifier.trim(),password});
      router.replace(params.next==="/admin"?"/admin":"/home");
    }catch(cause){
      if(cause instanceof ApiRequestError&&(
        cause.code==="INVALID_CREDENTIALS"||
        cause.code==="VALIDATION_ERROR"
      )){
        setInvalidIdentifier(true);
        setInvalidPassword(true);
        setFormError(t("auth.invalidCredentials"));
        requestAnimationFrame(()=>identifierRef.current?.focus());
      }else{
        setFormError(t("auth.genericError"));
      }
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

      {params.reset==="success"?<View accessibilityLiveRegion="polite" style={styles.successBox}>
        <Ionicons name="checkmark-circle-outline" size={19} color={colors.success}/>
        <AppText variant="caption" style={{flex:1,color:colors.success}}>{t("auth.resetSuccess")}</AppText>
      </View>:null}

      <TextField
        ref={identifierRef}
        label={t("auth.identifier")}
        placeholder={t("auth.placeholderIdentifier")}
        invalid={invalidIdentifier}
        value={identifier}
        onChangeText={(value)=>{setIdentifier(value);clearErrors();}}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        returnKeyType="next"
        onSubmitEditing={()=>passwordRef.current?.focus()}
        forceLtr
      />

      <TextField
        ref={passwordRef}
        label={t("auth.password")}
        placeholder={t("auth.placeholderPassword")}
        invalid={invalidPassword}
        value={password}
        onChangeText={(value)=>{setPassword(value);clearErrors();}}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        returnKeyType="done"
        onSubmitEditing={()=>void submit()}
        secureTextEntry
      />

      <Pressable
        accessibilityRole="button"
        onPress={()=>router.push("/forgot-password")}
        style={({pressed})=>[styles.forgotLink,pressed&&styles.pressed]}
      >
        <AppText weight="semibold" style={{color:colors.primary}}>{t("auth.forgotPassword")}</AppText>
      </Pressable>

      {formError?<View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.errorBox}>
        <Ionicons name="alert-circle-outline" size={19} color={colors.danger}/>
        <AppText variant="caption" style={{flex:1,color:colors.danger}}>{formError}</AppText>
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
  forgotLink:{alignSelf:"flex-end",paddingVertical:2},
  pressed:{opacity:0.7},
  successBox:{flexDirection:"row",alignItems:"center",gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:"#F0FBF4",borderWidth:1,borderColor:"#B7E2C4"},
  errorBox:{flexDirection:"row",alignItems:"center",gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:"#FFF4F2",borderWidth:1,borderColor:"#F5C5C1"},
  securityRow:{flexDirection:"row",alignItems:"center",gap:spacing.sm,paddingTop:spacing.xs},
  switchRow:{justifyContent:"center",alignItems:"center",gap:spacing.sm,paddingBottom:spacing.sm},
});
