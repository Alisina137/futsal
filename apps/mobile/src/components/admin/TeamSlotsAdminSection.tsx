import {colors,spacing} from "@leaguekick/design-tokens";
import {useCallback,useEffect,useState} from "react";
import {View} from "react-native";
import {adminApi,ApiRequestError,type TeamExtraSlot} from "../../lib/api";
import {formatCompetitionDateTime} from "../../lib/date-time";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {TextField} from "../ui/TextField";
export function TeamSlotsAdminSection({token}:{token:string}){
  const {t,language}=useLocale();
  const [slots,setSlots]=useState<TeamExtraSlot[]>([]);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState<string|null>(null);
  const [months,setMonths]=useState("1");
  const [paymentRef,setPaymentRef]=useState("");
  const [refresh,setRefresh]=useState(0);
  const load=useCallback(async()=>{
    try{setSlots((await adminApi.teamSlots(token)).slots);setError(null);}
    catch(e){setError(e instanceof ApiRequestError?e.message:t("tmBilling.loadError"));}
  },[token,t]);
  useEffect(()=>{void load();},[load,refresh]);
  async function activate(slot:TeamExtraSlot){
    if(busy)return;
    const count=Number(months);
    if(!Number.isInteger(count)||count<1||count>24){
      setError(t("tmBilling.invalidMonths"));return;
    }
    const ref=paymentRef.trim()||slot.paymentReference?.trim()||"";
    if(!ref){setError(t("tmBilling.paymentRequired"));return;}
    setBusy(slot.id);setError(null);
    try{await adminApi.activateTeamSlot(token,slot.id,count,ref);
      setRefresh(v=>v+1);}
    catch(e){setError(e instanceof ApiRequestError?e.message:t("tmBilling.requestError"));}
    finally{setBusy(null);}
  }
  return <Card style={{gap:spacing.md}}>
    <AppText variant="bodyLarge" weight="bold">{t("tmBilling.adminTitle")}</AppText>
    <AppText muted>{t("tmBilling.adminHint")}</AppText>
    <TextField label={t("phase7.admin.months")} value={months} keyboardType="number-pad" onChangeText={setMonths}/>
    <TextField label={t("roles.paymentReference")} value={paymentRef} onChangeText={setPaymentRef}/>
    <Button label={t("common.retry")} variant="secondary" onPress={()=>setRefresh(v=>v+1)}/>
    {error?<AppText style={{color:colors.danger}}>{error}</AppText>:null}
    {slots.length===0?<AppText muted>{t("tmBilling.noRequests")}</AppText>:null}
    {slots.map(slot=><View key={slot.id} style={{gap:spacing.xs,paddingVertical:spacing.md,
      borderTopWidth:1,borderColor:colors.border}}>
      <AppText weight="bold">{slot.displayName??slot.username??slot.userId}</AppText>
      <AppText variant="caption" muted>{slot.teamName??t("tmBilling.newTeamSlot")}</AppText>
      <AppText variant="caption" muted>{t("tmBilling.status")}: {slot.status}</AppText>
      <AppText variant="caption" muted>{slot.monthlyPriceAfn} AFN/{t("roles.month")}</AppText>
      <AppText variant="caption" muted>{t("tm1.expires")}: {slot.activeUntil?
        formatCompetitionDateTime(slot.activeUntil,language):t("tmBilling.awaiting")}</AppText>
      {slot.paymentReference?<AppText variant="caption" muted forceLtr>{slot.paymentReference}</AppText>:null}
      {slot.status==="PENDING"?<Button label={t("roles.confirmPaymentActivate")}
        disabled={busy!==null} loading={busy===slot.id} onPress={()=>void activate(slot)}/>:null}
    </View>)}
  </Card>;
}
