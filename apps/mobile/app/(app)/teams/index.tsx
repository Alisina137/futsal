import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { TeamDirectoryItemDto } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, View } from "react-native";
import { teamApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function TeamsDirectoryScreen(){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const teamOwner=session?.user.roles.includes("TEAM_MANAGER")??false;
  const [teams,setTeams]=useState<TeamDirectoryItemDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [joiningId,setJoiningId]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!session)return;
    setLoading(true);setError(null);
    try{
      setTeams((await teamApi.directory(session.accessToken)).teams);
    }catch{
      setError(t("teams.directoryLoadError"));
    }finally{
      setLoading(false);
    }
  },[session,t]);

  useEffect(()=>{void load();},[load]);

  async function requestJoin(teamId:string){
    if(!session||joiningId)return;
    setJoiningId(teamId);setError(null);
    try{
      await teamApi.requestJoin(session.accessToken,teamId);
      setTeams((current)=>current.map((team)=>
        team.id===teamId?{...team,joinRequestStatus:"PENDING"}:team
      ));
    }catch{
      setError(t("teams.joinRequestError"));
    }finally{
      setJoiningId(null);
    }
  }

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("teams.title")}</AppText>
      <AppText muted>{t("teams.directorySubtitle")}</AppText>
    </View>

    <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
      <Button
        label={t("teams.invitationsTitle")}
        onPress={()=>router.push("/teams/invitations")}
        variant="secondary"
        style={{flex:1}}
      />
      {teamOwner?<Button
        label={t("teams.create")}
        onPress={()=>router.push("/teams/create")}
        style={{flex:1}}
      />:null}
    </View>

    <Button label={t("common.retry")} onPress={()=>void load()} loading={loading} variant="ghost"/>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}

    {!loading&&teams.length===0?<Card>
      <AppText variant="bodyLarge" weight="bold">{t("teams.directoryEmpty")}</AppText>
      <AppText muted>{t("teams.directoryEmptyBody")}</AppText>
    </Card>:null}

    {teams.map((team)=><Card key={team.id} style={{gap:spacing.md}}>
      <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.md}}>
        {team.logoUrl?<Image source={{uri:team.logoUrl}} style={{width:62,height:62,borderRadius:radius.md}}/>:
          <View style={{width:62,height:62,borderRadius:radius.md,backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"}}>
            <AppText variant="bodyLarge" weight="bold" style={{color:colors.primary}}>{team.name.slice(0,2).toUpperCase()}</AppText>
          </View>}
        <View style={{flex:1,gap:spacing.xs}}>
          <AppText variant="bodyLarge" weight="bold">{team.name}</AppText>
          <AppText muted>{team.city}</AppText>
          <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,flexWrap:"wrap",alignItems:"center"}}>
            <View style={{flexDirection:isRTL?"row-reverse":"row",gap:4,alignItems:"center"}}>
              <Ionicons name="people-outline" size={15} color={colors.textMuted}/>
              <AppText variant="caption" muted>{t("teams.members",{count:team.rosterCount})}</AppText>
            </View>
            <AppText variant="caption" muted>·</AppText>
            <AppText variant="caption" muted>{t(`teams.privacy.${team.privacy}` as never)}</AppText>
          </View>
          {team.myMembershipRole?<AppText variant="caption" weight="semibold" style={{color:colors.success}}>
            {t("teams.alreadyMemberSelf")} · {t(`teams.role.${team.myMembershipRole}` as never)}
          </AppText>:team.joinRequestStatus==="PENDING"?<AppText variant="caption" weight="semibold" style={{color:colors.warning}}>
            {t("teams.joinRequestPending")}
          </AppText>:null}
        </View>
      </View>

      <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
        <Button
          label={t("teams.viewTeam")}
          onPress={()=>router.push({pathname:"/teams/[teamId]",params:{teamId:team.id}})}
          variant="secondary"
          style={{flex:1}}
        />
        {!team.myMembershipRole&&team.joinRequestStatus!=="PENDING"?<Button
          label={t("teams.requestToJoin")}
          onPress={()=>void requestJoin(team.id)}
          loading={joiningId===team.id}
          disabled={joiningId!==null&&joiningId!==team.id}
          style={{flex:1}}
        />:null}
      </View>
    </Card>)}
  </Screen>;
}
