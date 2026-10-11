import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,spacing,radius} from "@leaguekick/design-tokens";
import type {AdminBillingFilters,AdminBillingReceipt,AdminBillingSummary} from "@leaguekick/contracts";
import {useEffect,useState} from "react";
import {Pressable,ScrollView,View} from "react-native";
import {adminApi,ApiRequestError} from "../../lib/api";
import {useLocale} from "../../providers/LocaleProvider";
import {formatCompetitionDateTime} from "../../lib/date-time";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {TextField} from "../ui/TextField";
import {AdminPagination} from "./AdminPagination";
import {styles} from "./AdminStyles";

type Kind="ALL"|"VENUE"|"PAID_ROLE"|"EXTRA_TEAM";
type Status="ALL"|"RECORDED"|"VOIDED";
const kinds:Kind[]=["ALL","VENUE","PAID_ROLE","EXTRA_TEAM"];
const statuses:Status[]=["ALL","RECORDED","VOIDED"];
const labels={
 en:{heading:"Financial overview",scope:"Manual receipts entered by an administrator; not verified bank deposits or booking revenue.",
   history:"All historical venue receipts are included. Role and additional-team receipts are recorded from Phase 5 onward; earlier activations are not counted as received funds.",
   total:"Recorded receipts (AFN)",voided:"Voided receipts (AFN)",venue:"Venue",role:"Paid role",
   extra:"Additional team",pendingRoles:"Pending role approvals",pendingExtra:"Pending team slots",
   expiringVenue:"Venues expiring in 7 days",expiringRole:"Paid roles expiring in 7 days",
   expiringExtra:"Extra team slots expiring in 7 days",receipts:"Payment records",
   search:"Search account or payment reference",from:"From (YYYY-MM-DD)",to:"To (YYYY-MM-DD)",
   apply:"Apply filters",reset:"Reset",state:"Status",kind:"Type",all:"All",
   recorded:"Recorded",refresh:"Reload",empty:"No matching receipts.",reference:"Reference",
   period:"Subscription term",void:"Void receipt",reason:"Reason (required)",
   caution:"Voiding a receipt does not automatically cancel paid access. Review the linked subscription independently.",
   amount:"Amount",date:"Recorded on",summary:"Totals follow the selected date period, regardless of status or type filters.",
   rangeError:"Choose a valid date range with From no later than To.",loadError:"Could not load billing data.",
   support:"Always confirm the actual payment outside this system before activating a subscription.",
 },
 "fa-AF":{heading:"گزارش مالی",scope:"رسیدهای دستی ثبت‌شده توسط مدیریت؛ نه واریز تأییدشده بانک و نه درآمد رزروها.",
   history:"رسیدهای سالن از گذشته موجودند؛ رسیدهای نقش‌ها و تیم‌های اضافی از فاز پنجم ثبت می‌شوند و پرداخت‌های گذشته بدون سند محاسبه نمی‌شوند.",
   total:"رسیدهای ثبت‌شده (افغانی)",voided:"رسیدهای باطل‌شده (افغانی)",venue:"سالن",role:"نقش پولی",
   extra:"تیم اضافی",pendingRoles:"نقش‌های در انتظار پرداخت",pendingExtra:"تیم‌های در انتظار",
   expiringVenue:"سالن‌های رو به انقضا در ۷ روز",expiringRole:"نقش‌های رو به انقضا در ۷ روز",
   expiringExtra:"اشتراک تیم اضافی رو به انقضا",receipts:"رسیدهای پرداخت",
   search:"جستجوی حساب یا شماره رسید",from:"از تاریخ (YYYY-MM-DD)",to:"تا تاریخ (YYYY-MM-DD)",
   apply:"اعمال فیلتر",reset:"پاک کردن",state:"وضعیت",kind:"نوع",all:"همه",
   recorded:"ثبت‌شده",refresh:"بارگذاری دوباره",empty:"رسیدی یافت نشد.",reference:"شماره رسید",
   period:"مدت اشتراک",void:"باطل کردن رسید",reason:"دلیل (ضروری)",
   caution:"باطل کردن رسید، دسترسی پولی را خودکار لغو نمی‌کند. اشتراک مربوط را جداگانه بررسی کنید.",
   amount:"مبلغ",date:"تاریخ ثبت",summary:"مجموع‌ها بر اساس تاریخ است؛ فیلتر نوع یا وضعیت بر آن اثر ندارد.",
   rangeError:"بازهٔ تاریخ درست انتخاب کنید.",loadError:"اطلاعات مالی دریافت نشد.",
   support:"پیش از فعال‌سازی اشتراک، پرداخت واقعی را بیرون از برنامه تأیید کنید.",
 },
 "ps-AF":{heading:"مالي راپور",scope:"د مدیر لخوا ثبت شوي لاسي رسیدونه؛ نه تایید شوې بانکي پیسې او نه د ریزرفونو عاید.",
   history:"د میدان زړې رسیدونه شته؛ د رول او اضافي ټیم رسیدونه له پنځم پړاو څخه دي.",
   total:"ثبت شوي رسیدونه (افغانۍ)",voided:"لغوه رسیدونه (افغانۍ)",venue:"میدان",role:"تادیه شوی رول",
   extra:"اضافي ټیم",pendingRoles:"د رولونو د تادیې غوښتنې",pendingExtra:"د ټیمونو غوښتنې",
   expiringVenue:"په ۷ ورځو کې د میدان ختمېدونکي ګډونونه",expiringRole:"په ۷ ورځو کې ختمېدونکي رولونه",
   expiringExtra:"د اضافي ټیم ختمېدونکي ګډونونه",receipts:"د تادیې رسیدونه",
   search:"حساب یا رسید ولټوئ",from:"له نېټې (YYYY-MM-DD)",to:"تر نېټې (YYYY-MM-DD)",
   apply:"چاڼ تطبیق کړئ",reset:"پاک کړئ",state:"حالت",kind:"ډول",all:"ټول",
   recorded:"ثبت شوی",refresh:"تازه کړئ",empty:"رسید ونه موندل شو.",reference:"د رسید شمېره",
   period:"د ګډون موده",void:"رسید لغوه کړئ",reason:"لامل (اړین)",
   caution:"د رسید لغوه کول په اتومات ډول فعال ګډون نه بندوي. اړوند ګډون جلا وګورئ.",
   amount:"اندازه",date:"د ثبت نېټه",summary:"مجموع د نېټې له مخې دی؛ د ډول او حالت چاڼ پرې اغېز نه کوي.",
   rangeError:"د نېټې سمه موده وټاکئ.",loadError:"مالي معلومات ترلاسه نه شول.",
   support:"د ګډون له فعالېدو مخکې له سیسټمه بهر اصلي تادیه تایید کړئ.",
 },
};
function Pill({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){
 return <Pressable accessibilityRole="button" accessibilityState={{selected:active}}
    onPress={onPress} style={{minHeight:38,justifyContent:"center",paddingHorizontal:spacing.md,
      borderWidth:1,borderRadius:radius.pill,borderColor:active?colors.primary:colors.border,
      backgroundColor:active?colors.primarySoft:colors.surface}}>
    <AppText weight={active?"bold":"medium"} style={{color:active?colors.primary:colors.text}}>
      {label}
    </AppText>
  </Pressable>;
}
function Metric({label,value}:{label:string;value:string}){
 return <Card style={[styles.metricCard,{gap:spacing.xs}]}>
   <AppText muted variant="caption">{label}</AppText>
   <AppText variant="title" weight="bold">{value}</AppText>
 </Card>;
}
export function AdminBillingPhase5Section({token,busy,reason,setReason,action,refreshVersion}:{
 token:string;busy:boolean;reason:string;setReason:(s:string)=>void;
 action:(task:()=>Promise<unknown>,success:string,refresh?:boolean,target?:string)=>Promise<void>;
 refreshVersion:number;
}){
 const {language,isRTL}=useLocale();
 const l=labels[language]??labels.en;
 const [rows,setRows]=useState<AdminBillingReceipt[]>([]);
 const [summary,setSummary]=useState<AdminBillingSummary|null>(null);
 const [total,setTotal]=useState(0),[page,setPage]=useState(1);
 const [kind,setKind]=useState<Kind>("ALL"),[status,setStatus]=useState<Status>("ALL");
 const [qDraft,setQDraft]=useState(""),[q,setQ]=useState("");
 const [fromDraft,setFromDraft]=useState(""),[toDraft,setToDraft]=useState("");
 const [from,setFrom]=useState(""),[to,setTo]=useState("");
 const [requestId,setRequestId]=useState(0);
 const [loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null);
 const fmt=(val:number)=>new Intl.NumberFormat(language==="en"?"en-US":language).format(val);
 function date(value:string){return formatCompetitionDateTime(value,language);}
 const validDate=(d:string)=>!d||/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(new Date(d+"T00:00:00+04:30").getTime());
 function apply(){
   const start=fromDraft.trim(),end=toDraft.trim();
   if(!validDate(start)||!validDate(end)||!!start&&!!end&&start>end){setError(l.rangeError);return;}
   setError(null);setPage(1);setQ(qDraft.trim());setFrom(start);setTo(end);
   setRequestId(n=>n+1);
 }
 function reset(){setQ("");setQDraft("");setFrom("");setTo("");
   setFromDraft("");setToDraft("");setPage(1);setKind("ALL");setStatus("ALL");setRequestId(n=>n+1);}
 useEffect(()=>{
   let active=true;const controller=new AbortController();
   setLoading(true);setError(null);
   const filters:AdminBillingFilters={page,pageSize:25,
     ...(kind!=="ALL"?{kind}:{}),...(status!=="ALL"?{status}:{}),
     ...(q?{q}:{}),...(from?{from}:{}),...(to?{to}:{})};
   void Promise.all([adminApi.billingReceipts(token,filters,controller.signal),
     adminApi.billingSummary(token,{...(from?{from}:{}),...(to?{to}:{})},controller.signal)])
     .then(([receipts,sum])=>{
       if(!active)return;
       setRows(receipts.items);setTotal(receipts.total);setSummary(sum);
     }).catch(e=>{if(active&&!controller.signal.aborted)setError(e instanceof ApiRequestError?e.message:l.loadError);})
     .finally(()=>{if(active)setLoading(false);});
   return()=>{active=false;controller.abort();};
 },[token,kind,status,q,from,to,page,refreshVersion,requestId]);
 const byKind=(k:AdminBillingSummary["byKind"][number]["kind"])=>
   summary?.byKind.find(v=>v.kind===k)?.recordedAfn??0;
 const typelabel=(k:string)=>k==="VENUE"?l.venue:k==="PAID_ROLE"?l.role:l.extra;
 const dir=isRTL?"row-reverse" as const:"row" as const;
 return <View style={{gap:spacing.md}}>
   <Card style={styles.panel}>
     <AppText variant="bodyLarge" weight="bold">{l.heading}</AppText>
     <AppText muted>{l.scope}</AppText>
     <AppText variant="caption" muted>{l.history}</AppText>
     <View style={styles.metricGrid}>
       <Metric label={l.total} value={fmt(summary?.recordedTotalAfn??0)+" AFN"}/>
       <Metric label={l.voided} value={fmt(summary?.voidedTotalAfn??0)+" AFN"}/>
       <Metric label={l.venue} value={fmt(byKind("VENUE"))+" AFN"}/>
       <Metric label={l.role} value={fmt(byKind("PAID_ROLE"))+" AFN"}/>
       <Metric label={l.extra} value={fmt(byKind("EXTRA_TEAM"))+" AFN"}/>
     </View>
     <View style={styles.metricGrid}>
       <Metric label={l.pendingRoles} value={fmt(summary?.attention.pendingPaidRoles??0)}/>
       <Metric label={l.pendingExtra} value={fmt(summary?.attention.pendingExtraTeams??0)}/>
       <Metric label={l.expiringVenue} value={fmt(summary?.attention.expiringVenues7d??0)}/>
       <Metric label={l.expiringRole} value={fmt(summary?.attention.expiringPaidRoles7d??0)}/>
       <Metric label={l.expiringExtra} value={fmt(summary?.attention.expiringExtraTeams7d??0)}/>
     </View>
     <AppText variant="caption" muted>{l.summary}</AppText>
   </Card>
   <Card style={styles.panel}>
     <View style={[styles.tableHeader,{flexDirection:dir}]}>
       <AppText weight="bold" variant="bodyLarge">{l.receipts}</AppText>
       <AppText muted variant="caption">{total}</AppText>
     </View>
     <View style={styles.formGrid}>
       <TextField label={l.search} value={qDraft} onChangeText={setQDraft}
         onSubmitEditing={apply} containerStyle={styles.flexField}/>
       <TextField label={l.from} value={fromDraft} onChangeText={setFromDraft}
         forceLtr autoCapitalize="none" placeholder="YYYY-MM-DD" containerStyle={styles.smallField}/>
       <TextField label={l.to} value={toDraft} onChangeText={setToDraft}
         forceLtr autoCapitalize="none" placeholder="YYYY-MM-DD" containerStyle={styles.smallField}/>
       <Button label={l.apply} onPress={apply}/>
       <Button label={l.reset} variant="secondary" onPress={reset}/>
     </View>
     <AppText weight="semibold">{l.kind}</AppText>
     <ScrollView horizontal showsHorizontalScrollIndicator={false}
       contentContainerStyle={{gap:spacing.sm,paddingVertical:spacing.xs}}>
       {kinds.map(k=><Pill key={k} label={k==="ALL"?l.all:typelabel(k)} active={kind===k}
         onPress={()=>{setKind(k);setPage(1);}}/>)}
     </ScrollView>
     <AppText weight="semibold">{l.state}</AppText>
     <ScrollView horizontal showsHorizontalScrollIndicator={false}
       contentContainerStyle={{gap:spacing.sm,paddingVertical:spacing.xs}}>
       {statuses.map(k=><Pill key={k} label={k==="ALL"?l.all:k==="RECORDED"?l.recorded:l.voided}
         active={status===k} onPress={()=>{setStatus(k);setPage(1);}}/>)}
     </ScrollView>
     <Button variant="secondary" label={l.refresh} onPress={()=>setRequestId(n=>n+1)}/>
     {error?<View style={[styles.notice,styles.noticeError]}><AppText style={{color:colors.danger}}>{error}</AppText></View>:null}
     {loading?<AppText muted>{l.receipts}…</AppText>:rows.length===0?
       <AppText muted>{l.empty}</AppText>:rows.map(row=><View key={row.kind+row.id}
        style={[styles.dataRow,{flexDirection:dir}]}>
        <View style={{flex:1,minWidth:210,gap:4}}>
          <AppText weight="bold">{row.accountName}</AppText>
          <AppText variant="caption" muted>{typelabel(row.kind)} · {row.description}</AppText>
          <AppText weight="semibold">{fmt(row.amountAfn)} AFN · {row.status==="RECORDED"?l.recorded:l.voided}</AppText>
          <AppText variant="caption" muted>{l.date}: {date(row.createdAt)}</AppText>
          <AppText variant="caption" muted>{l.period}: {date(row.periodStartsAt)} — {date(row.periodEndsAt)}</AppText>
          <AppText variant="caption" muted forceLtr>{l.reference}: {row.providerReference??"—"}</AppText>
        </View>
        {row.status==="RECORDED"?<Button label={l.void} variant="danger" disabled={busy||reason.trim().length<3}
          onPress={()=>void action(()=>row.kind==="VENUE"?
            adminApi.voidPayment(token,row.id,reason):
            adminApi.voidPaidReceipt(token,row.id,reason),l.void,true,
            row.accountName+" · "+fmt(row.amountAfn)+" AFN · "+(row.providerReference??row.id))}/>:null}
       </View>)}
     <AdminPagination page={page} total={total} pageSize={25} onPage={setPage} loading={loading}/>
     <TextField label={l.reason} value={reason} onChangeText={setReason}/>
     <View style={[styles.notice,styles.noticeWarning,{padding:spacing.md}]}>
       <Ionicons name="alert-circle-outline" size={19} color={colors.warning}/>
       <AppText style={{flex:1}}>{l.caution}</AppText>
     </View>
     <AppText variant="caption" muted>{l.support}</AppText>
   </Card>
 </View>;
}
