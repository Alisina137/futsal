import { colors, spacing } from "@leaguekick/design-tokens";
import type { TeamInvitationDto } from "@leaguekick/contracts";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { teamApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function TeamInvitationsScreen(){
  const {session}=useAuth();
  const {t}=useLocale();
  const [items,setItems]=useState<TeamInvitationDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [busyId,setBusyId]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!session)return;
    setLoading(true);setError(null);
    try{
      setItems((await teamApi.invitations(session.accessToken)).invitations);
    }catch{
      setError(t("teams.invitationLoadError"));
    }finally{
      setLoading(false);
    }
  },[session,t]);

  useEffect(()=>{void load();},[load]);

  async function respond(invitationId:string,accept:boolean){
    if(!session)return;
    setBusyId(invitationId);setError(null);
    try{
      if(accept)await teamApi.acceptInvitation(session.accessToken,invitationId);
      else await teamApi.declineInvitation(session.accessToken,invitationId);
      await load();
    }catch{
      setError(t("teams.invitationActionError"));
    }finally{
      setBusyId(null);
    }
  }

  const pending=items.filter((item)=>item.status==="PENDING");

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("teams.invitationsTitle")}</AppText>
      <AppText muted>{t("teams.invitationsSubtitle")}</AppText>
    </View>

    <Button label={t("common.retry")} onPress={()=>void load()} loading={loading} variant="secondary"/>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}

    {!loading&&pending.length===0?<Card>
      <AppText>{t("teams.noPendingInvitations")}</AppText>
    </Card>:null}

    {pending.map((item)=><Card key={item.id}>
      <AppText variant="bodyLarge" weight="bold">{item.teamName}</AppText>
      <AppText>{t("teams.invitedAs",{role:t(`teams.role.${item.role}` as never)})}</AppText>
      {item.shirtNumber?<AppText>{t("teams.shirtNumberValue",{number:item.shirtNumber})}</AppText>:null}
      <AppText variant="caption" muted forceLtr>{item.expiresAt}</AppText>
      <View style={{flexDirection:"row",gap:spacing.sm}}>
        <Button
          label={t("teams.accept")}
          onPress={()=>void respond(item.id,true)}
          loading={busyId===item.id}
          style={{flex:1}}
        />
        <Button
          label={t("teams.decline")}
          onPress={()=>void respond(item.id,false)}
          disabled={busyId!==null}
          variant="secondary"
          style={{flex:1}}
        />
      </View>
    </Card>)}
  </Screen>;
}
