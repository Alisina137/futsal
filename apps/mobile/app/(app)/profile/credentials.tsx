import Ionicons from "@expo/vector-icons/Ionicons";
import {colors, radius, spacing} from "@leaguekick/design-tokens";
import {router} from "expo-router";
import {useState} from "react";
import {View,StyleSheet} from "react-native";
import {ApiRequestError,authApi} from "../../../src/lib/api";
import {AppText} from "../../../src/components/ui/AppText";
import {Button} from "../../../src/components/ui/Button";
import {Card} from "../../../src/components/ui/Card";
import {Screen} from "../../../src/components/ui/Screen";
import {TextField} from "../../../src/components/ui/TextField";
import {useAuth} from "../../../src/providers/AuthProvider";
import {useLocale} from "../../../src/providers/LocaleProvider";

export default function AccountCredentialsScreen() {
  const {session,signOut}=useAuth();
  const {t,language}=useLocale();
  const [step,setStep]=useState<"request"|"verify"|"update">("request");
  const [requestId,setRequestId]=useState("");
  const [code,setCode]=useState("");
  const [debugCode,setDebugCode]=useState("");
  const [resetToken,setResetToken]=useState("");
  const [username,setUsername]=useState(session?.user.username??"");
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  const email=session?.user.emailVerified?session.user.email:null;

  function failure(cause:unknown){
    if(cause instanceof ApiRequestError){
      if(cause.code==="INVALID_RESET_CODE")return t("auth.invalidResetCode");
      if(cause.code==="INVALID_RESET_TOKEN")return t("auth.resetExpired");
      if(cause.code==="USERNAME_ALREADY_EXISTS")return t("auth.usernameTaken");
      if(cause.code==="PASSWORD_RESET_DELIVERY_UNAVAILABLE"||cause.code==="PASSWORD_RESET_DELIVERY_FAILED")
        return t("security.codeDelivery");
      if(cause.code==="PASSWORD_RESET_COOLDOWN"){
        const availableAt=(cause.details as {availableAt?:unknown}|undefined)?.availableAt;
        if(typeof availableAt==="string"&&!Number.isNaN(Date.parse(availableAt))){
          const dateTime=new Intl.DateTimeFormat(language,{
            dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kabul",
          }).format(new Date(availableAt));
          return t("auth.resetCooldown",{dateTime});
        }
      }
    }
    return t("auth.genericError");
  }

  async function send(){
    if(!email)return;
    setBusy(true);setError("");
    try{
      const result=await authApi.requestPasswordReset({identifier:email});
      setRequestId(result.requestId);setDebugCode(result.debugCode??"");
      setCode("");setStep("verify");
    }catch(cause){setError(failure(cause));}
    finally{setBusy(false);}
  }

  async function verify(){
    if(!/^\d{6}$/.test(code)){setError(t("auth.invalidResetCode"));return;}
    setBusy(true);setError("");
    try{
      const result=await authApi.verifyPasswordReset({requestId,code});
      setResetToken(result.resetToken);setUsername(result.username);setStep("update");
    }catch(cause){setError(failure(cause));}
    finally{setBusy(false);}
  }

  async function update(){
    if(!/^[A-Za-z0-9_]{3,12}$/.test(username)){
      setError(t("auth.usernameInvalid"));return;
    }
    if(password.length<8||!/\p{L}/u.test(password)||!/\p{N}/u.test(password)||
      !/[^\p{L}\p{N}\s]/u.test(password)){
      setError(t("auth.passwordHint"));return;
    }
    if(password!==confirmPassword){setError(t("auth.passwordMismatch"));return;}
    setBusy(true);setError("");
    try{
      await authApi.completePasswordReset({requestId,resetToken,username,password,confirmPassword});
      await signOut();
      router.replace({pathname:"/login",params:{reset:"success"}});
    }catch(cause){setError(failure(cause));}
    finally{setBusy(false);}
  }

  return <Screen showHeader style={styles.screen}>
    <Card style={styles.card}>
      <View style={styles.icon}><Ionicons name="lock-closed-outline" size={28} color={colors.primary}/></View>
      <AppText variant="title" weight="bold">{t("security.credentials")}</AppText>
      {!email?<View style={{gap:spacing.md}}>
        <AppText muted>{t("security.emailWarning")}</AppText>
        <Button label={t("security.emailAdd")} onPress={()=>router.push("/profile/email")}/>
      </View>:<>
        <AppText muted>{t("security.credentialsHelp")}</AppText>
        <AppText forceLtr weight="semibold" style={{color:colors.primary}}>{email}</AppText>
        {step==="request"?<Button label={t("auth.sendCode")} loading={busy}
          onPress={()=>void send()}/>:null}
        {step==="verify"?<>
          <AppText muted>{t("security.emailCodeHelp")}</AppText>
          <TextField label={t("auth.verificationCode")} value={code}
            placeholder={t("auth.codePlaceholder")} forceLtr keyboardType="number-pad" maxLength={6}
            onChangeText={v=>{setCode(v.replace(/\D/g,"").slice(0,6));setError("");}}/>
          {debugCode?<AppText variant="caption" forceLtr>{t("auth.devCode",{code:debugCode})}</AppText>:null}
          <Button label={t("auth.verifyCode")} loading={busy} onPress={()=>void verify()}/>
        </>:null}
        {step==="update"?<>
          <TextField label={t("auth.username")} value={username} forceLtr maxLength={12}
            onChangeText={v=>{setUsername(v);setError("");}} autoCapitalize="none"/>
          <TextField label={t("auth.password")} placeholder={t("auth.placeholderNewPassword")}
            value={password} onChangeText={v=>{setPassword(v);setError("");}}
            secureTextEntry autoComplete="new-password"/>
          <TextField label={t("auth.confirmPassword")} placeholder={t("auth.placeholderConfirmPassword")}
            value={confirmPassword} onChangeText={v=>{setConfirmPassword(v);setError("");}}
            secureTextEntry autoComplete="new-password"/>
          <AppText variant="caption" muted>{t("auth.passwordHint")}</AppText>
          <Button label={t("auth.confirmReset")} loading={busy} onPress={()=>void update()}/>
        </>:null}
      </>}
      {error?<AppText accessibilityRole="alert" style={{color:colors.danger}}>{error}</AppText>:null}
    </Card>
  </Screen>;
}

const styles=StyleSheet.create({
  screen:{gap:spacing.md},
  card:{padding:spacing.lg,borderRadius:radius.lg,gap:spacing.md},
  icon:{width:56,height:56,borderRadius:28,backgroundColor:colors.primarySoft,
    justifyContent:"center",alignItems:"center"},
});
