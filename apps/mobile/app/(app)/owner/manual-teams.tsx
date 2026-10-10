import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { ManualTeamDto } from "@leaguekick/contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
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
  const [teams,setTeams]=useState<ManualTeamDto[]>([]);
  const [name,setName]=useState("");
  const [city,setCity]=useState("");
  const [editingId,setEditingId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const load=useCallback(async()=>{
    if(!session){setLoading(false);return;}
    setLoading(true);
    try {setTeams((await manualTeamApi.mine(session.accessToken)).teams);setError(null);}
    catch {setError(t("manualTeams.loadError"));}
    finally {setLoading(false);}
  },[session?.accessToken,t]);
  useFocusEffect(useCallback(()=>{void load();},[load]));

  function beginEdit(team:ManualTeamDto){
    setEditingId(team.id);setName(team.name);setCity(team.city);setMessage(null);setError(null);
  }
  function reset(){
    setEditingId(null);setName("");setCity("");
  }
  async function save(){
    if(!session||busy||name.trim().length<2||city.trim().length<2)return;
    setBusy(true);setError(null);setMessage(null);
    try {
      if(editingId){
        await manualTeamApi.update(session.accessToken,editingId,{name:name.trim(),city:city.trim()});
      }else{
        await manualTeamApi.create(session.accessToken,{name:name.trim(),city:city.trim()});
      }
      reset();
      await load();
      setMessage(t("manualTeams.saved"));
    }catch(e){
      setError(e instanceof ApiRequestError?e.message:t("manualTeams.saveError"));
    }finally{setBusy(false);}
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
      <AppText weight="bold" variant="bodyLarge">{t("manualTeams.savedTeams")} ({teams.length})</AppText>
      {teams.length===0?<Card><AppText muted>{t("manualTeams.empty")}</AppText></Card>:null}
      {teams.map(team=><Card key={team.id} style={{gap:spacing.sm}}>
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
