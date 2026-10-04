import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing, touchTarget } from "@leaguekick/design-tokens";
import type { AccountType } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { ApiRequestError } from "../../src/lib/api";
import { AppText } from "../../src/components/ui/AppText";
import { Button } from "../../src/components/ui/Button";
import { Card } from "../../src/components/ui/Card";
import { Screen } from "../../src/components/ui/Screen";
import { TextField } from "../../src/components/ui/TextField";
import { LanguagePicker } from "../../src/components/LanguagePicker";
import { useAuth } from "../../src/providers/AuthProvider";
import { useLocale } from "../../src/providers/LocaleProvider";

export default function RegisterScreen(){
  const {t,language,isRTL}=useLocale();
  const {register}=useAuth();

  const [displayName,setDisplayName]=useState("");
  const [phone,setPhone]=useState("");
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [accountType,setAccountType]=useState<AccountType>("PLAYER");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const passwordHasLength=password.length>=8;
  const passwordHasSpecial=/[^A-Za-z0-9\s]/.test(password);
  const passwordValid=passwordHasLength&&passwordHasSpecial;

  async function submit(){
    if(displayName.trim().length<2){
      setError(t("validation.displayName"));
      return;
    }
    if(!passwordValid){
      setError(t("validation.password"));
      return;
    }

    setBusy(true);
    setError(null);
    try{
      await register({
        displayName:displayName.trim(),
        phone,
        username:username.trim(),
        password,
        preferredLanguage:language,
        accountType,
      });
      router.replace(accountType==="VENUE_OWNER"?"/owner/onboarding":"/home");
    }catch(e){
      if(e instanceof ApiRequestError&&e.code==="IDENTITY_ALREADY_EXISTS"){
        setError(t("auth.duplicateIdentity"));
      }else if(e instanceof ApiRequestError&&e.code==="INVALID_PHONE"){
        setError(t("validation.phone"));
      }else{
        setError(t("auth.genericError"));
      }
    }finally{
      setBusy(false);
    }
  }

  const options:[AccountType,string][]=[
    ["PLAYER",t("auth.player")],
    ["VENUE_OWNER",t("auth.venueOwner")],
  ];

  const passwordRules=[
    {key:"length",label:t("auth.passwordRuleLength"),met:passwordHasLength},
    {key:"special",label:t("auth.passwordRuleSpecial"),met:passwordHasSpecial},
  ];

  return <Screen>
    <View style={{gap:spacing.sm}}>
      <AppText variant="title" weight="bold">{t("auth.registerTitle")}</AppText>
      <AppText muted>{t("auth.registerSubtitle")}</AppText>
    </View>

    <LanguagePicker/>

    <TextField
      label={t("auth.displayName")}
      placeholder={t("auth.placeholderDisplayName")}
      value={displayName}
      onChangeText={setDisplayName}
      autoComplete="name"
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
      label={t("auth.usernameOptional")}
      placeholder={t("auth.placeholderUsername")}
      value={username}
      onChangeText={setUsername}
      autoCapitalize="none"
      autoComplete="username"
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

    <Card style={{backgroundColor:colors.surfaceMuted}}>
      <AppText weight="semibold">{t("auth.passwordGuideTitle")}</AppText>

      {passwordRules.map((rule)=><View
        key={rule.key}
        style={{
          flexDirection:isRTL?"row-reverse":"row",
          alignItems:"center",
          gap:spacing.sm,
        }}
      >
        <Ionicons
          name={rule.met?"checkmark-circle":"ellipse-outline"}
          size={20}
          color={rule.met?colors.success:colors.textMuted}
        />
        <AppText
          variant="caption"
          style={{flex:1,color:rule.met?colors.success:colors.textMuted}}
        >
          {rule.label}
        </AppText>
      </View>)}

      <View
        style={{
          flexDirection:isRTL?"row-reverse":"row",
          alignItems:"center",
          gap:spacing.sm,
        }}
      >
        <Ionicons name="information-circle-outline" size={20} color={colors.primary}/>
        <AppText variant="caption" style={{flex:1,color:colors.primary}}>
          {t("auth.passwordRuleLettersNumbers")}
        </AppText>
      </View>
    </Card>

    <View style={{gap:spacing.sm}}>
      <AppText weight="medium">{t("auth.accountType")}</AppText>
      <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
        {options.map(([value,label])=><Pressable
          key={value}
          onPress={()=>setAccountType(value)}
          style={{
            flex:1,
            minHeight:touchTarget,
            alignItems:"center",
            justifyContent:"center",
            borderWidth:1,
            borderColor:accountType===value?colors.primary:colors.border,
            backgroundColor:accountType===value?colors.primarySoft:colors.surface,
            borderRadius:radius.md,
            padding:spacing.sm,
          }}
        >
          <AppText
            weight={accountType===value?"semibold":"regular"}
            style={accountType===value?{color:colors.primary}:undefined}
          >
            {label}
          </AppText>
        </Pressable>)}
      </View>
    </View>

    {error?<AppText style={{color:colors.danger}}>{error}</AppText>:null}

    <Button
      label={t("auth.register")}
      onPress={()=>void submit()}
      loading={busy}
    />

    <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,justifyContent:"center"}}>
      <AppText muted>{t("auth.haveAccount")}</AppText>
      <Pressable onPress={()=>router.push("/login")}>
        <AppText weight="semibold" style={{color:colors.primary}}>{t("auth.login")}</AppText>
      </Pressable>
    </View>
  </Screen>;
}
