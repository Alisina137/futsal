import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { TeamPrivacy } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { ApiRequestError, teamApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function CreateTeamScreen(){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const [name,setName]=useState("");
  const [city,setCity]=useState("");
  const [logoUrl,setLogoUrl]=useState("");
  const [privacy,setPrivacy]=useState<TeamPrivacy>("PUBLIC");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  async function submit(){
    if(!session||name.trim().length<2||city.trim().length<2)return;
    setBusy(true);setError(null);
    try{
      const {team}=await teamApi.create(session.accessToken,{name:name.trim(),city:city.trim(),logoUrl,privacy});
      router.replace({pathname:"/teams/[teamId]",params:{teamId:team.id}});
    }catch(cause){
      setError(cause instanceof ApiRequestError?cause.message:t("teams.createError"));
    }finally{setBusy(false);}
  }

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("teams.createTitle")}</AppText>
      <AppText muted>{t("teams.createSubtitle")}</AppText>
    </View>

    <TextField label={t("teams.name")} value={name} onChangeText={setName} placeholder={t("teams.name")}/>
    <TextField label={t("teams.city")} value={city} onChangeText={setCity} placeholder={t("teams.city")}/>
    <TextField label={t("teams.logoUrl")} value={logoUrl} onChangeText={setLogoUrl} autoCapitalize="none" forceLtr placeholder="https://..."/>

    <Card>
      <AppText weight="semibold">{t("teams.privacy")}</AppText>
      <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
        {(["PUBLIC","PRIVATE"] as const).map((value)=><Pressable
          key={value}
          onPress={()=>setPrivacy(value)}
          style={{
            flex:1,
            padding:spacing.md,
            borderRadius:radius.md,
            borderWidth:1,
            borderColor:privacy===value?colors.primary:colors.border,
            backgroundColor:privacy===value?colors.primarySoft:colors.surface,
          }}
        >
          <AppText weight="semibold" style={privacy===value?{color:colors.primary}:undefined}>{t(`teams.privacy.${value}` as never)}</AppText>
          <AppText variant="caption" muted>{t(value==="PUBLIC"?"teams.privacyPublicBody":"teams.privacyPrivateBody")}</AppText>
        </Pressable>)}
      </View>
    </Card>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    <Button label={t("teams.createAction")} onPress={()=>void submit()} loading={busy} disabled={name.trim().length<2||city.trim().length<2}/>
    <Button label={t("owner.back")} onPress={()=>router.back()} variant="secondary"/>
  </Screen>;
}
