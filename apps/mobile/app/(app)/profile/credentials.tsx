import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import {router} from "expo-router";
import {useEffect,useState} from "react";
import {Modal,Pressable,StyleSheet,View} from "react-native";
import {ApiRequestError,authApi} from "../../../src/lib/api";
import {formatLocalDateTime} from "../../../src/lib/date-time";
import {AppText} from "../../../src/components/ui/AppText";
import {Button} from "../../../src/components/ui/Button";
import {Card} from "../../../src/components/ui/Card";
import {Screen} from "../../../src/components/ui/Screen";
import {TextField} from "../../../src/components/ui/TextField";
import {useAuth} from "../../../src/providers/AuthProvider";
import {useLocale} from "../../../src/providers/LocaleProvider";

type Step="choose"|"verify"|"update";
type ChangeKind="username"|"password"|"both";
type Field="username"|"password"|"confirmPassword";
type FieldErrors=Partial<Record<Field,string>>;
const changeKinds:ChangeKind[]=["username","password","both"];
const isUsernameChange=(kind:ChangeKind)=>kind==="username"||kind==="both";
const isPasswordChange=(kind:ChangeKind)=>kind==="password"||kind==="both";
const stepKeys:Step[]=["choose","verify","update"];

export default function AccountCredentialsScreen(){
  const {session,signOut}=useAuth();
  const {t,isRTL,language}=useLocale();
  const email=session?.user.emailVerified?session.user.email:null;
  const currentUsername=session?.user.username??"";
  const [step,setStep]=useState<Step>("choose");
  const [kind,setKind]=useState<ChangeKind>("username");
  const [requestId,setRequestId]=useState("");
  const [code,setCode]=useState("");
  const [debugCode,setDebugCode]=useState("");
  const [resetToken,setResetToken]=useState("");
  const [tokenExpiresAt,setTokenExpiresAt]=useState<string|null>(null);
  const [resendUntil,setResendUntil]=useState(0);
  const [now,setNow]=useState(()=>Date.now());
  const [username,setUsername]=useState(currentUsername);
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [fieldErrors,setFieldErrors]=useState<FieldErrors>({});
  const [confirming,setConfirming]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    if(step!=="verify")return;
    const timer=setInterval(()=>setNow(Date.now()),1_000);
    return ()=>clearInterval(timer);
  },[step]);

  const waitSeconds=Math.max(0,Math.ceil((resendUntil-now)/1_000));
  const passwordLength=password.length>=8&&password.length<=128;
  const passwordLetter=/\p{L}/u.test(password);
  const passwordNumber=/\p{N}/u.test(password);
  const passwordSpecial=/[^\p{L}\p{N}\s]/u.test(password);
  const passwordsMatch=password.length>0&&password===confirmPassword;
  const rules=[
    {key:"length",label:t("auth.passwordRuleLength"),met:passwordLength},
    {key:"letter",label:t("auth.passwordRuleLetter"),met:passwordLetter},
    {key:"number",label:t("auth.passwordRuleNumber"),met:passwordNumber},
    {key:"special",label:t("auth.passwordRuleSpecial"),met:passwordSpecial},
    {key:"match",label:t("auth.passwordRuleMatch"),met:passwordsMatch},
  ];

  function resetVerification(){
    setRequestId("");setCode("");setDebugCode("");setResetToken("");
    setTokenExpiresAt(null);setResendUntil(0);setPassword("");
    setConfirmPassword("");setFieldErrors({});setConfirming(false);
    setStep("choose");
  }
  function failure(cause:unknown){
    if(cause instanceof ApiRequestError){
      if(cause.code==="INVALID_RESET_CODE")return t("auth.invalidResetCode");
      if(cause.code==="INVALID_RESET_TOKEN")return t("auth.resetExpired");
      if(cause.code==="USERNAME_ALREADY_EXISTS")return t("auth.usernameTaken");
      if(cause.code==="NO_CREDENTIAL_CHANGE")return t("security.credentialsNoChange");
      if(cause.code==="PASSWORD_RESET_DISABLED")return t("auth.resetDeliveryUnavailable");
      if(cause.code==="PASSWORD_RESET_DELIVERY_UNAVAILABLE"||
        cause.code==="PASSWORD_RESET_DELIVERY_FAILED")return t("security.codeDelivery");
      if(cause.code==="PASSWORD_RESET_COOLDOWN"){
        const availableAt=(cause.details as {availableAt?:unknown}|undefined)?.availableAt;
        if(typeof availableAt==="string"&&!Number.isNaN(Date.parse(availableAt)))
          return t("auth.resetCooldown",{dateTime:formatLocalDateTime(availableAt,language)});
      }
    }
    return t("auth.genericError");
  }

  async function send(){
    if(busy||!email||(step==="verify"&&waitSeconds>0))return;
    setBusy(true);setError("");
    try{
      const result=await authApi.requestPasswordReset({identifier:email});
      setRequestId(result.requestId);
      setDebugCode(result.debugCode??"");
      setCode("");setResetToken("");setTokenExpiresAt(null);
      setResendUntil(Date.now()+60_000);setNow(Date.now());
      setStep("verify");
    }catch(cause){setError(failure(cause));}
    finally{setBusy(false);}
  }

  async function verify(){
    if(busy||!requestId)return;
    if(!/^\d{6}$/.test(code)){setError(t("auth.invalidResetCode"));return;}
    setBusy(true);setError("");
    try{
      const result=await authApi.verifyPasswordReset({requestId,code});
      if(result.email.toLowerCase()!==email?.toLowerCase()){
        resetVerification();setError(t("auth.resetExpired"));return;
      }
      setUsername(result.username);
      setResetToken(result.resetToken);
      setTokenExpiresAt(result.resetTokenExpiresAt);
      setDebugCode("");
      setPassword("");setConfirmPassword("");setFieldErrors({});
      setStep("update");
    }catch(cause){setError(failure(cause));}
    finally{setBusy(false);}
  }

  function clearFieldError(field:Field){
    setFieldErrors(current=>{if(!current[field])return current;
      const next={...current};delete next[field];return next;});
    setError("");
  }
  function validate(){
    const next:FieldErrors={};
    if(isUsernameChange(kind)){
      if(!/^[A-Za-z0-9_]{3,12}$/.test(username.trim()))
        next.username=t("auth.usernameInvalid");
      else if(username.trim().toLowerCase()===currentUsername.toLowerCase()&&!isPasswordChange(kind))
        next.username=t("security.credentialsNoChange");
    }
    if(isPasswordChange(kind)){
      if(!passwordLength||!passwordLetter||!passwordNumber||!passwordSpecial)
        next.password=t("auth.passwordHint");
      if(!confirmPassword)next.confirmPassword=t("auth.confirmPasswordRequired");
      else if(!passwordsMatch)next.confirmPassword=t("auth.passwordMismatch");
    }
    setFieldErrors(next);
    return Object.keys(next).length===0;
  }

  function review(){
    if(busy||!resetToken)return;
    if(tokenExpiresAt&&Date.parse(tokenExpiresAt)<=Date.now()){
      resetVerification();setError(t("auth.resetExpired"));return;
    }
    if(!validate())return;
    setError("");setConfirming(true);
  }

  async function update(){
    if(busy||!requestId||!resetToken)return;
    setBusy(true);setError("");
    try{
      await authApi.completePasswordReset({
        requestId,resetToken,
        ...(isUsernameChange(kind)?{username:username.trim()}:{}),
        ...(isPasswordChange(kind)?{password,confirmPassword}:{}),
      });
      setConfirming(false);
      setPassword("");setConfirmPassword("");setResetToken("");
      // The backend revokes ALL refresh sessions on success. Clear local
      // session before routing to login so stale access is never reused.
      await signOut();
      router.replace({pathname:"/login",params:{reset:"success"}});
    }catch(cause){
      setConfirming(false);
      if(cause instanceof ApiRequestError&&cause.code==="USERNAME_ALREADY_EXISTS")
        setFieldErrors({username:t("auth.usernameTaken")});
      if(cause instanceof ApiRequestError&&cause.code==="INVALID_RESET_TOKEN")
        resetVerification();
      setError(failure(cause));
    }finally{setBusy(false);}
  }

  return <Screen showHeader style={styles.screen}>
    <View style={[styles.hero,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.heroIcon}>
        <Ionicons name="shield-checkmark-outline" size={29} color={colors.primary}/>
      </View>
      <View style={styles.heroText}>
        <AppText variant="title" weight="bold">{t("security.credentials")}</AppText>
        <AppText muted>{t("security.credentialsHelp")}</AppText>
      </View>
    </View>

    <View style={[styles.stepper,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {stepKeys.map((key,index)=><View key={key} style={styles.stepPart}>
        <View style={[styles.stepCircle,
          stepKeys.indexOf(step)>=index&&styles.stepCircleActive]}>
          {stepKeys.indexOf(step)>index
            ?<Ionicons name="checkmark" size={17} color={colors.surface}/>
            :<AppText weight="bold" forceLtr style={{color:stepKeys.indexOf(step)>=index
              ?colors.surface:colors.textMuted}}>{index+1}</AppText>}
        </View>
        <AppText variant="caption" weight={step===key?"bold":"medium"}
          style={[styles.stepLabel,step===key&&styles.stepLabelActive]} numberOfLines={2}>
          {t(("security.credentialsStep."+key) as never)}
        </AppText>
      </View>)}
    </View>

    {!email?<Card style={styles.card}>
      <Ionicons name="mail-unread-outline" size={29} color={colors.primary}/>
      <AppText weight="bold" variant="bodyLarge">{t("security.emailUnverified")}</AppText>
      <AppText muted>{t("security.emailWarning")}</AppText>
      <Button label={t("security.emailAdd")}
        onPress={()=>router.push("/profile/email")}/>
    </Card>:<>
      <View style={[styles.emailPanel,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="mail-outline" size={20} color={colors.primary}/>
        <View style={{flex:1,minWidth:0,gap:2}}>
          <AppText variant="caption" muted>{t("security.emailVerified")}</AppText>
          <AppText weight="semibold" forceLtr numberOfLines={2}>{email}</AppText>
        </View>
        <Ionicons name="checkmark-circle" size={19} color={colors.success}/>
      </View>

      {step==="choose"?<Card style={styles.card}>
        <AppText variant="bodyLarge" weight="bold">
          {t("security.credentialsChoose")}</AppText>
        <AppText muted>{t("security.credentialsChooseHelp")}</AppText>
        {changeKinds.map(option=><Pressable key={option}
          testID={"credentials-mode-"+option}
          accessibilityRole="radio"
          accessibilityState={{checked:kind===option}}
          accessibilityLabel={t(("security.credentialsMode."+option) as never)}
          style={({pressed})=>[styles.modeRow,
            kind===option&&styles.modeSelected,pressed&&styles.pressed,
            {flexDirection:isRTL?"row-reverse":"row"}]}
          onPress={()=>{setKind(option);setError("");}}>
          <View style={[styles.modeIcon,kind===option&&styles.modeIconSelected]}>
            <Ionicons name={option==="username"?"person-outline":
              option==="password"?"key-outline":"shield-outline"}
              size={23} color={colors.primary}/>
          </View>
          <View style={{flex:1,minWidth:0,gap:2}}>
            <AppText weight="bold">{t(("security.credentialsMode."+option) as never)}</AppText>
            <AppText variant="caption" muted>
              {t(("security.credentialsModeHelp."+option) as never)}
            </AppText>
          </View>
          <Ionicons name={kind===option?"radio-button-on":"radio-button-off"}
            size={23} color={kind===option?colors.primary:colors.textMuted}/>
        </Pressable>)}
        <Button label={t("auth.sendCode")} loading={busy} disabled={busy}
          icon={<Ionicons name="mail-outline" size={19} color={colors.surface}/>}
          onPress={()=>void send()}/>
      </Card>:null}

      {step==="verify"?<Card style={styles.card}>
        <AppText variant="bodyLarge" weight="bold">
          {t("security.credentialsStep.verify")}</AppText>
        <AppText muted>{t("security.emailCodeHelp")}</AppText>
        <TextField label={t("auth.verificationCode")} value={code}
          placeholder={t("auth.codePlaceholder")} keyboardType="number-pad" forceLtr
          textContentType="oneTimeCode" autoComplete="one-time-code"
          maxLength={6} onChangeText={value=>{setCode(value.replace(/\D/g,"").slice(0,6));setError("");}}/>
        {debugCode?<AppText variant="caption" forceLtr>
          {t("auth.devCode",{code:debugCode})}</AppText>:null}
        <Button label={t("auth.verifyCode")} disabled={busy||code.length!==6}
          loading={busy} onPress={()=>void verify()}/>
        <View style={[styles.inlineActions,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Button style={styles.inlineButton} variant="secondary"
            label={t("auth.cancelReset")} disabled={busy}
            onPress={()=>{resetVerification();setError("");}}/>
          <Button style={styles.inlineButton} variant="secondary"
            label={waitSeconds>0?t("security.credentialsWait",{seconds:waitSeconds})
              :t("security.credentialsResend")}
            disabled={busy||waitSeconds>0} onPress={()=>void send()}/>
        </View>
      </Card>:null}

      {step==="update"?<Card style={styles.card}>
        <AppText variant="bodyLarge" weight="bold">
          {t("security.credentialsStep.update")}</AppText>
        <AppText muted>{t(("security.credentialsModeHelp."+kind) as never)}</AppText>
        {isUsernameChange(kind)?<>
          <View style={styles.currentUser}>
            <AppText variant="caption" muted>{t("security.credentialsCurrentUsername")}</AppText>
            <AppText weight="semibold" forceLtr>@{currentUsername}</AppText>
          </View>
          <TextField label={t("security.credentialsNewUsername")}
            placeholder={t("auth.placeholderUsername")}
            value={username} maxLength={12} forceLtr autoCapitalize="none"
            autoCorrect={false} autoComplete="off" error={fieldErrors.username}
            hint={t("auth.usernameHint")}
            onChangeText={v=>{setUsername(v);clearFieldError("username");}}/>
        </>:null}
        {isPasswordChange(kind)?<>
          <TextField label={t("security.credentialsNewPassword")}
            value={password} autoCapitalize="none" autoCorrect={false}
            secureTextEntry autoComplete="new-password"
            error={fieldErrors.password} placeholder={t("auth.placeholderNewPassword")}
            onChangeText={v=>{setPassword(v);clearFieldError("password");}}/>
          <TextField label={t("auth.confirmPassword")}
            value={confirmPassword} autoCapitalize="none" autoCorrect={false}
            secureTextEntry autoComplete="new-password"
            error={fieldErrors.confirmPassword}
            placeholder={t("auth.placeholderConfirmPassword")}
            onChangeText={v=>{setConfirmPassword(v);clearFieldError("confirmPassword");}}/>
          <View style={styles.rules}>
            <AppText weight="semibold">{t("auth.passwordGuideTitle")}</AppText>
            {rules.map(rule=><View key={rule.key} style={[styles.rule,
              {flexDirection:isRTL?"row-reverse":"row"}]}>
              <Ionicons name={rule.met?"checkmark-circle":"ellipse-outline"}
                size={18} color={rule.met?colors.success:colors.textMuted}/>
              <AppText variant="caption" muted={!rule.met}>{rule.label}</AppText>
            </View>)}
          </View>
        </>:null}
        <View style={[styles.warningRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="information-circle-outline" size={21} color={colors.primary}/>
          <AppText variant="caption" style={{flex:1}}>
            {t("security.credentialsReauthWarning")}
          </AppText>
        </View>
        <Button label={t("security.credentialsReview")} loading={busy}
          onPress={review}/>
        <Button label={t("auth.cancelReset")} variant="secondary"
          disabled={busy} onPress={()=>{resetVerification();setError("");}}/>
      </Card>:null}
    </>}

    {error?<Card style={styles.errorCard}>
      <View style={[styles.errorRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="alert-circle-outline" size={20} color={colors.danger}/>
        <AppText style={{color:colors.danger,flex:1}}
          accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</AppText>
      </View>
    </Card>:null}

    <Modal visible={confirming} transparent animationType="fade"
      onRequestClose={()=>{if(!busy)setConfirming(false);}}>
      <View style={styles.modalOverlay}>
        <Card style={styles.modalCard}>
          <View style={styles.modalIcon}>
            <Ionicons name="shield-checkmark-outline" size={27} color={colors.primary}/>
          </View>
          <AppText variant="title" weight="bold">
            {t("auth.confirmResetTitle")}</AppText>
          <AppText muted>{t("security.credentialsReauthWarning")}</AppText>
          {isUsernameChange(kind)?<View style={styles.reviewDetail}>
            <AppText variant="caption" muted>{t("security.credentialsNewUsername")}</AppText>
            <AppText forceLtr weight="semibold">@{username.trim()}</AppText>
          </View>:null}
          {isPasswordChange(kind)?<View style={styles.reviewDetail}>
            <AppText variant="caption" muted>{t("security.credentialsNewPassword")}</AppText>
            <AppText weight="semibold">{t("security.credentialsPasswordHidden")}</AppText>
          </View>:null}
          <View style={[styles.inlineActions,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Button label={t("common.cancel")} style={styles.inlineButton}
              variant="secondary" disabled={busy} onPress={()=>setConfirming(false)}/>
            <Button label={t("auth.confirmReset")} style={styles.inlineButton}
              loading={busy} onPress={()=>void update()}/>
          </View>
        </Card>
      </View>
    </Modal>
  </Screen>;
}

const styles=StyleSheet.create({
  screen:{gap:spacing.md,paddingTop:spacing.md},
  hero:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.lg,padding:spacing.md,gap:spacing.md,alignItems:"center"},
  heroIcon:{height:58,width:58,borderRadius:radius.lg,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  heroText:{flex:1,minWidth:0,gap:spacing.xs},
  stepper:{borderRadius:radius.lg,padding:spacing.sm,backgroundColor:colors.surface,
    borderWidth:1,borderColor:colors.border,gap:spacing.xs},
  stepPart:{flex:1,alignItems:"center",gap:spacing.xs,minWidth:0},
  stepCircle:{width:30,height:30,borderRadius:15,backgroundColor:colors.surfaceMuted,
    borderWidth:1,borderColor:colors.border,alignItems:"center",justifyContent:"center"},
  stepCircleActive:{backgroundColor:colors.primary,borderColor:colors.primary},
  stepLabel:{fontSize:12,textAlign:"center"},
  stepLabelActive:{color:colors.primary},
  emailPanel:{alignItems:"center",gap:spacing.sm,padding:spacing.md,
    borderWidth:1,borderColor:"#C3E5D2",backgroundColor:"#F0FBF4",
    borderRadius:radius.lg},
  card:{gap:spacing.md,padding:spacing.md},
  modeRow:{minHeight:82,alignItems:"center",gap:spacing.sm,borderWidth:1,
    borderColor:colors.border,borderRadius:radius.md,padding:spacing.sm,
    backgroundColor:colors.surface},
  modeSelected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  modeIcon:{width:44,height:44,borderRadius:radius.md,backgroundColor:colors.surfaceMuted,
    alignItems:"center",justifyContent:"center"},
  modeIconSelected:{backgroundColor:colors.surface},
  pressed:{opacity:0.76},
  inlineActions:{gap:spacing.sm,flexWrap:"wrap"},
  inlineButton:{flex:1,minWidth:126,paddingHorizontal:spacing.xs},
  currentUser:{borderRadius:radius.md,padding:spacing.sm,backgroundColor:colors.surfaceMuted,gap:4},
  rules:{backgroundColor:colors.surfaceMuted,borderRadius:radius.md,
    gap:spacing.sm,padding:spacing.md},
  rule:{alignItems:"center",gap:spacing.sm},
  warningRow:{alignItems:"flex-start",gap:spacing.sm,padding:spacing.sm,
    backgroundColor:colors.primarySoft,borderRadius:radius.md},
  errorCard:{borderColor:colors.danger,backgroundColor:"#FFF4F4"},
  errorRow:{alignItems:"center",gap:spacing.sm},
  modalOverlay:{flex:1,backgroundColor:"rgba(5,18,36,0.58)",
    padding:spacing.lg,justifyContent:"center",alignItems:"center"},
  modalCard:{width:"100%",maxWidth:420,gap:spacing.md,padding:spacing.lg},
  modalIcon:{width:54,height:54,borderRadius:radius.md,
    alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  reviewDetail:{padding:spacing.sm,borderRadius:radius.md,
    backgroundColor:colors.surfaceMuted,gap:4},
});
