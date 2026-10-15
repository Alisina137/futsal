import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { ManualTeamDto } from "@leaguekick/contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { ApiRequestError, manualTeamApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function OwnerManualTeamsScreen() {
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const token=session?.accessToken;
  const userId=session?.user.id;
  const [teams,setTeams]=useState<ManualTeamDto[]>([]);
  const [loadedToken,setLoadedToken]=useState<string|null>(null);
  const serial=useRef(0);
  const currentActor=useRef(token);
  currentActor.current=token;
  const [name,setName]=useState("");
  const [city,setCity]=useState("");
  const [editingId,setEditingId]=useState<string|null>(null);
  const [busyToken,setBusyToken]=useState<string|null>(null);
  const busy=busyToken===token;
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const load=useCallback(async()=>{
    const request=++serial.current;
    if(!token){setTeams([]);setLoadedToken(null);setLoading(false);return;}
    setLoading(true);
    try {
      const result=await manualTeamApi.mine(token);
      if(request!==serial.current)return;
      setTeams(result.teams);setLoadedToken(token);setError(null);
    }catch {
      if(request===serial.current)setError(t("manualTeams.loadError"));
    }finally{
      if(request===serial.current)setLoading(false);
    }
  },[token,t]);
  useFocusEffect(useCallback(()=>{
    void load();
    return()=>{serial.current++;};
  },[load]));
  useEffect(()=>{
    setEditingId(null);setName("");setCity("");setMessage(null);setError(null);
  },[userId,token]);
  const visibleTeams=loadedToken===token?teams:[];

  function beginEdit(team:ManualTeamDto){
    setEditingId(team.id);setName(team.name);setCity(team.city);setMessage(null);setError(null);
  }
  function reset(){
    setEditingId(null);setName("");setCity("");
  }
  async function save(){
    if(!session||busy||name.trim().length<2||city.trim().length<2||loadedToken!==token)return;
    const actorToken=session.accessToken;
    if(actorToken!==currentActor.current)return;
    setBusyToken(actorToken);setError(null);setMessage(null);
    try {
      if(editingId){
        await manualTeamApi.update(actorToken,editingId,{name:name.trim(),city:city.trim()});
      }else{
        await manualTeamApi.create(actorToken,{name:name.trim(),city:city.trim()});
      }
      if(actorToken!==currentActor.current)return;
      reset();
      await load();
      if(actorToken===currentActor.current)setMessage(t("manualTeams.saved"));
    }catch(e){
      if(actorToken===currentActor.current)
        setError(e instanceof ApiRequestError?e.message:t("manualTeams.saveError"));
    }finally{
      setBusyToken(current=>current===actorToken?null:current);
    }
  }

  return <Screen embedded>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("manualTeams.title")}</AppText>
      <AppText muted>{t("manualTeams.description")}</AppText>
    </View>
    <Card style={{gap:spacing.md}}>
      <AppText weight="bold" variant="bodyLarge">{t(editingId?"manualTeams.edit":"manualTeams.create")}</AppText>
      <TextField label={t("teams.name")} value={name} onChangeText={setName}
        maxLength={100} placeholder={t("teams.name")}/>
      <TextField label={t("teams.city")} value={city} onChangeText={setCity}
        maxLength={80} placeholder={t("teams.city")}/>
      <Button label={t(editingId?"common.save":"manualTeams.create")} loading={busy}
        disabled={name.trim().length<2||city.trim().length<2} onPress={()=>void save()}/>
      {editingId?<Button label={t("common.cancel")} variant="secondary" onPress={reset}/>:null}
    </Card>
    {message?<Card><AppText style={{color:colors.success}}>{message}</AppText></Card>:null}
    {error?<Card style={{gap:spacing.sm}}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button variant="secondary" label={t("common.retry")} onPress={()=>void load()}/>
    </Card>:null}
    {loading?<DataLoadingState variant="list" minHeight={280}/>:<>
      <AppText weight="bold" variant="bodyLarge">{t("manualTeams.savedTeams")} ({visibleTeams.length})</AppText>
      {visibleTeams.length===0?<Card><AppText muted>{t("manualTeams.empty")}</AppText></Card>:null}
      {visibleTeams.map(team=><Card key={team.id} style={{gap:spacing.sm}}>
        <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,alignItems:"center"}}>
          <View style={{width:44,height:44,borderRadius:radius.md,backgroundColor:colors.primarySoft,
            alignItems:"center",justifyContent:"center"}}>
            <Ionicons name="shield-outline" size={23} color={colors.primary}/>
          </View>
          <View style={{flex:1}}>
            <AppText weight="bold">{team.name}</AppText>
            <AppText variant="caption" muted>{team.city}</AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={()=>beginEdit(team)}
            style={{padding:spacing.sm}}>
            <Ionicons name="create-outline" size={23} color={colors.primary}/>
          </Pressable>
        </View>
        <AppText variant="caption" muted>{t("manualTeams.offlineStatus")}</AppText>
        <Button variant="secondary" label={t("manualTeams.viewCompetitions")}
          onPress={()=>router.push("/owner/competitions")}/>
      </Card>)}
    </>}
  </Screen>;
}
