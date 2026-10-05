import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { router } from "expo-router";
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

type LoginField="identifier"|"password";
type FieldErrors=Partial<Record<LoginField,string>>;

export default function LoginScreen(){
  const {t,isRTL}=useLocale();
  const {signIn}=useAuth();
  const identifierRef=useRef<TextInput>(null);
  const passwordRef=useRef<TextInput>(null);

  const [identifier,setIdentifier]=useState("");
  const [password,setPassword]=useState("");
  const [fieldErrors,setFieldErrors]=useState<FieldErrors>({});
  const [formError,setFormError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);

  function focusField(field:LoginField){
    (field==="identifier"?identifierRef:passwordRef).current?.focus();
  }

  function applyFieldErrors(next:FieldErrors){
    setFieldErrors(next);
    const first=(["identifier","password"] as const).find((field)=>Boolean(next[field]));
    if(first) requestAnimationFrame(()=>focusField(first));
  }

  function clearFieldError(field:LoginField){
    setFieldErrors((current)=>{
      if(!current[field]) return current;
      const next={...current};
      delete next[field];
      return next;
    });
    setFormError(null);
  }

  function validate(){
    const next:FieldErrors={};
    const cleanIdentifier=identifier.trim();

    if(!cleanIdentifier){
      next.identifier=t("validation.required");
    }else if(cleanIdentifier.length<3){
      next.identifier=t("auth.identifierInvalid");
    }

    if(!password){
      next.password=t("auth.passwordRequired");
    }else if(password.length<8){
      next.password=t("auth.loginPasswordInvalid");
    }

    if(Object.keys(next).length){
      applyFieldErrors(next);
      return false;
    }

    setFieldErrors({});
    return true;
  }

  async function submit(){
    setFormError(null);
    if(!validate()) return;

    setBusy(true);
    try{
      await signIn({identifier:identifier.trim(),password});
      router.replace("/home");
    }catch(cause){
      if(cause instanceof ApiRequestError&&cause.code==="INVALID_CREDENTIALS"){
        applyFieldErrors({
          identifier:t("auth.checkIdentifier"),
          password:t("auth.checkPassword"),
        });
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

      <TextField
        ref={identifierRef}
        label={t("auth.identifier")}
        placeholder={t("auth.placeholderIdentifier")}
        error={fieldErrors.identifier}
        value={identifier}
        onChangeText={(value)=>{setIdentifier(value);clearFieldError("identifier");}}
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
        error={fieldErrors.password}
        value={password}
        onChangeText={(value)=>{setPassword(value);clearFieldError("password");}}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        returnKeyType="done"
        onSubmitEditing={()=>void submit()}
        secureTextEntry
      />

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
  errorBox:{flexDirection:"row",alignItems:"center",gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:"#FFF4F2",borderWidth:1,borderColor:"#F5C5C1"},
  securityRow:{flexDirection:"row",alignItems:"center",gap:spacing.sm,paddingTop:spacing.xs},
  switchRow:{justifyContent:"center",alignItems:"center",gap:spacing.sm,paddingBottom:spacing.sm},
});
