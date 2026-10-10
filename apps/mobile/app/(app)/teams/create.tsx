import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { TeamPrivacy } from "@leaguekick/contracts";
import { Redirect, router, useFocusEffect } from "expo-router";
import {useCallback,useState} from "react";
import { Pressable, View } from "react-native";
import {ApiRequestError,teamApi,type TeamCapacity} from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function CreateTeamScreen(){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const [name,setName]=useState("");
  const [city,setCity]=useState("");
  const [logoUrl,setLogoUrl]=useState("");
  const [privacy,setPrivacy]=useState<TeamPrivacy>("PUBLIC");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [capacity,setCapacity]=useState<TeamCapacity|null>(null);
  const [loadingCapacity,setLoadingCapacity]=useState(true);
  const [paymentRef,setPaymentRef]=useState("");
  const [reload,setReload]=useState(0);
  useFocusEffect(useCallback(()=>{
    let active=true;
    if(!session?.accessToken){setLoadingCapacity(false);return ()=>{active=false;};}
    setLoadingCapacity(true);
    void teamApi.capacity(session.accessToken).then(result=>{
      if(active){setCapacity(result);setError(null);}
    }).catch(e=>{if(active)setError(e instanceof ApiRequestError?e.message:t("tmBilling.loadError"));})
      .finally(()=>{if(active)setLoadingCapacity(false);});
    return ()=>{active=false;};
  },[session?.accessToken,reload,t]));
  async function requestSlot(slotId?:string){
    if(!session||busy)return;
    setBusy(true);setError(null);
    try{
      await teamApi.requestSlot(session.accessToken,paymentRef.trim(),slotId);
      setReload(x=>x+1);
    }catch(e){setError(e instanceof ApiRequestError?e.message:t("tmBilling.requestError"));}
    finally{setBusy(false);}
  }


  if(!session?.user.roles.includes("TEAM_MANAGER")){
    return <Redirect href="/role-subscriptions/team-owner"/>;
  }

  async function submit(){
    if(!session||!capacity?.canCreate||name.trim().length<2||city.trim().length<2)return;
    setBusy(true);setError(null);
    try{
      await teamApi.create(session.accessToken,{name:name.trim(),city:city.trim(),logoUrl,privacy});
      router.replace("/dashboard");
    }catch(cause){
      setError(cause instanceof ApiRequestError?cause.message:t("teams.createError"));
    }finally{setBusy(false);}
  }

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("teams.createTitle")}</AppText>
      <AppText muted>{t("teams.createSubtitle")}</AppText>
    </View>

    {loadingCapacity?<DataLoadingState variant="dashboard" minHeight={230}/>:capacity&&!capacity.canCreate?<>
      <Card>
        <AppText variant="bodyLarge" weight="bold">{t("tmBilling.additionalTitle")}</AppText>
        <AppText muted>{capacity.baseActive?t("tmBilling.extraRequired"):t("tmBilling.baseRequired")}</AppText>
        <AppText weight="semibold">{t("tmBilling.price")}: {capacity.monthlyPriceAfn} AFN/{t("roles.month")}</AppText>
        <TextField label={t("roles.paymentReference")} value={paymentRef} onChangeText={setPaymentRef}/>
        {capacity.baseActive?<Button label={t("tmBilling.requestExtra")}
          disabled={busy} loading={busy} onPress={()=>void requestSlot()}/>:
          <Button label={t("tm1.manageSubscription")} variant="secondary"
            onPress={()=>router.push("/role-subscriptions/team-owner")}/>}
        {capacity.slots.filter(x=>!x.teamId).map(slot=><AppText key={slot.id} variant="caption" muted>
          {t("tmBilling.status")}: {slot.status} · {slot.activeUntil??t("tmBilling.awaiting")}
        </AppText>)}
        <AppText muted>{t("tmBilling.approvalHint")}</AppText>
      </Card>
      {capacity.slots.filter(x=>x.teamId&&x.status==="EXPIRED").map(slot=><Card key={slot.id}>
        <AppText weight="bold">{slot.teamName??t("tmBilling.additionalTitle")}</AppText>
        <Button variant="secondary" label={t("tmBilling.renew")} disabled={busy}
          onPress={()=>void requestSlot(slot.id)}/>
      </Card>)}
      <Button label={t("owner.back")} onPress={()=>router.back()} variant="secondary"/>
    </>:capacity?<>{/* A signed-in manager may create only when the backend confirms paid capacity. */}
    <TextField label={t("teams.name")} value={name} onChangeText={setName} placeholder={t("teams.name")}/>
    <TextField label={t("teams.city")} value={city} onChangeText={setCity} placeholder={t("teams.city")}/>
    <TextField label={t("teams.logoUrl")} value={logoUrl} onChangeText={setLogoUrl} autoCapitalize="none" forceLtr placeholder="https://..."/>

    <Card>
      <AppText weight="semibold">{t("teams.privacy")}</AppText>
      <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
        {(["PUBLIC","PRIVATE"] as const).map((value)=><Pressable
          key={value}
          onPress={()=>setPrivacy(value)}
          style={{
            flex:1,
            padding:spacing.md,
            borderRadius:radius.md,
            borderWidth:1,
            borderColor:privacy===value?colors.primary:colors.border,
            backgroundColor:privacy===value?colors.primarySoft:colors.surface,
          }}
        >
          <AppText weight="semibold" style={privacy===value?{color:colors.primary}:undefined}>{t(`teams.privacy.${value}` as never)}</AppText>
          <AppText variant="caption" muted>{t(value==="PUBLIC"?"teams.privacyPublicBody":"teams.privacyPrivateBody")}</AppText>
        </Pressable>)}
      </View>
    </Card>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    <Button label={t("teams.createAction")} onPress={()=>void submit()} loading={busy}
      disabled={!capacity?.canCreate||name.trim().length<2||city.trim().length<2}/>
    <Button label={t("owner.back")} onPress={()=>router.back()} variant="secondary"/>
    </>:null}
  </Screen>;
}
