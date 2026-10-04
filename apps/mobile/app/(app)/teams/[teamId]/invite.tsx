import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { TeamMemberRole } from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { ApiRequestError, teamApi } from "../../../../src/lib/api";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { Screen } from "../../../../src/components/ui/Screen";
import { TextField } from "../../../../src/components/ui/TextField";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

type InviteRole=Extract<TeamMemberRole,"CAPTAIN"|"PLAYER">;

export default function InviteTeamPlayerScreen(){
  const {teamId}=useLocalSearchParams<{teamId:string}>();
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const [identifier,setIdentifier]=useState("");
  const [role,setRole]=useState<InviteRole>("PLAYER");
  const [shirtNumber,setShirtNumber]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  async function submit(){
    if(!session||!teamId||identifier.trim().length<3)return;
    const parsedShirt=shirtNumber.trim()===""?null:Number(shirtNumber);
    if(parsedShirt!==null&&(!Number.isInteger(parsedShirt)||parsedShirt<1||parsedShirt>99)){
      setError(t("teams.shirtNumberInvalid"));
      return;
    }

    setBusy(true);setError(null);
    try{
      await teamApi.invite(session.accessToken,teamId,{
        identifier:identifier.trim(),
        role,
        shirtNumber:parsedShirt,
      });
      router.back();
    }catch(cause){
      if(cause instanceof ApiRequestError){
        if(cause.code==="INVITEE_NOT_FOUND")setError(t("teams.inviteNotFound"));
        else if(cause.code==="TEAM_INVITATION_PENDING")setError(t("teams.invitePending"));
        else if(cause.code==="ALREADY_TEAM_MEMBER")setError(t("teams.alreadyMember"));
        else setError(cause.message);
      }else setError(t("teams.inviteError"));
    }finally{setBusy(false);}
  }

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("teams.inviteTitle")}</AppText>
      <AppText muted>{t("teams.inviteSubtitle")}</AppText>
    </View>

    <TextField
      label={t("teams.identifier")}
      placeholder={t("teams.identifierPlaceholder")}
      value={identifier}
      onChangeText={setIdentifier}
      autoCapitalize="none"
      forceLtr
    />

    <Card>
      <AppText weight="semibold">{t("teams.inviteRole")}</AppText>
      <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
        {(["PLAYER","CAPTAIN"] as InviteRole[]).map((value)=><Pressable
          key={value}
          onPress={()=>setRole(value)}
          style={{
            flex:1,
            padding:spacing.md,
            borderRadius:radius.md,
            borderWidth:1,
            borderColor:role===value?colors.primary:colors.border,
            backgroundColor:role===value?colors.primarySoft:colors.surface,
          }}
        >
          <AppText weight="semibold" style={role===value?{color:colors.primary}:undefined}>
            {t(`teams.role.${value}` as never)}
          </AppText>
        </Pressable>)}
      </View>
    </Card>

    <TextField
      label={t("teams.shirtNumber")}
      value={shirtNumber}
      onChangeText={setShirtNumber}
      keyboardType="number-pad"
      forceLtr
      placeholder="1–99"
    />

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    <Button label={t("teams.sendInvite")} onPress={()=>void submit()} loading={busy} disabled={identifier.trim().length<3}/>
    <Button label={t("owner.back")} onPress={()=>router.back()} variant="secondary"/>
  </Screen>;
}
