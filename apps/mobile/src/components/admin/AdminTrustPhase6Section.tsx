import {colors,spacing} from "@leaguekick/design-tokens";
import {useCallback,useEffect,useState} from "react";
import {ScrollView,View} from "react-native";
import {adminTrustApi,ApiRequestError,type AdminTrustRecord,type AdminSupportEvent,
  type AdminTrustDelivery} from "../../lib/api";
import {formatCompetitionDateTime} from "../../lib/date-time";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {TextField} from "../ui/TextField";
import {AdminPagination} from "./AdminPagination";
import {styles} from "./AdminStyles";

export type TrustSection="moderation"|"reports"|"support"|"announcements"|"deliveries";
const labels={
  en:{moderation:"Content moderation",reports:"User reports",support:"Support tickets",
    announcements:"Platform announcements",deliveries:"Notification delivery health",
    reason:"Reason for action (required)",note:"Internal note / reply",search:"Search content",
    kind:"Content type",status:"Status",all:"All",detail:"Details",open:"Open",
    return:"Back",refresh:"Refresh",noResults:"No matching records.",loading:"Loading records…",
    error:"Unable to load records.",warning:"Warnings require an audit reason and confirmation.",
    hidden:"Hide content",close:"Close promotion",warn:"Warn user",review:"Review",
    resolve:"Resolve",dismiss:"Dismiss",priority:"Priority",assignee:"Admin assignee ID (optional)",
    update:"Update ticket",reply:"Reply",history:"Ticket conversation and history",
    create:"Create announcement",title:"Announcement title",body:"Message",
    audience:"Audience",value:"Target user ID, role or city",when:"Scheduled at (ISO 8601 UTC)",
    now:"Use current time",cancel:"Cancel announcement",process:"Process due announcements",
    queued:"Queue failed push delivery",retryInfo:"Requeue only: sending requires a configured push worker. Do not treat PENDING as delivered.",
    delivery:"Recipients delivered",safety:"Sensitive information is visible only to platform administrators.",
  },
  "fa-AF":{moderation:"نظارت بر محتوا",reports:"گزارش‌های کاربران",support:"درخواست‌های پشتیبانی",
    announcements:"اعلان‌های سراسری",deliveries:"وضعیت تحویل اعلان‌ها",
    reason:"دلیل اقدام (ضروری)",note:"یادداشت داخلی / پاسخ",search:"جستجوی محتوا",
    kind:"نوع محتوا",status:"وضعیت",all:"همه",detail:"جزئیات",open:"بازکردن",
    return:"بازگشت",refresh:"تازه‌سازی",noResults:"موردی یافت نشد.",loading:"در حال بارگذاری…",
    error:"دریافت اطلاعات ناموفق بود.",warning:"اقدامات حساس نیاز به دلیل و تایید دارند.",
    hidden:"پنهان کردن محتوا",close:"بستن تخفیف",warn:"اخطار به کاربر",
    review:"در حال بررسی",resolve:"حل‌شده",dismiss:"رد گزارش",priority:"اولویت",
    assignee:"شناسه مدیر مسئول (اختیاری)",update:"به‌روزرسانی تکت",reply:"پاسخ",
    history:"پاسخ‌ها و تاریخچه تکت",create:"ایجاد اعلان",title:"عنوان اعلان",
    body:"پیام",audience:"مخاطبان",value:"شناسه کاربر، نقش یا شهر",
    when:"زمان نشر (ISO 8601 UTC)",now:"زمان فعلی",cancel:"لغو اعلان",
    process:"پردازش اعلان‌های سررسید",queued:"ارسال دوباره به صف",
    retryInfo:"فقط به صف برمی‌گردد؛ ارسال پوش به سرویس فعال نیاز دارد.",
    delivery:"دریافت‌کنندگان",safety:"این معلومات تنها به مدیران پلتفرم نمایش داده می‌شود.",
  },
  "ps-AF":{moderation:"د منځپانګې څارنه",reports:"د کاروونکو راپورونه",support:"د ملاتړ ټکټونه",
    announcements:"د پلیټفارم خبرتیاوې",deliveries:"د خبرتیاوو د لېږد حالت",
    reason:"د اقدام لامل (اړین)",note:"داخلي یادښت / ځواب",search:"د منځپانګې لټون",
    kind:"ډول",status:"حالت",all:"ټول",detail:"تفصیل",open:"خلاص کړئ",
    return:"بېرته",refresh:"تازه کول",noResults:"معلومات ونه موندل شول.",
    loading:"معلومات راځي…",error:"معلومات ترلاسه نه شول.",
    warning:"حساس اقدامات دلیل او تایید ته اړتیا لري.",hidden:"منځپانګه پټه کړئ",
    close:"تخفیف وتړئ",warn:"کاروونکي ته خبرداری",review:"تر څېړنې لاندې",
    resolve:"حل شوی",dismiss:"راپور رد کړئ",priority:"لومړیتوب",
    assignee:"د مدیر پېژند (اختیاري)",update:"ټکټ تازه کړئ",reply:"ځواب",
    history:"د ټکټ خبرې او تاریخچه",create:"خبرتیا جوړه کړئ",
    title:"د خبرتیا سرلیک",body:"پیغام",audience:"اورېدونکي",
    value:"د کاروونکي پېژند، رول یا ښار",when:"د لېږلو وخت (ISO 8601 UTC)",
    now:"اوسنی وخت",cancel:"خبرتیا لغوه کړئ",process:"وخت رسېدلې خبرتیاوې ولېږئ",
    queued:"بیا کتار ته واچوئ",
    retryInfo:"دا یوازې کتار ته ځي؛ د پوش لېږلو لپاره فعال سرویس اړین دی.",
    delivery:"رسېدلي کسان",safety:"حساس معلومات یوازې اډمین ته ښکاري.",
  },
};
const choices:Record<TrustSection,string[]>={
 moderation:["ALL","POST","COMMENT","PROMOTION"],
 reports:["ALL","USER","VENUE","POST","COMMENT","PROMOTION"],
 support:["ALL"],announcements:["ALL"],deliveries:["ALL","IN_APP","PUSH"],
};
const states:Record<TrustSection,string[]>={
 moderation:["ALL","PUBLISHED","UNPUBLISHED","HIDDEN","ACTIVE","CLOSED","EXPIRED"],
 reports:["ALL","OPEN","REVIEWING","RESOLVED","DISMISSED"],
 support:["ALL","OPEN","IN_PROGRESS","WAITING_FOR_USER","RESOLVED","CLOSED"],
 announcements:["ALL","SCHEDULED","SENDING","SENT","CANCELLED"],
 deliveries:["ALL","PENDING","FAILED","SENT","SKIPPED"],
};
function Select({value,options,onChange}:{value:string;options:string[];onChange:(v:string)=>void}){
 return <ScrollView horizontal showsHorizontalScrollIndicator={false}
   contentContainerStyle={{gap:spacing.sm,paddingVertical:spacing.xs}}>
  {options.map(s=><Button key={s} label={s.replaceAll("_"," ")}
    variant="secondary" disabled={value===s} onPress={()=>onChange(s)}/>)}
 </ScrollView>;
}
function SummaryRow({k,v}:{k:string;v:unknown}){
 return <View style={{flexGrow:1,flexBasis:180,gap:4}}>
   <AppText variant="caption" muted>{k}</AppText>
   <AppText weight="medium" selectable>{v===null||v===undefined||v===""?"—":String(v)}</AppText>
 </View>;
}
export function AdminTrustPhase6Section({mode,token,reason,setReason,busy,action,refreshVersion}:{
 mode:TrustSection;token:string;reason:string;setReason:(value:string)=>void;
 busy:boolean;action:(task:()=>Promise<unknown>,success:string,refresh?:boolean,target?:string)=>Promise<void>;
 refreshVersion:number;
}){
 const {language,isRTL}=useLocale();
 const l=labels[language]??labels.en;
 const [list,setList]=useState<AdminTrustRecord[]>([]);
 const [total,setTotal]=useState(0),[page,setPage]=useState(1);
 const [kind,setKind]=useState("ALL"),[status,setStatus]=useState("ALL");
 const [q,setQ]=useState(""),[search,setSearch]=useState("");
 const [selected,setSelected]=useState<AdminTrustRecord|null>(null);
 const [ticketEvents,setTicketEvents]=useState<AdminSupportEvent[]>([]);
 const [priority,setPriority]=useState("NORMAL"),[assignee,setAssignee]=useState("");
 const [ticketStatus,setTicketStatus]=useState("IN_PROGRESS");
 const [note,setNote]=useState("");
 const [title,setTitle]=useState(""),[body,setBody]=useState("");
 const [audience,setAudience]=useState("ALL"),[audienceValue,setAudienceValue]=useState("");
 const [scheduled,setScheduled]=useState(new Date(Date.now()+120000).toISOString());
 const [loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null);
 const [deliveryTotals,setDeliveryTotals]=useState<Array<{channel:string;status:string;total:number}>>([]);
 const [revision,setRevision]=useState(0);
 const fetchList=useCallback(()=>{
   setRevision(n=>n+1);
 },[]);
 useEffect(()=>{
   let active=true;const ctrl=new AbortController();
   setLoading(true);setError(null);
   void adminTrustApi.page(token,mode,{page,pageSize:25,
     ...(status!=="ALL"?{status}:{}),...(kind!=="ALL"&&mode!=="support"&&mode!=="announcements"?{kind}:{}),
     ...(q&&mode==="moderation"?{q}:{})},ctrl.signal)
     .then(data=>{
       if(!active)return;
       setList(data.items);setTotal(data.total);setDeliveryTotals(data.summary??[]);
     }).catch(e=>{
       if(active&&!ctrl.signal.aborted)setError(e instanceof ApiRequestError?e.message:l.error);
     }).finally(()=>{if(active)setLoading(false);});
   return()=>{active=false;ctrl.abort();};
 },[token,mode,page,status,kind,q,refreshVersion,revision]);
 useEffect(()=>{
   if(refreshVersion)setSelected(null);
 },[refreshVersion]);
 async function viewTicket(item:AdminTrustRecord){
   setError(null);
   try{
     const data=await adminTrustApi.ticket(token,item.id);
     setSelected(data.ticket);setTicketEvents(data.events);
     setPriority(data.ticket.priority??"NORMAL");setAssignee(data.ticket.assignedToUserId??"");
     setTicketStatus(data.ticket.status==="OPEN"?"IN_PROGRESS":data.ticket.status);
     setNote("");
   }catch(e){setError(e instanceof ApiRequestError?e.message:l.error);}
 }
 const trigger=(task:()=>Promise<unknown>,target:string)=>
   void action(task,l.update,true,target);
 const date=(raw:string|undefined)=>raw?formatCompetitionDateTime(raw,language):"—";
 const dir=isRTL?"row-reverse" as const:"row" as const;
 const required=reason.trim().length>=3&&!busy;
 return <View style={{gap:spacing.md}}>
   <Card style={styles.panel}>
     <View style={[styles.tableHeader,{flexDirection:dir}]}>
       <AppText weight="bold" variant="bodyLarge">{l[mode]}</AppText>
       <AppText variant="caption" muted>{total}</AppText>
     </View>
     <AppText muted>{l.safety}</AppText>
     {mode==="moderation"?<View style={styles.formGrid}>
       <TextField label={l.search} value={search} onChangeText={setSearch}
         containerStyle={styles.flexField} onSubmitEditing={()=>{setQ(search.trim());setPage(1);}}/>
       <Button label={l.search} variant="secondary"
         onPress={()=>{setQ(search.trim());setPage(1);}}/>
     </View>:null}
     {choices[mode].length>1?<><AppText weight="semibold">{l.kind}</AppText>
       <Select value={kind} options={choices[mode]} onChange={v=>{setKind(v);setPage(1);}}/></>:null}
     <AppText weight="semibold">{l.status}</AppText>
     <Select value={status} options={states[mode]} onChange={v=>{setStatus(v);setPage(1);}}/>
     <View style={[styles.rowActions,{flexDirection:dir}]}>
       <Button label={l.refresh} variant="secondary" onPress={fetchList}/>
       {selected?<Button label={l.return} variant="secondary" onPress={()=>setSelected(null)}/>:null}
     </View>
   </Card>
   {error?<Card style={styles.panel}><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
   {mode==="announcements"?<Card style={styles.panel}>
      <AppText weight="bold" variant="bodyLarge">{l.create}</AppText>
      <TextField label={l.title} value={title} onChangeText={setTitle} maxLength={160}/>
      <TextField label={l.body} value={body} onChangeText={setBody} multiline maxLength={500}/>
      <AppText weight="semibold">{l.audience}</AppText>
      <Select value={audience} options={["ALL","USER","ROLE","CITY"]}
        onChange={setAudience}/>
      {audience!=="ALL"?<TextField label={l.value} value={audienceValue}
        onChangeText={setAudienceValue} autoCapitalize="none"/>:null}
      <TextField label={l.when} value={scheduled} onChangeText={setScheduled}
        autoCapitalize="none" forceLtr/>
      <Button label={l.now} variant="secondary" onPress={()=>setScheduled(new Date().toISOString())}/>
      <Button label={l.create} disabled={busy||title.trim().length<3||body.trim().length<5||
        (audience!=="ALL"&&!audienceValue.trim())||!Number.isFinite(Date.parse(scheduled))}
        onPress={()=>trigger(()=>adminTrustApi.createAnnouncement(token,{
          title:title.trim(),body:body.trim(),audience,audienceValue:audience==="ALL"?null:audienceValue.trim(),
          scheduledAt:scheduled}),title)}/>
      <Button label={l.process} variant="secondary" disabled={busy}
        onPress={()=>void action(()=>adminTrustApi.processDue(token),l.refresh,false)}/>
      <AppText variant="caption" muted>{l.warning}</AppText>
   </Card>:null}
   {mode==="deliveries"?<Card style={styles.panel}>
      <AppText weight="bold">{l.deliveries}</AppText>
      <View style={{flexDirection:"row",flexWrap:"wrap",gap:spacing.md}}>
        {deliveryTotals.map(v=><SummaryRow key={v.channel+v.status}
          k={v.channel+" · "+v.status} v={v.total}/>)}
      </View>
      <AppText variant="caption" muted>{l.retryInfo}</AppText>
   </Card>:null}
   {selected&&mode==="support"?<Card style={styles.panel}>
     <AppText weight="bold" variant="bodyLarge">{selected.subject}</AppText>
     <AppText muted>{selected.description}</AppText>
     <View style={{flexDirection:"row",gap:spacing.md,flexWrap:"wrap"}}>
       <SummaryRow k={l.status} v={selected.status}/>
       <SummaryRow k={l.priority} v={selected.priority}/>
       <SummaryRow k="Requester" v={selected.requesterUserId}/>
     </View>
     <AppText weight="semibold">{l.history}</AppText>
     {ticketEvents.map(ev=><View key={ev.id} style={styles.dataRow}>
       <AppText weight="semibold">{ev.action} · {ev.actorUserId.slice(0,8)}</AppText>
       <AppText>{ev.note}</AppText>
       <AppText variant="caption" muted>{date(ev.createdAt)}</AppText>
     </View>)}
     {selected.status!=="CLOSED"?<>
       <AppText weight="semibold">{l.status}</AppText>
       <Select value={ticketStatus} options={states.support.slice(1)}
         onChange={setTicketStatus}/>
       <AppText weight="semibold">{l.priority}</AppText>
       <Select value={priority} options={["LOW","NORMAL","HIGH","URGENT"]}
         onChange={setPriority}/>
       <TextField label={l.assignee} value={assignee} onChangeText={setAssignee}
         autoCapitalize="none" forceLtr/>
       <TextField label={l.note} value={note} onChangeText={setNote} multiline/>
       <Button label={l.update} disabled={busy||note.trim().length<3}
         onPress={()=>trigger(()=>adminTrustApi.updateTicket(token,selected.id,{
           status:ticketStatus,priority,assignedToUserId:assignee.trim()||null,note:note.trim()}),
           selected.subject+" · "+ticketStatus)}/>
       <Button label={l.reply} variant="secondary" disabled={busy||note.trim().length<3}
         onPress={()=>trigger(()=>adminTrustApi.ticketReply(token,selected.id,note.trim()),
           selected.subject+" · "+l.reply)}/>
     </>:null}
   </Card>:null}
   <Card style={styles.panel}>
     {loading?<AppText muted>{l.loading}</AppText>:list.length===0?
       <AppText muted>{l.noResults}</AppText>:list.map(item=>{
       const delivery=item as unknown as AdminTrustDelivery;
       const recordKind=mode==="moderation"?item.kind:mode==="reports"?item.targetType:
         mode==="deliveries"?delivery.channel:mode==="announcements"?item.audience:item.category;
       return <View key={item.id??delivery.notificationId} style={[styles.dataRow,{flexDirection:dir}]}>
         <View style={{flex:1,minWidth:230,gap:spacing.xs}}>
           <AppText weight="bold">{item.title??item.subject??item.author??recordKind??"Item"}</AppText>
           <AppText variant="caption" muted>{recordKind} · {item.status}</AppText>
           {item.body||item.description?<AppText numberOfLines={3}>{item.body??item.description}</AppText>:null}
           {item.imageUrl?<AppText variant="caption" muted forceLtr numberOfLines={1}>{item.imageUrl}</AppText>:null}
           <AppText variant="caption" muted>{date(item.createdAt)}</AppText>
           {mode==="announcements"?<AppText variant="caption" muted>{l.delivery}: {item.deliveredRecipients??0}/{item.totalRecipients??0} · {date(item.scheduledAt)}</AppText>:null}
           {mode==="deliveries"?<AppText variant="caption" muted>{delivery.attempts} attempts · {delivery.error??""}</AppText>:null}
         </View>
         <View style={{gap:spacing.xs,flexDirection:"row",flexWrap:"wrap"}}>
           {mode==="moderation"&&item.kind&&item.status==="PUBLISHED"?
             <Button variant="danger" disabled={!required} label={l.hidden}
               onPress={()=>trigger(()=>adminTrustApi.moderate(token,item.kind!,item.id,
                 "HIDE",reason),item.body??item.id)}/>:null}
           {mode==="moderation"&&item.kind==="PROMOTION"&&item.status==="ACTIVE"?
             <Button variant="danger" disabled={!required} label={l.close}
               onPress={()=>trigger(()=>adminTrustApi.moderate(token,item.kind!,item.id,
                 "CLOSE",reason),item.body??item.id)}/>:null}
           {mode==="moderation"&&item.authorUserId?
             <Button variant="secondary" disabled={!required} label={l.warn}
               onPress={()=>trigger(()=>adminTrustApi.moderate(token,"USER",item.authorUserId!,
                 "WARN",reason),item.author??item.authorUserId!)}/>:null}
           {mode==="reports"&&item.status==="OPEN"?
             <Button variant="secondary" disabled={busy||note.trim().length<3} label={l.review}
               onPress={()=>trigger(()=>adminTrustApi.reviewReport(token,item.id,"REVIEWING",note),
                 item.targetType+" · "+item.targetId)}/>:null}
           {mode==="reports"&&["OPEN","REVIEWING"].includes(item.status)?
             <><Button variant="secondary" disabled={busy||note.trim().length<3} label={l.resolve}
               onPress={()=>trigger(()=>adminTrustApi.reviewReport(token,item.id,"RESOLVED",note),
                 item.targetType+" · "+item.targetId)}/>
             <Button variant="danger" disabled={busy||note.trim().length<3} label={l.dismiss}
               onPress={()=>trigger(()=>adminTrustApi.reviewReport(token,item.id,"DISMISSED",note),
                 item.targetType+" · "+item.targetId)}/></>:null}
           {mode==="support"?<Button variant="secondary" label={l.open} onPress={()=>void viewTicket(item)}/>:null}
           {mode==="announcements"&&item.status==="SCHEDULED"?
             <Button variant="danger" label={l.cancel} disabled={!required}
               onPress={()=>trigger(()=>adminTrustApi.cancelAnnouncement(token,item.id,reason),item.title??item.id)}/>:null}
           {mode==="deliveries"&&delivery.channel==="PUSH"&&delivery.status==="FAILED"&&delivery.attempts<3?
             <Button variant="secondary" disabled={!required} label={l.queued}
               onPress={()=>trigger(()=>adminTrustApi.requeue(token,delivery.notificationId,reason),
                 delivery.notificationId)}/>:null}
         </View>
       </View>;
     })}
     <AdminPagination page={page} total={total} pageSize={25} onPage={setPage} loading={loading}/>
   </Card>
   {mode==="moderation"||mode==="announcements"||mode==="deliveries"?
     <Card style={styles.panel}><TextField label={l.reason} value={reason} onChangeText={setReason}/>
       <AppText muted variant="caption">{l.warning}</AppText></Card>:null}
   {mode==="reports"?<Card style={styles.panel}>
     <TextField label={l.note} value={note} onChangeText={setNote} multiline/>
   </Card>:null}
 </View>;
}
