import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { PublicPlayerProfileDto } from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { teamApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function PublicPlayerProfileScreen(){
  const {playerId}=useLocalSearchParams<{playerId:string}>();
  const {t,isRTL}=useLocale();
  const [player,setPlayer]=useState<PublicPlayerProfileDto|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    if(!playerId)return;
    setLoading(true);setError(null);
    teamApi.publicPlayer(playerId)
      .then(({player})=>setPlayer(player))
      .catch(()=>setError(t("teams.publicPlayerLoadError")))
      .finally(()=>setLoading(false));
  },[playerId,t]);

  return <Screen showHeader>
    {loading?<AppText>{t("common.loading")}</AppText>:null}
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    {player?<>
      <Card style={{alignItems:"center",paddingVertical:spacing.lg}}>
        {player.imageUrl?<Image source={{uri:player.imageUrl}} style={{width:96,height:96,borderRadius:48}}/>:
          <View style={{width:96,height:96,borderRadius:48,backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"}}>
            <AppText variant="title" weight="bold" style={{color:colors.primary}}>{player.publicDisplayName.slice(0,2).toUpperCase()}</AppText>
          </View>}
        <AppText variant="title" weight="bold">{player.publicDisplayName}</AppText>
        <View style={{paddingHorizontal:spacing.md,paddingVertical:spacing.sm,borderRadius:radius.pill,backgroundColor:colors.primarySoft}}>
          <AppText weight="semibold" style={{color:colors.primary}}>{t(`teams.position.${player.position}` as never)}</AppText>
        </View>
      </Card>

      <View style={{gap:spacing.xs}}>
        <AppText variant="bodyLarge" weight="bold">{t("teams.currentTeams")}</AppText>
        {player.teams.length===0?<AppText muted>{t("teams.noPublicTeams")}</AppText>:null}
      </View>

      {player.teams.map((team)=><Pressable
        key={team.id}
        onPress={()=>router.push({pathname:"/teams/[teamId]",params:{teamId:team.id}})}
      >
        <Card>
          <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.md}}>
            {team.logoUrl?<Image source={{uri:team.logoUrl}} style={{width:48,height:48,borderRadius:radius.md}}/>:
              <View style={{width:48,height:48,borderRadius:radius.md,backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"}}>
                <AppText weight="bold" style={{color:colors.primary}}>{team.name.slice(0,2).toUpperCase()}</AppText>
              </View>}
            <View style={{flex:1}}>
              <AppText weight="bold">{team.name}</AppText>
              <AppText variant="caption" muted>{team.city} · {t(`teams.role.${team.role}` as never)}</AppText>
            </View>
          </View>
        </Card>
      </Pressable>)}
    </>:null}
  </Screen>;
}
