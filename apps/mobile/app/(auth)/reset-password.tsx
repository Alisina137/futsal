import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { ApiRequestError, authApi } from "../../src/lib/api";
import {
  clearPasswordResetSession,
  getPasswordResetSession,
} from "../../src/lib/passwordResetSession";
import { AuthHero } from "../../src/components/auth/AuthHero";
import { AppText } from "../../src/components/ui/AppText";
import { Button } from "../../src/components/ui/Button";
import { Card } from "../../src/components/ui/Card";
import { Screen } from "../../src/components/ui/Screen";
import { TextField } from "../../src/components/ui/TextField";
import { useAuth } from "../../src/providers/AuthProvider";
import { useLocale } from "../../src/providers/LocaleProvider";

type Field="username"|"password"|"confirmPassword";
type FieldErrors=Partial<Record<Field,string>>;

export default function ResetPasswordScreen(){
  const {t,isRTL,language}=useLocale();
  const {signOut}=useAuth();
  const resetSession=getPasswordResetSession();

  const usernameRef=useRef<TextInput>(null);
  const passwordRef=useRef<TextInput>(null);
  const confirmRef=useRef<TextInput>(null);

  const [username,setUsername]=useState(resetSession?.username??"");
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [fieldErrors,setFieldErrors]=useState<FieldErrors>({});
  const [formError,setFormError]=useState<string|null>(null);
  const [dialogVisible,setDialogVisible]=useState(false);
  const [showDialogPassword,setShowDialogPassword]=useState(false);
  const [busy,setBusy]=useState(false);

  function cooldownMessage(error:ApiRequestError){
    const availableAt=(error.details as {availableAt?:unknown}|undefined)?.availableAt;
    if(typeof availableAt!=="string") return t("auth.genericError");
    const date=new Date(availableAt);
    if(Number.isNaN(date.getTime())) return t("auth.genericError");
    const dateTime=new Intl.DateTimeFormat(language,{
      dateStyle:"medium",
      timeStyle:"short",
      timeZone:"Asia/Kabul",
    }).format(date);
    return t("auth.resetCooldown",{dateTime});
  }

  useEffect(()=>{
    if(!resetSession) router.replace("/forgot-password");
  },[resetSession]);

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

  if(!resetSession) return null;

  function clearFieldError(field:Field){
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

    if(!cleanUsername){
      next.username=t("auth.usernameRequired");
    }else if(!/^[A-Za-z0-9_]{3,12}$/.test(cleanUsername)){
      next.username=t("auth.usernameInvalid");
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

    setFieldErrors(next);
    const first=(["username","password","confirmPassword"] as const).find((field)=>Boolean(next[field]));
    if(first){
      requestAnimationFrame(()=>{
        if(first==="username") usernameRef.current?.focus();
        else if(first==="password") passwordRef.current?.focus();
        else confirmRef.current?.focus();
      });
      return false;
    }
    return true;
  }

  function openConfirmation(){
    setFormError(null);
    if(!validate()) return;
    setShowDialogPassword(false);
    setDialogVisible(true);
  }

  async function confirmReset(){
    const activeResetSession=getPasswordResetSession();
    if(!activeResetSession){
      setDialogVisible(false);
      setFormError(t("auth.resetExpired"));
      router.replace("/forgot-password");
      return;
    }

    setBusy(true);
    setFormError(null);
    try{
      await authApi.completePasswordReset({
        requestId:activeResetSession.requestId,
        resetToken:activeResetSession.resetToken,
        username:username.trim(),
        password,
        confirmPassword,
      });
      setDialogVisible(false);
      clearPasswordResetSession();
      await signOut();
      router.replace({pathname:"/login",params:{reset:"success"}});
    }catch(cause){
      setDialogVisible(false);
      if(cause instanceof ApiRequestError&&cause.code==="USERNAME_ALREADY_EXISTS"){
        setFieldErrors({username:t("auth.usernameTaken")});
        requestAnimationFrame(()=>usernameRef.current?.focus());
      }else if(cause instanceof ApiRequestError&&cause.code==="PASSWORD_RESET_COOLDOWN"){
        clearPasswordResetSession();
        setFormError(cooldownMessage(cause));
      }else if(cause instanceof ApiRequestError&&(
        cause.code==="INVALID_RESET_TOKEN"||
        cause.code==="VALIDATION_ERROR"
      )){
        setFormError(cause.code==="INVALID_RESET_TOKEN"?t("auth.resetExpired"):t("auth.genericError"));
      }else{
        setFormError(t("auth.genericError"));
      }
    }finally{
      setBusy(false);
    }
  }

  return <>
    <Screen style={styles.screen}>
      <AuthHero/>

      <Card style={styles.formCard}>
        <View style={[styles.header,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.icon}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#FFFFFF"/>
          </View>
          <View style={{flex:1,gap:spacing.xs}}>
            <AppText variant="title" weight="bold">{t("auth.resetTitle")}</AppText>
            <AppText muted>{t("auth.resetSubtitle")}</AppText>
          </View>
        </View>

        <View style={styles.verifiedPhone}>
          <Ionicons name="checkmark-circle" size={21} color={colors.success}/>
          <AppText forceLtr weight="semibold" style={{flex:1}}>{resetSession.phone}</AppText>
        </View>

        <TextField
          ref={usernameRef}
          label={t("auth.username")}
          placeholder={t("auth.placeholderUsername")}
          hint={t("auth.resetUsernameHint")}
          error={fieldErrors.username}
          value={username}
          onChangeText={(value)=>{setUsername(value);clearFieldError("username");}}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          maxLength={12}
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
          onSubmitEditing={()=>confirmRef.current?.focus()}
          secureTextEntry
        />

        <TextField
          ref={confirmRef}
          label={t("auth.confirmPassword")}
          placeholder={t("auth.placeholderConfirmPassword")}
          error={fieldErrors.confirmPassword}
          value={confirmPassword}
          onChangeText={(value)=>{setConfirmPassword(value);clearFieldError("confirmPassword");}}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          returnKeyType="done"
          onSubmitEditing={openConfirmation}
          secureTextEntry
        />

        <View style={styles.rules}>
          <AppText weight="semibold">{t("auth.passwordGuideTitle")}</AppText>
          {rules.map((rule)=><View key={rule.key} style={[styles.ruleRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
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
          label={t("auth.confirmReset")}
          onPress={openConfirmation}
          icon={<Ionicons name="lock-open-outline" size={20} color="#FFFFFF"/>}
        />
      </Card>
    </Screen>

    <Modal
      visible={dialogVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={()=>setDialogVisible(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <View style={styles.dialogIcon}>
            <Ionicons name="key-outline" size={28} color="#FFFFFF"/>
          </View>
          <AppText variant="title" weight="bold" style={{textAlign:"center"}}>{t("auth.confirmResetTitle")}</AppText>
          <AppText muted style={{textAlign:"center"}}>{t("auth.confirmResetBody")}</AppText>

          <View style={styles.summary}>
            <SummaryRow label={t("auth.confirmResetUsername")} value={username.trim()} isRTL={isRTL}/>
            <View style={styles.divider}/>
            <SummaryRow label={t("auth.confirmResetPhone")} value={resetSession.phone} isRTL={isRTL} forceLtr/>
            <View style={styles.divider}/>
            <View style={[styles.summaryRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <View style={{flex:1,gap:2}}>
                <AppText variant="caption" muted>{t("auth.confirmResetPassword")}</AppText>
                <AppText forceLtr weight="semibold">
                  {showDialogPassword?password:"•".repeat(Math.min(password.length,12))}
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showDialogPassword?t("common.hidePassword"):t("common.showPassword")}
                onPress={()=>setShowDialogPassword((current)=>!current)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showDialogPassword?"eye-off-outline":"eye-outline"}
                  size={22}
                  color={colors.primary}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.dialogActions}>
            <Button
              label={t("auth.confirmReset")}
              onPress={()=>void confirmReset()}
              loading={busy}
              icon={<Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF"/>}
            />
            <Button
              label={t("auth.cancelReset")}
              onPress={()=>setDialogVisible(false)}
              disabled={busy}
              variant="secondary"
            />
          </View>
        </View>
      </View>
    </Modal>
  </>;
}

function SummaryRow({
  label,
  value,
  isRTL,
  forceLtr=false,
}:{
  label:string;
  value:string;
  isRTL:boolean;
  forceLtr?:boolean;
}){
  return <View style={[styles.summaryRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
    <View style={{flex:1,gap:2}}>
      <AppText variant="caption" muted>{label}</AppText>
      <AppText forceLtr={forceLtr} weight="semibold">{value}</AppText>
    </View>
  </View>;
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
  header:{alignItems:"center",gap:spacing.md},
  icon:{width:48,height:48,borderRadius:16,alignItems:"center",justifyContent:"center",backgroundColor:colors.primary},
  verifiedPhone:{flexDirection:"row",alignItems:"center",gap:spacing.sm,padding:spacing.md,borderRadius:radius.md,backgroundColor:"#F0FBF4",borderWidth:1,borderColor:"#B7E2C4"},
  rules:{gap:spacing.sm,padding:spacing.md,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
  ruleRow:{alignItems:"center",gap:spacing.sm},
  errorBox:{flexDirection:"row",alignItems:"center",gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:"#FFF4F2",borderWidth:1,borderColor:"#F5C5C1"},
  modalBackdrop:{flex:1,backgroundColor:"rgba(7,26,43,0.72)",justifyContent:"center",padding:spacing.lg},
  dialog:{
    width:"100%",
    maxWidth:480,
    alignSelf:"center",
    padding:spacing.xl,
    borderRadius:radius.lg+6,
    backgroundColor:colors.surface,
    gap:spacing.md,
    shadowColor:"#000000",
    shadowOpacity:0.22,
    shadowRadius:24,
    shadowOffset:{width:0,height:12},
    elevation:12,
  },
  dialogIcon:{width:58,height:58,borderRadius:20,alignSelf:"center",alignItems:"center",justifyContent:"center",backgroundColor:colors.primary},
  summary:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,overflow:"hidden",backgroundColor:colors.surfaceMuted},
  summaryRow:{alignItems:"center",padding:spacing.md},
  divider:{height:1,backgroundColor:colors.border},
  eyeButton:{width:44,height:44,alignItems:"center",justifyContent:"center"},
  dialogActions:{gap:spacing.sm},
});
