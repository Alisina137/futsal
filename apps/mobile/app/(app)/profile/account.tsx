import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, spacing } from "@leaguekick/design-tokens";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function AccountProfileScreen(){
  const {session,updateProfile}=useAuth();
  const {t,isRTL}=useLocale();
  const user=session?.user;
  const [displayName,setDisplayName]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    if(!user) return;
    setDisplayName(user.displayName===user.username?"":user.displayName);
  },[user]);

  async function save(){
    const value=displayName.trim();
    if(value.length<2){
      setError(t("validation.displayName"));
      setMessage(null);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try{
      await updateProfile({displayName:value});
      setMessage(t("profile.profileSaved"));
    }catch{
      setError(t("auth.genericError"));
    }finally{
      setBusy(false);
    }
  }

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("profile.accountEditTitle")}</AppText>
      <AppText muted>{t("profile.accountEditSubtitle")}</AppText>
    </View>

    <Card>
      <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
        <Ionicons name="at-outline" size={20} color={colors.primary}/>
        <View style={{flex:1,gap:2}}>
          <AppText variant="caption" muted>{t("settings.username")}</AppText>
          <AppText forceLtr weight="semibold">{user?.username?"@"+user.username:""}</AppText>
        </View>
      </View>
      <View style={{height:1,backgroundColor:colors.border}}/>
      <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
        <Ionicons name="call-outline" size={20} color={colors.primary}/>
        <View style={{flex:1,gap:2}}>
          <AppText variant="caption" muted>{t("auth.phone")}</AppText>
          <AppText forceLtr weight="semibold">{user?.phone??""}</AppText>
        </View>
      </View>
    </Card>

    <Card>
      <TextField
        label={t("auth.displayName")}
        placeholder={t("auth.placeholderDisplayName")}
        hint={t("profile.fullNameHint")}
        value={displayName}
        onChangeText={setDisplayName}
        autoComplete="name"
      />
      {message?<AppText accessibilityLiveRegion="polite" style={{color:colors.success}}>{message}</AppText>:null}
      {error?<AppText accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{color:colors.danger}}>{error}</AppText>:null}
      <Button
        label={t("common.save")}
        onPress={()=>void save()}
        loading={busy}
        icon={<Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF"/>}
      />
    </Card>
  </Screen>;
}
