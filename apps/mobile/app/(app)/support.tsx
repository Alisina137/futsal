import { colors, spacing } from "@leaguekick/design-tokens";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { ApiRequestError, systemApi, trustApi, type AdminTrustRecord, type AdminSupportEvent } from "../../src/lib/api";
import { APP_VERSION } from "../../src/lib/release";
import { AppText } from "../../src/components/ui/AppText";
import {TextField} from "../../src/components/ui/TextField";
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
  const {t,isRTL,language}=useLocale();
  const {isOnline,hasResolved}=useNetwork();
  const [apiState,setApiState]=useState<ApiState>("checking");
  const [requestId,setRequestId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [tickets,setTickets]=useState<AdminTrustRecord[]>([]);
  const [ticket,setTicket]=useState<AdminTrustRecord|null>(null);
  const [events,setEvents]=useState<AdminSupportEvent[]>([]);
  const [subject,setSubject]=useState(""),[description,setDescription]=useState("");
  const [category,setCategory]=useState("TECHNICAL"),[reply,setReply]=useState("");
  const [targetType,setTargetType]=useState("USER"),[targetId,setTargetId]=useState("");
  const [reportCategory,setReportCategory]=useState("OTHER"),[reportText,setReportText]=useState("");
  const [working,setWorking]=useState(false),[feedback,setFeedback]=useState("");
  const strings={
    en:{create:"Create support ticket",subject:"Subject",description:"Describe the issue",
      category:"Category",send:"Submit ticket",my:"My support tickets",open:"View",
      answer:"Reply",history:"Conversation",report:"Report abuse or suspicious activity",
      target:"Reported item ID",type:"Reported item type",details:"Explain the report",
      submit:"Submit report",done:"Submitted.",refresh:"Refresh tickets"},
    "fa-AF":{create:"ایجاد درخواست پشتیبانی",subject:"عنوان",description:"مشکل را شرح دهید",
      category:"دسته‌بندی",send:"ثبت درخواست",my:"درخواست‌های من",open:"مشاهده",
      answer:"پاسخ",history:"گفتگو",report:"گزارش تخلف یا فعالیت مشکوک",
      target:"شناسه مورد گزارش",type:"نوع مورد",details:"شرح گزارش",
      submit:"ثبت گزارش",done:"ثبت شد.",refresh:"تازه‌سازی درخواست‌ها"},
    "ps-AF":{create:"د ملاتړ ټکټ جوړ کړئ",subject:"سرلیک",description:"ستونزه تشریح کړئ",
      category:"ډول",send:"ټکټ ولېږئ",my:"زما ټکټونه",open:"وګورئ",
      answer:"ځواب",history:"خبرې",report:"د سرغړونې یا شکمن فعالیت راپور",
      target:"د راپور توکي پېژند",type:"د راپور ډول",details:"راپور تشریح کړئ",
      submit:"راپور ولېږئ",done:"ثبت شو.",refresh:"ټکټونه تازه کړئ"},
  }[language];
  const loadTickets=useCallback(async()=>{
    if(!session?.accessToken)return;
    try{setTickets((await trustApi.myTickets(session.accessToken)).items);}
    catch(e){setFeedback(e instanceof ApiRequestError?e.message:t("support.apiUnavailable"));}
  },[session?.accessToken,t]);
  useEffect(()=>{void loadTickets();},[loadTickets]);
  async function createTicket(){
    if(!session?.accessToken||working)return;
    setWorking(true);setFeedback("");
    try{
      await trustApi.createTicket(session.accessToken,{category,subject:subject.trim(),
        description:description.trim()});
      setSubject("");setDescription("");setFeedback(strings.done);await loadTickets();
    }catch(e){setFeedback(e instanceof ApiRequestError?e.message:strings.description);}
    finally{setWorking(false);}
  }
  async function createReport(){
    if(!session?.accessToken||working)return;
    setWorking(true);setFeedback("");
    try{
      await trustApi.report(session.accessToken,{targetType,targetId:targetId.trim(),
        category:reportCategory,description:reportText.trim()});
      setTargetId("");setReportText("");setFeedback(strings.done);
    }catch(e){setFeedback(e instanceof ApiRequestError?e.message:strings.details);}
    finally{setWorking(false);}
  }
  async function viewTicket(id:string){
    if(!session?.accessToken)return;
    try{
      const value=await trustApi.myTicket(session.accessToken,id);
      setTicket(value.ticket);setEvents(value.events);
    }catch(e){setFeedback(e instanceof ApiRequestError?e.message:strings.history);}
  }
  async function replyToTicket(){
    if(!session?.accessToken||!ticket||reply.trim().length<3||working)return;
    setWorking(true);
    try{
      await trustApi.reply(session.accessToken,ticket.id,reply.trim());setReply("");
      await viewTicket(ticket.id);await loadTickets();
    }catch(e){setFeedback(e instanceof ApiRequestError?e.message:strings.answer);}
    finally{setWorking(false);}
  }
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

    {session?.accessToken?<Card style={{gap:spacing.md}}>
      <AppText variant="bodyLarge" weight="bold">{strings.create}</AppText>
      <AppText weight="semibold">{strings.category}</AppText>
      <View style={{flexDirection:"row",gap:spacing.sm,flexWrap:"wrap"}}>
        {["TECHNICAL","BOOKINGS","PAYMENTS","ACCOUNT","SAFETY","OTHER"].map(v=>
          <Button key={v} label={v} variant="secondary" disabled={category===v} onPress={()=>setCategory(v)}/>)}
      </View>
      <TextField label={strings.subject} value={subject} onChangeText={setSubject}/>
      <TextField label={strings.description} value={description} onChangeText={setDescription} multiline/>
      <Button label={strings.send} loading={working} disabled={subject.trim().length<5||description.trim().length<10}
        onPress={()=>void createTicket()}/>
    </Card>:null}
    {session?.accessToken?<Card style={{gap:spacing.md}}>
      <AppText variant="bodyLarge" weight="bold">{strings.my}</AppText>
      <Button label={strings.refresh} variant="secondary" onPress={()=>void loadTickets()}/>
      {tickets.map(item=><View key={item.id} style={{gap:spacing.xs}}>
        <AppText weight="bold">{item.subject} · {item.status}</AppText>
        <Button label={strings.open} variant="secondary" onPress={()=>void viewTicket(item.id)}/>
      </View>)}
      {ticket?<View style={{gap:spacing.sm,borderTopWidth:1,borderColor:colors.border,paddingTop:spacing.md}}>
        <AppText weight="semibold">{ticket.subject} · {ticket.status}</AppText>
        <AppText>{ticket.description}</AppText>
        <AppText weight="semibold">{strings.history}</AppText>
        {events.map(ev=><View key={ev.id} style={{gap:2}}>
          <AppText variant="caption" muted>{ev.action} · {ev.createdAt.slice(0,16).replace("T"," ")}</AppText>
          <AppText>{ev.note}</AppText>
        </View>)}
        {ticket.status!=="CLOSED"?<>
          <TextField label={strings.answer} value={reply} onChangeText={setReply} multiline/>
          <Button label={strings.answer} loading={working} disabled={reply.trim().length<3}
            onPress={()=>void replyToTicket()}/>
        </>:null}
      </View>:null}
    </Card>:null}
    {session?.accessToken?<Card style={{gap:spacing.md}}>
      <AppText variant="bodyLarge" weight="bold">{strings.report}</AppText>
      <AppText weight="semibold">{strings.type}</AppText>
      <View style={{flexDirection:"row",gap:spacing.sm,flexWrap:"wrap"}}>
        {["USER","VENUE","POST","COMMENT","PROMOTION"].map(v=>
          <Button key={v} label={v} variant="secondary" disabled={targetType===v}
            onPress={()=>setTargetType(v)}/>)}
      </View>
      <TextField label={strings.target} value={targetId} onChangeText={setTargetId} forceLtr autoCapitalize="none"/>
      <View style={{flexDirection:"row",gap:spacing.sm,flexWrap:"wrap"}}>
        {["INAPPROPRIATE_CONTENT","HARASSMENT","SPAM","FRAUD","FAKE_VENUE","OTHER"].map(v=>
          <Button key={v} label={v.replaceAll("_"," ")} variant="secondary"
            disabled={reportCategory===v} onPress={()=>setReportCategory(v)}/>)}
      </View>
      <TextField label={strings.details} value={reportText} onChangeText={setReportText} multiline/>
      <Button label={strings.submit} loading={working}
        disabled={targetId.trim().length!==36||reportText.trim().length<10}
        onPress={()=>void createReport()}/>
    </Card>:null}
    {feedback?<Card><AppText>{feedback}</AppText></Card>:null}
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
