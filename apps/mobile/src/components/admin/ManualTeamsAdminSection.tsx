import {colors,spacing} from "@leaguekick/design-tokens";
import type {AdminManualTeamDto} from "@leaguekick/contracts";
import {useCallback,useEffect,useState} from "react";
import {View} from "react-native";
import {adminApi,ApiRequestError} from "../../lib/api";
import {useAuth} from "../../providers/AuthProvider";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";
import {TextField} from "../ui/TextField";

export function ManualTeamsAdminSection(){
  const {session}=useAuth();
  const {t}=useLocale();
  const [items,setItems]=useState<AdminManualTeamDto[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [username,setUsername]=useState("");
  const [phone,setPhone]=useState("");
  const [confirming,setConfirming]=useState(false);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const load=useCallback(async()=>{
    if(!session)return;
    setLoading(true);
    try{setItems((await adminApi.manualTeams(session.accessToken)).teams);setError(null);}
    catch(e){setError(e instanceof ApiRequestError?e.message:t("manualTeams.loadError"));}
    finally{setLoading(false);}
  },[session?.accessToken,t]);
  useEffect(()=>{void load();},[load]);

  async function assign(){
    if(!session||!selected||!username.trim()||!phone.trim())return;
    setBusy(true);setError(null);setMessage(null);
    try{
      await adminApi.assignManualTeam(session.accessToken,selected,{
        username:username.trim(),phone:phone.trim(),
      });
      setSelected(null);setUsername("");setPhone("");setConfirming(false);
      await load();
      setMessage(t("manualTeams.claimSuccess"));
    }catch(e){setError(e instanceof ApiRequestError?e.message:t("manualTeams.claimError"));}
    finally{setBusy(false);}
  }
  const team=items.find(item=>item.id===selected);
  return <View style={{gap:spacing.md}}>
    <AppText variant="bodyLarge" weight="bold">{t("manualTeams.adminTitle")}</AppText>
    <AppText muted>{t("manualTeams.adminHint")}</AppText>
    {message?<Card><AppText style={{color:colors.success}}>{message}</AppText></Card>:null}
    {error?<Card style={{gap:spacing.sm}}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button variant="secondary" label={t("common.retry")} onPress={()=>void load()}/>
    </Card>:null}
    {loading?<DataLoadingState variant="list" minHeight={240}/>:null}
    {!loading&&items.length===0?<Card><AppText muted>{t("manualTeams.nonePending")}</AppText></Card>:null}
    {!loading&&items.map(item=><Card key={item.id} style={{gap:spacing.sm}}>
      <AppText weight="bold">{item.name}</AppText>
      <AppText variant="caption" muted>{item.city} · {item.venueName}</AppText>
      <AppText variant="caption" muted forceLtr>{item.id}</AppText>
      <Button label={t("manualTeams.assign")} variant="secondary" onPress={()=>{
        setSelected(item.id);setConfirming(false);setError(null);setMessage(null);
      }}/>
    </Card>)}
    {team?<Card style={{gap:spacing.md}}>
      <AppText weight="bold">{t("manualTeams.assign")}: {team.name}</AppText>
      <TextField label={t("manualTeams.username")} value={username} onChangeText={text=>{setUsername(text);setConfirming(false);}}
        autoCapitalize="none" forceLtr maxLength={12}/>
      <TextField label={t("manualTeams.phone")} value={phone} onChangeText={text=>{setPhone(text);setConfirming(false);}}
        forceLtr keyboardType="phone-pad" maxLength={20}/>
      <AppText muted>{t("manualTeams.claimRules")}</AppText>
      {confirming?<View style={{gap:spacing.sm}}>
        <AppText weight="semibold">{t("manualTeams.claimConfirm")}: {team.name} → @{username.trim()} ({phone.trim()})</AppText>
        <Button label={t("manualTeams.claimConfirmAction")} loading={busy} onPress={()=>void assign()}/>
      </View>:<Button label={t("manualTeams.assign")} disabled={!username.trim()||!phone.trim()} onPress={()=>setConfirming(true)}/>}
      <Button variant="secondary" label={t("common.cancel")} onPress={()=>{setSelected(null);setConfirming(false);}}/>
    </Card>:null}
  </View>;
}
