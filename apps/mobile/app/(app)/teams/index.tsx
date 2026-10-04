import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { TeamListItemDto } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { teamApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function MyTeamsScreen(){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const [teams,setTeams]=useState<TeamListItemDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!session)return;
    setLoading(true);setError(null);
    try{setTeams((await teamApi.mine(session.accessToken)).teams);}
    catch{setError(t("teams.loadError"));}
    finally{setLoading(false);}
  },[session,t]);

  useEffect(()=>{void load();},[load]);

  function role(team:TeamListItemDto){
    if(team.managerUserId===session?.user.id)return "MANAGER";
    if(team.captainUserId===session?.user.id)return "CAPTAIN";
    return "PLAYER";
  }

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("teams.title")}</AppText>
      <AppText muted>{t("teams.subtitle")}</AppText>
    </View>

    <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
      <Button label={t("teams.create")} onPress={()=>router.push("/teams/create")} style={{flex:1}}/>
      <Button label={t("teams.invitationsTitle")} onPress={()=>router.push("/teams/invitations")} variant="secondary" style={{flex:1}}/>
    </View>

    <Button label={t("common.retry")} onPress={()=>void load()} loading={loading} variant="ghost"/>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}

    {!loading&&teams.length===0?<Card>
      <AppText variant="bodyLarge" weight="bold">{t("teams.empty")}</AppText>
      <AppText muted>{t("teams.emptyBody")}</AppText>
    </Card>:null}

    {teams.map((team)=><Pressable
      key={team.id}
      onPress={()=>router.push({pathname:"/teams/[teamId]",params:{teamId:team.id}})}
      style={({pressed})=>pressed?{opacity:0.8}:undefined}
    >
      <Card>
        <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.md}}>
          {team.logoUrl?<Image source={{uri:team.logoUrl}} style={{width:58,height:58,borderRadius:radius.md}}/>:
            <View style={{width:58,height:58,borderRadius:radius.md,backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"}}>
              <AppText variant="bodyLarge" weight="bold" style={{color:colors.primary}}>{team.name.slice(0,2).toUpperCase()}</AppText>
            </View>}
          <View style={{flex:1,gap:spacing.xs}}>
            <AppText variant="bodyLarge" weight="bold">{team.name}</AppText>
            <AppText muted>{team.city}</AppText>
            <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,flexWrap:"wrap"}}>
              <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
                {t(`teams.role.${role(team)}` as never)}
              </AppText>
              <AppText variant="caption" muted>{t("teams.members",{count:team.rosterCount})}</AppText>
            </View>
          </View>
        </View>
      </Card>
    </Pressable>)}
  </Screen>;
}
