import { colors, spacing } from "@leaguekick/design-tokens";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { ApiRequestError, systemApi } from "../../src/lib/api";
import { APP_VERSION } from "../../src/lib/release";
import { AppText } from "../../src/components/ui/AppText";
import { Button } from "../../src/components/ui/Button";
import { Card } from "../../src/components/ui/Card";
import { DataLoadingState } from "../../src/components/ui/DataLoadingState";
import { Screen } from "../../src/components/ui/Screen";
import { useAuth } from "../../src/providers/AuthProvider";
import { useLocale } from "../../src/providers/LocaleProvider";
import { useNetwork } from "../../src/providers/NetworkProvider";

type ApiState = "checking" | "online" | "unavailable";

export default function SupportScreen(){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const {isOnline,hasResolved}=useNetwork();
  const [apiState,setApiState]=useState<ApiState>("checking");
  const [requestId,setRequestId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const supportEmail=(process.env.EXPO_PUBLIC_SUPPORT_EMAIL??"").trim();

  const check=useCallback(async()=>{
    setBusy(true);
    setApiState("checking");
    setRequestId(null);
    try{
      await systemApi.health();
      setApiState("online");
    }catch(error){
      setApiState("unavailable");
      if(error instanceof ApiRequestError) setRequestId(error.requestId);
    }finally{
      setBusy(false);
    }
  },[]);

  useEffect(()=>{void check();},[check]);

  const connection=!hasResolved?t("settings.connectionChecking"):isOnline?t("settings.connectionOnline"):t("settings.connectionOffline");
  const apiLabel=apiState==="online"?t("support.apiOnline"):t("support.apiUnavailable");

  if(busy)return <Screen showHeader><DataLoadingState variant="detail" minHeight={460}/></Screen>;

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("support.title")}</AppText>
      <AppText muted>{t("support.subtitle")}</AppText>
    </View>

    <Card>
      <DiagnosticRow label={t("support.appVersion")} value={APP_VERSION} rtl={isRTL} ltr/>
      <DiagnosticRow label={t("support.connection")} value={connection} rtl={isRTL}/>
      <DiagnosticRow label={t("support.apiStatus")} value={apiLabel} rtl={isRTL}/>
      <DiagnosticRow label={t("support.apiHost")} value={systemApi.apiHost} rtl={isRTL} ltr/>
      {session?.user.id?<DiagnosticRow label={t("support.accountSupportId")} value={session.user.id} rtl={isRTL} ltr/>:null}
      {requestId?<DiagnosticRow label={t("support.requestId")} value={requestId} rtl={isRTL} ltr/>:null}
    </Card>

    <Button label={t("support.refresh")} onPress={()=>void check()} loading={busy}/>

    <Card>
      <AppText weight="semibold">{t("support.contact")}</AppText>
      <AppText selectable forceLtr={Boolean(supportEmail)} style={supportEmail?undefined:{color:colors.textMuted}}>
        {supportEmail||t("support.contactUnavailable")}
      </AppText>
    </Card>
  </Screen>;
}

function DiagnosticRow({label,value,rtl,ltr=false}:{label:string;value:string;rtl:boolean;ltr?:boolean}){
  return <View style={{gap:2,paddingVertical:spacing.sm}}>
    <AppText variant="caption" muted>{label}</AppText>
    <AppText selectable weight="semibold" forceLtr={ltr} style={{textAlign:rtl&&!ltr?"right":"left"}}>{value}</AppText>
  </View>;
}
