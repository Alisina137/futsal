import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { normalizeAfghanistanPhone } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { ApiRequestError, authApi } from "../../src/lib/api";
import { setPasswordResetSession } from "../../src/lib/passwordResetSession";
import { AuthHero } from "../../src/components/auth/AuthHero";
import { AppText } from "../../src/components/ui/AppText";
import { Button } from "../../src/components/ui/Button";
import { Card } from "../../src/components/ui/Card";
import { Screen } from "../../src/components/ui/Screen";
import { TextField } from "../../src/components/ui/TextField";
import { useLocale } from "../../src/providers/LocaleProvider";

export default function ForgotPasswordScreen(){
  const {t,isRTL}=useLocale();
  const phoneRef=useRef<TextInput>(null);
  const codeRef=useRef<TextInput>(null);

  const [phone,setPhone]=useState("");
  const [phoneError,setPhoneError]=useState<string|null>(null);
  const [requestId,setRequestId]=useState<string|null>(null);
  const [debugCode,setDebugCode]=useState<string|null>(null);
  const [code,setCode]=useState("");
  const [codeError,setCodeError]=useState<string|null>(null);
  const [formError,setFormError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);

  async function requestCode(){
    const clean=phone.trim();
    if(!clean){
      setPhoneError(t("auth.phoneRequired"));
      requestAnimationFrame(()=>phoneRef.current?.focus());
      return;
    }
    try{
      normalizeAfghanistanPhone(clean);
    }catch{
      setPhoneError(t("validation.phone"));
      requestAnimationFrame(()=>phoneRef.current?.focus());
      return;
    }

    setBusy(true);
    setPhoneError(null);
    setFormError(null);
    try{
      const result=await authApi.requestPasswordReset({phone:clean});
      setRequestId(result.requestId);
      setDebugCode(result.debugCode??null);
      setCode("");
      requestAnimationFrame(()=>codeRef.current?.focus());
    }catch(cause){
      if(cause instanceof ApiRequestError&&cause.code==="INVALID_PHONE"){
        setPhoneError(t("validation.phone"));
      }else if(cause instanceof ApiRequestError&&(
        cause.code==="PASSWORD_RESET_DISABLED"||
        cause.code==="PASSWORD_RESET_DELIVERY_UNAVAILABLE"||
        cause.code==="PASSWORD_RESET_DELIVERY_FAILED"
      )){
        setFormError(t("auth.resetDeliveryUnavailable"));
      }else{
        setFormError(t("auth.genericError"));
      }
    }finally{
      setBusy(false);
    }
  }

  async function verifyCode(){
    if(!requestId) return;
    if(!/^\d{6}$/.test(code.trim())){
      setCodeError(t("auth.invalidResetCode"));
      requestAnimationFrame(()=>codeRef.current?.focus());
      return;
    }

    setBusy(true);
    setCodeError(null);
    setFormError(null);
    try{
      const verified=await authApi.verifyPasswordReset({requestId,code:code.trim()});
      setPasswordResetSession(verified);
      router.replace("/reset-password");
    }catch(cause){
      if(cause instanceof ApiRequestError&&cause.code==="INVALID_RESET_CODE"){
        setCodeError(t("auth.invalidResetCode"));
        requestAnimationFrame(()=>codeRef.current?.focus());
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
      <View style={[styles.header,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.icon}>
          <Ionicons name="key-outline" size={24} color="#FFFFFF"/>
        </View>
        <View style={{flex:1,gap:spacing.xs}}>
          <AppText variant="title" weight="bold">{t("auth.forgotTitle")}</AppText>
          <AppText muted>{t("auth.forgotSubtitle")}</AppText>
        </View>
      </View>

      {!requestId?<>
        <TextField
          ref={phoneRef}
          label={t("auth.phone")}
          placeholder={t("auth.placeholderPhone")}
          error={phoneError??undefined}
          value={phone}
          onChangeText={(value)=>{setPhone(value);setPhoneError(null);setFormError(null);}}
          keyboardType="phone-pad"
          autoComplete="tel"
          returnKeyType="done"
          onSubmitEditing={()=>void requestCode()}
          forceLtr
        />
        <Button
          label={t("auth.sendCode")}
          onPress={()=>void requestCode()}
          loading={busy}
          icon={<Ionicons name="send-outline" size={20} color="#FFFFFF"/>}
        />
      </>:<>
        <View style={styles.sentCard}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.success}/>
          <AppText style={{flex:1}}>{t("auth.codeSent")}</AppText>
        </View>

        <TextField
          ref={codeRef}
          label={t("auth.verificationCode")}
          placeholder={t("auth.codePlaceholder")}
          error={codeError??undefined}
          value={code}
          onChangeText={(value)=>{setCode(value.replace(/\D/g,"").slice(0,6));setCodeError(null);setFormError(null);}}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={6}
          returnKeyType="done"
          onSubmitEditing={()=>void verifyCode()}
          forceLtr
        />

        {debugCode?<View style={styles.devCode}>
          <Ionicons name="code-slash-outline" size={18} color={colors.warning}/>
          <AppText variant="caption" style={{flex:1,color:colors.warning}}>
            {t("auth.devCode",{code:debugCode})}
          </AppText>
        </View>:null}

        <Button
          label={t("auth.verifyCode")}
          onPress={()=>void verifyCode()}
          loading={busy}
          icon={<Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF"/>}
        />

        <Pressable
          accessibilityRole="button"
          onPress={()=>{setRequestId(null);setDebugCode(null);setCode("");setCodeError(null);}}
          style={styles.secondaryLink}
        >
          <AppText weight="semibold" style={{color:colors.primary}}>{t("auth.phone")}</AppText>
        </Pressable>
      </>}

      {formError?<View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.errorBox}>
        <Ionicons name="alert-circle-outline" size={19} color={colors.danger}/>
        <AppText variant="caption" style={{flex:1,color:colors.danger}}>{formError}</AppText>
      </View>:null}

    </Card>

    <Pressable
      accessibilityRole="button"
      onPress={()=>router.replace("/login")}
      style={styles.backLink}
    >
      <Ionicons name={isRTL?"arrow-forward":"arrow-back"} size={18} color={colors.primary}/>
      <AppText weight="bold" style={{color:colors.primary}}>{t("auth.backToLogin")}</AppText>
    </Pressable>
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
  header:{alignItems:"center",gap:spacing.md},
  icon:{width:48,height:48,borderRadius:16,alignItems:"center",justifyContent:"center",backgroundColor:colors.primary},
  sentCard:{flexDirection:"row",alignItems:"center",gap:spacing.sm,padding:spacing.md,borderRadius:radius.md,backgroundColor:"#F0FBF4",borderWidth:1,borderColor:"#B7E2C4"},
  devCode:{flexDirection:"row",alignItems:"center",gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:"#FFFAEC"},
  errorBox:{flexDirection:"row",alignItems:"center",gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:"#FFF4F2",borderWidth:1,borderColor:"#F5C5C1"},
  secondaryLink:{alignSelf:"center",paddingVertical:spacing.xs},
  backLink:{flexDirection:"row",alignSelf:"center",alignItems:"center",gap:spacing.xs,padding:spacing.sm},
});
