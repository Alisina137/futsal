import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ApiRequestError, authApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function SecureEmailScreen() {
  const {session,revalidate,signOut}=useAuth();
  const {t}=useLocale();
  const [email,setEmail]=useState(session?.user.email??"");
  const [password,setPassword]=useState("");
  const [code,setCode]=useState("");
  const [requestId,setRequestId]=useState<string|null>(null);
  const [expiresAt,setExpiresAt]=useState<string|null>(null);
  const [debugCode,setDebugCode]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState<string|null>(null);

  async function begin(){
    if(!session)return;
    setError(null);
    const normalized=email.trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)){
      setError(t("profile.emailInvalid"));return;
    }
    if(!password){setError(t("auth.passwordRequired"));return;}
    setBusy(true);
    try {
      const result=await authApi.requestEmailVerification(session.accessToken,{email:normalized,password});
      setRequestId(result.requestId);
      setExpiresAt(result.expiresAt);
      setDebugCode(result.debugCode??null);
      setNotice(t("security.emailCodeHelp"));
      setPassword("");
    }catch(cause){
      if(cause instanceof ApiRequestError){
        if(cause.code==="INVALID_CREDENTIALS")setError(t("auth.invalidCredentials"));
        else if(cause.code==="EMAIL_CODE_RATE_LIMIT")setError(t("security.emailWait"));
        else if(cause.code==="EMAIL_DELIVERY_UNAVAILABLE"||cause.code==="EMAIL_DELIVERY_FAILED")
          setError(t("security.codeDelivery"));
        else if(cause.code==="EMAIL_ALREADY_EXISTS")setError(t("profile.emailTaken"));
        else setError(t("auth.genericError"));
      }else setError(t("auth.genericError"));
    }finally {setBusy(false);}
  }

  async function verify(){
    if(!session||!requestId)return;
    if(!/^\d{6}$/.test(code)){setError(t("security.emailInvalidCode"));return;}
    setBusy(true);setError(null);
    try{
      const result=await authApi.confirmEmailVerification(session.accessToken,{requestId,code});
      if(result.reauthRequired){
        await signOut();
        router.replace("/login");
      } else {
        await revalidate();
        router.back();
      }
    }catch(cause){
      setError(cause instanceof ApiRequestError&&cause.code==="EMAIL_ALREADY_EXISTS"
        ?t("profile.emailTaken")
        :cause instanceof ApiRequestError&&cause.code==="INVALID_EMAIL_CODE"
          ?t("security.emailInvalidCode")
          :t("auth.genericError"));
    }finally{setBusy(false);}
  }

  return <Screen showHeader style={styles.screen}>
    <Card style={styles.card}>
      <View style={styles.iconCircle}><Ionicons name="shield-checkmark" size={30} color={colors.primary}/></View>
      <AppText variant="title" weight="bold">{t("security.emailTitle")}</AppText>
      <AppText muted>{t("security.emailSubtitle")}</AppText>
      {session?.user.emailVerified?<AppText forceLtr weight="semibold" style={{color:colors.success}}>
        {t("security.emailVerified")}: {session.user.email}
      </AppText>:null}
      {!requestId?<>
        <TextField label={t("profile.email")} placeholder={t("profile.emailPlaceholder")}
          value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false}
          keyboardType="email-address" autoComplete="email" forceLtr/>
        <TextField label={t("auth.password")} placeholder={t("auth.placeholderPassword")}
          value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password"/>
        <Button label={t("security.emailContinue")} onPress={()=>void begin()} loading={busy}
          icon={<Ionicons name="mail-outline" color="#FFFFFF" size={20}/>}/>
      </>:<>
        <AppText muted>{notice}</AppText>
        <AppText forceLtr variant="caption">{email.toLowerCase()}</AppText>
        <TextField label={t("auth.verificationCode")} placeholder={t("auth.codePlaceholder")}
          value={code} maxLength={6} onChangeText={value=>setCode(value.replace(/\D/g,"").slice(0,6))}
          keyboardType="number-pad" forceLtr/>
        {expiresAt?<AppText variant="caption" muted>{t("security.emailCodeHelp")}</AppText>:null}
        {debugCode?<AppText variant="caption" forceLtr>{t("auth.devCode",{code:debugCode})}</AppText>:null}
        <Button label={t("auth.verifyCode")} onPress={()=>void verify()} loading={busy}/>
        <Pressable accessibilityRole="button" onPress={()=>{
          setRequestId(null);setCode("");setError(null);setDebugCode(null);setExpiresAt(null);
        }}>
          <AppText style={{textAlign:"center",color:colors.primary}}>{t("security.emailChange")}</AppText>
        </Pressable>
      </>}
      {error?<AppText accessibilityRole="alert" style={{color:colors.danger}}>{error}</AppText>:null}
    </Card>
  </Screen>;
}
const styles=StyleSheet.create({
  screen:{gap:spacing.md},
  card:{padding:spacing.lg,borderRadius:radius.lg,gap:spacing.md},
  iconCircle:{width:56,height:56,borderRadius:28,backgroundColor:colors.primarySoft,
    justifyContent:"center",alignItems:"center"},
});
