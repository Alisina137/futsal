import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { TeamDto } from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { teamApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function TeamDetailScreen(){
  const {teamId}=useLocalSearchParams<{teamId:string}>();
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const [team,setTeam]=useState<TeamDto|null>(null);
  const [member,setMember]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!teamId)return;
    setLoading(true);setError(null);
    try{
      let next=(await teamApi.publicTeam(teamId)).team;
      if(session){
        try{
          const mine=(await teamApi.mine(session.accessToken)).teams.some((item)=>item.id===teamId);
          setMember(mine);
          if(mine)next=(await teamApi.roster(session.accessToken,teamId)).team;
        }catch{}
      }
      setTeam(next);
    }catch{
      setError(t("teams.publicTeamLoadError"));
    }finally{setLoading(false);}
  },[session,t,teamId]);

  useEffect(()=>{void load();},[load]);

  const myRole=team&&session
    ?team.managerUserId===session.user.id
      ?"MANAGER"
      :team.captainUserId===session.user.id
        ?"CAPTAIN"
        :member?"PLAYER":null
    :null;

  return <Screen showHeader>
    {loading?<AppText>{t("common.loading")}</AppText>:null}
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}

    {team?<>
      <Card style={{backgroundColor:colors.primary}}>
        <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.md,alignItems:"center"}}>
          {team.logoUrl?<Image source={{uri:team.logoUrl}} style={{width:72,height:72,borderRadius:radius.lg}}/>:
            <View style={{width:72,height:72,borderRadius:radius.lg,backgroundColor:"#FFFFFF",alignItems:"center",justifyContent:"center"}}>
              <AppText variant="title" weight="bold" style={{color:colors.primary}}>{team.name.slice(0,2).toUpperCase()}</AppText>
            </View>}
          <View style={{flex:1,gap:spacing.xs}}>
            <AppText variant="title" weight="bold" style={{color:"#FFFFFF"}}>{team.name}</AppText>
            <AppText style={{color:"#DCE8FF"}}>{team.city}</AppText>
            <AppText variant="caption" style={{color:"#DCE8FF"}}>{t("teams.members",{count:team.rosterCount})}</AppText>
            {myRole?<AppText variant="caption" weight="bold" style={{color:"#FFFFFF"}}>{t("teams.myRole")}: {t(`teams.role.${myRole}` as never)}</AppText>:null}
          </View>
        </View>
      </Card>

      <View style={{gap:spacing.xs}}>
        <AppText variant="bodyLarge" weight="bold">{t("teams.roster")}</AppText>
        <AppText muted>{team.privacy==="PRIVATE"&&!member?t("teams.privateRoster"):t("teams.members",{count:team.rosterCount})}</AppText>
      </View>

      {team.members.map((player)=><Pressable
        key={player.userId}
        onPress={()=>router.push({pathname:"/players/[playerId]",params:{playerId:player.userId}})}
      >
        <Card>
          <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.md}}>
            {player.imageUrl?<Image source={{uri:player.imageUrl}} style={{width:48,height:48,borderRadius:24}}/>:
              <View style={{width:48,height:48,borderRadius:24,backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"}}>
                <AppText weight="bold" style={{color:colors.primary}}>{player.publicDisplayName.slice(0,2).toUpperCase()}</AppText>
              </View>}
            <View style={{flex:1,gap:2}}>
              <AppText weight="bold">{player.publicDisplayName}</AppText>
              <AppText variant="caption" muted>{t(`teams.role.${player.role}` as never)} · {t(`teams.position.${player.position}` as never)}</AppText>
              {player.shirtNumber?<AppText variant="caption" style={{color:colors.primary}}>{t("teams.shirtNumberValue",{number:player.shirtNumber})}</AppText>:null}
            </View>
          </View>
        </Card>
      </Pressable>)}

      {!loading&&team.members.length===0&&team.privacy==="PRIVATE"&&!member?<Card>
        <AppText>{t("teams.privateRoster")}</AppText>
      </Card>:null}

      <Button label={t("common.retry")} onPress={()=>void load()} variant="secondary"/>
    </>:null}
  </Screen>;
}
