import { colors, spacing } from "@leaguekick/design-tokens";
import type { TeamInvitationDto } from "@leaguekick/contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { teamApi } from "../../../src/lib/api";
import { formatLocalDateTimeParts } from "../../../src/lib/date-time";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function TeamInvitationsScreen(){
  const {session,revalidate}=useAuth();
  const {t,isRTL,language}=useLocale();
  const [items,setItems]=useState<TeamInvitationDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [feedback,setFeedback]=useState<string|null>(null);
  const [busyId,setBusyId]=useState<string|null>(null);
  const loadGeneration=useRef(0);

  const load=useCallback(async()=>{
    const generation=++loadGeneration.current;
    if(!session){setItems([]);setLoading(false);return;}
    setLoading(true);setError(null);
    try{
      const response=await teamApi.invitations(session.accessToken);
      if(loadGeneration.current===generation)setItems(response.invitations);
    }catch{
      if(loadGeneration.current===generation)setError(t("teams.invitationLoadError"));
    }finally{
      if(loadGeneration.current===generation)setLoading(false);
    }
  },[session?.accessToken,t]);

  useFocusEffect(useCallback(()=>{
    void load();
    return()=>{loadGeneration.current++;};
  },[load]));

  async function respond(invitationId:string,accept:boolean){
    if(!session||busyId)return;
    setBusyId(invitationId);setError(null);setFeedback(null);
    try{
      if(accept)await teamApi.acceptInvitation(session.accessToken,invitationId);
      else await teamApi.declineInvitation(session.accessToken,invitationId);
      if(accept)await revalidate().catch(()=>{});
      await load();
      setFeedback(t(accept?"teams.phase4.invitationAccepted":"teams.phase4.invitationDeclined"));
    }catch{
      setError(t("teams.invitationActionError"));
    }finally{
      setBusyId(null);
    }
  }

  const pending=items.filter((item)=>item.status==="PENDING");

  if(loading)return <Screen showHeader><DataLoadingState variant="list" minHeight={500}/></Screen>;

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("teams.invitationsTitle")}</AppText>
      <AppText muted>{t("teams.invitationsSubtitle")}</AppText>
    </View>

    <Button label={t("common.retry")} onPress={()=>void load()} loading={loading} variant="secondary"/>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    {feedback?<Card><AppText style={{color:colors.primary}}>{feedback}</AppText></Card>:null}

    {!loading&&pending.length===0?<Card>
      <AppText>{t("teams.noPendingInvitations")}</AppText>
    </Card>:null}

    {pending.map((item)=>{
      const expiry=formatLocalDateTimeParts(item.expiresAt,language);
      return <Card key={item.id}>
      <AppText variant="bodyLarge" weight="bold">{item.teamName}</AppText>
      <Button label={t("teams.phase4.openTeam")} variant="ghost"
        onPress={()=>router.push({pathname:"/teams/[teamId]",params:{teamId:item.teamId}})}/>
      <AppText>{t("teams.invitedAs",{role:t(`teams.role.${item.role}` as never)})}</AppText>
      {item.shirtNumber?<AppText>{t("teams.shirtNumberValue",{number:item.shirtNumber})}</AppText>:null}
      <View style={{gap:2}}>
        <AppText variant="caption" muted>{expiry.date}</AppText>
        <AppText variant="caption" muted>{expiry.time}</AppText>
      </View>
      <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
        <Button
          label={t("teams.accept")}
          onPress={()=>void respond(item.id,true)}
          loading={busyId===item.id}
          disabled={busyId!==null}
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
    </Card>;
    })}
  </Screen>;
}
