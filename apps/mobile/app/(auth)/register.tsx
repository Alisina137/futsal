import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { normalizeAfghanistanPhone } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { ApiRequestError } from "../../src/lib/api";
import { AuthHero } from "../../src/components/auth/AuthHero";
import { AppText } from "../../src/components/ui/AppText";
import { Button } from "../../src/components/ui/Button";
import { Card } from "../../src/components/ui/Card";
import { Screen } from "../../src/components/ui/Screen";
import { TextField } from "../../src/components/ui/TextField";
import { useAuth } from "../../src/providers/AuthProvider";
import { useLocale } from "../../src/providers/LocaleProvider";

type RegisterField = "username" | "phone" | "password" | "confirmPassword";
type FieldErrors = Partial<Record<RegisterField, string>>;

export default function RegisterScreen(){
  const {t,language,isRTL}=useLocale();
  const {register}=useAuth();

  const usernameRef=useRef<TextInput>(null);
  const phoneRef=useRef<TextInput>(null);
  const passwordRef=useRef<TextInput>(null);
  const confirmPasswordRef=useRef<TextInput>(null);

  const [username,setUsername]=useState("");
  const [phone,setPhone]=useState("");
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [fieldErrors,setFieldErrors]=useState<FieldErrors>({});
  const [formError,setFormError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);

  const passwordHasLength=password.length>=8;
  const passwordHasLetter=/\p{L}/u.test(password);
  const passwordHasNumber=/\p{N}/u.test(password);
  const passwordHasSpecial=/[^\p{L}\p{N}\s]/u.test(password);
  const passwordsMatch=password.length>0&&password===confirmPassword;

  const rules=useMemo(()=>[
    {key:"length",label:t("auth.passwordRuleLength"),met:passwordHasLength},
    {key:"letter",label:t("auth.passwordRuleLetter"),met:passwordHasLetter},
    {key:"number",label:t("auth.passwordRuleNumber"),met:passwordHasNumber},
    {key:"special",label:t("auth.passwordRuleSpecial"),met:passwordHasSpecial},
    {key:"match",label:t("auth.passwordRuleMatch"),met:passwordsMatch},
  ],[passwordHasLength,passwordHasLetter,passwordHasNumber,passwordHasSpecial,passwordsMatch,t]);

  function focusField(field:RegisterField){
    const refs={
      username:usernameRef,
      phone:phoneRef,
      password:passwordRef,
      confirmPassword:confirmPasswordRef,
    };
    refs[field].current?.focus();
  }

  function applyFieldErrors(next:FieldErrors){
    setFieldErrors(next);
    const first=(["username","phone","password","confirmPassword"] as const).find((field)=>Boolean(next[field]));
    if(first) requestAnimationFrame(()=>focusField(first));
  }

  function clearFieldError(field:RegisterField){
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
    const cleanUsername=username.trim();
    const cleanPhone=phone.trim();

    if(!cleanUsername){
      next.username=t("auth.usernameRequired");
    }else if(!/^[A-Za-z0-9_]{3,12}$/.test(cleanUsername)){
      next.username=t("auth.usernameInvalid");
    }

    if(!cleanPhone){
      next.phone=t("auth.phoneRequired");
    }else{
      try{
        normalizeAfghanistanPhone(cleanPhone);
      }catch{
        next.phone=t("validation.phone");
      }
    }

    if(!password){
      next.password=t("auth.passwordRequired");
    }else{
      const missing:string[]=[];
      if(!passwordHasLength) missing.push(t("auth.passwordRuleLength"));
      if(!passwordHasLetter) missing.push(t("auth.passwordRuleLetter"));
      if(!passwordHasNumber) missing.push(t("auth.passwordRuleNumber"));
      if(!passwordHasSpecial) missing.push(t("auth.passwordRuleSpecial"));
      if(missing.length) next.password=missing.join(" · ");
    }

    if(!confirmPassword){
      next.confirmPassword=t("auth.confirmPasswordRequired");
    }else if(password!==confirmPassword){
      next.confirmPassword=t("auth.passwordMismatch");
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
      await register({
        username:username.trim(),
        phone:phone.trim(),
        password,
        confirmPassword,
        preferredLanguage:language,
      });
      router.replace("/home");
    }catch(cause){
      if(cause instanceof ApiRequestError&&cause.code==="USERNAME_ALREADY_EXISTS"){
        applyFieldErrors({username:t("auth.usernameTaken")});
      }else if(cause instanceof ApiRequestError&&cause.code==="PHONE_ALREADY_EXISTS"){
        applyFieldErrors({phone:t("auth.phoneTaken")});
      }else if(cause instanceof ApiRequestError&&cause.code==="IDENTITY_ALREADY_EXISTS"){
        applyFieldErrors({
          username:t("auth.duplicateIdentity"),
          phone:t("auth.duplicateIdentity"),
        });
      }else if(cause instanceof ApiRequestError&&cause.code==="INVALID_PHONE"){
        applyFieldErrors({phone:t("validation.phone")});
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
      <View style={[styles.signupHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.signupIcon}>
          <Ionicons name="person-add-outline" size={24} color="#FFFFFF"/>
        </View>
        <View style={{flex:1}}>
          <AppText variant="title" weight="bold">{t("auth.registerTitle")}</AppText>
          <View style={styles.titleAccent}/>
        </View>
      </View>

      <TextField
        ref={usernameRef}
        label={t("auth.username")}
        placeholder={t("auth.placeholderUsername")}
        hint={t("auth.usernameHint")}
        error={fieldErrors.username}
        value={username}
        onChangeText={(value)=>{setUsername(value);clearFieldError("username");}}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        returnKeyType="next"
        onSubmitEditing={()=>phoneRef.current?.focus()}
        forceLtr
      />

      <TextField
        ref={phoneRef}
        label={t("auth.phone")}
        placeholder={t("auth.placeholderPhone")}
        hint={t("auth.phoneHint")}
        error={fieldErrors.phone}
        value={phone}
        onChangeText={(value)=>{setPhone(value);clearFieldError("phone");}}
        keyboardType="phone-pad"
        autoComplete="tel"
        returnKeyType="next"
        onSubmitEditing={()=>passwordRef.current?.focus()}
        forceLtr
      />

      <TextField
        ref={passwordRef}
        label={t("auth.password")}
        placeholder={t("auth.placeholderNewPassword")}
        error={fieldErrors.password}
        value={password}
        onChangeText={(value)=>{setPassword(value);clearFieldError("password");}}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        returnKeyType="next"
        onSubmitEditing={()=>confirmPasswordRef.current?.focus()}
        secureTextEntry
      />

      <TextField
        ref={confirmPasswordRef}
        label={t("auth.confirmPassword")}
        placeholder={t("auth.placeholderConfirmPassword")}
        error={fieldErrors.confirmPassword}
        value={confirmPassword}
        onChangeText={(value)=>{setConfirmPassword(value);clearFieldError("confirmPassword");}}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        returnKeyType="done"
        onSubmitEditing={()=>void submit()}
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

      {formError?<View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.errorBox}>
        <Ionicons name="alert-circle-outline" size={19} color={colors.danger}/>
        <AppText variant="caption" style={{flex:1,color:colors.danger}}>{formError}</AppText>
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
  signupHeader:{alignItems:"center",gap:spacing.md,paddingBottom:spacing.xs},
  signupIcon:{width:48,height:48,borderRadius:16,alignItems:"center",justifyContent:"center",backgroundColor:colors.primary},
  titleAccent:{marginTop:7,width:52,height:3,borderRadius:2,backgroundColor:"#22C55E"},
  rules:{gap:spacing.sm,padding:spacing.md,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
  ruleRow:{alignItems:"center",gap:spacing.sm},
  errorBox:{flexDirection:"row",alignItems:"center",gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:"#FFF4F2",borderWidth:1,borderColor:"#F5C5C1"},
  switchRow:{justifyContent:"center",alignItems:"center",gap:spacing.sm,paddingBottom:spacing.sm},
});
