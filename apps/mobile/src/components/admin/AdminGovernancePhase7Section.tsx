import {colors,spacing} from "@leaguekick/design-tokens";
import type {AdminAuditFilter,AdminAuditLogDto,AdminDiagnostics} from "@leaguekick/contracts";
import {useCallback,useEffect,useState} from "react";
import {Platform,View} from "react-native";
import {adminApi,ApiRequestError} from "../../lib/api";
import {formatCompetitionDateTime} from "../../lib/date-time";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {TextField} from "../ui/TextField";
import {AdminPagination} from "./AdminPagination";
import {styles} from "./AdminStyles";

const copy={
 en:{audit:"Audit & Security History",readiness:"Operational Readiness",
  auditDesc:"Administrator-only history, with sensitive free-text metadata withheld from exports.",
  latest:"Latest activity",filter:"Filter events",search:"Search action, type or target ID",
  action:"Action (contains)",target:"Target type",actor:"Actor user ID",
  from:"From date (YYYY-MM-DD)",to:"To date (YYYY-MM-DD)",
  apply:"Apply filters",reset:"Reset",reload:"Refresh",empty:"No matching audit events.",
  export:"Export selected dates as CSV",csvHelp:"Browser only. Choose a date range up to 31 days; maximum 1,000 rows. Shorten the dates if exceeded.",
  invalid:"Enter valid dates (From must not exceed To), and a valid actor ID if provided.",
  date:"Date",by:"Actor",record:"Target",exportOk:"CSV export created.",
  exported:"Export is available in web admin.",loadError:"Could not retrieve administrative history.",
  releaseTitle:"Release gate: operator approval required",
  releaseInfo:"Automatic checks are informational. A green indicator is not authorization to deploy.",
  unknown:"Not independently verified",backup:"Confirm an isolated restore, monitoring, incident rollback and the staging test plan before release.",
  counts:"Outstanding operational work",reports:"Reports",tickets:"Support tickets",
  campaigns:"Pending announcements",push:"Failed push deliveries",
  checks:"System checks",pass:"Ready",attention:"Attention",unknownState:"Unknown",
 },
 "fa-AF":{audit:"ثبت فعالیت و امنیت",readiness:"آمادگی عملیاتی",
  auditDesc:"تاریخچه مخصوص مدیران؛ جزئیات حساس در خروجی پنهان می‌مانند.",
  latest:"آخرین رویدادها",filter:"فیلتر رویدادها",search:"جستجوی اقدام، نوع یا شناسه",
  action:"نام اقدام",target:"نوع هدف",actor:"شناسه مدیر",
  from:"از تاریخ (YYYY-MM-DD)",to:"تا تاریخ (YYYY-MM-DD)",
  apply:"اعمال فیلتر",reset:"پاک کردن",reload:"تازه‌سازی",empty:"رویدادی یافت نشد.",
  export:"خروجی CSV از تاریخ انتخابی",csvHelp:"فقط مرورگر. بازه حداکثر ۳۱ روز و ۱۰۰۰ ردیف. برای اطلاعات بیشتر تاریخ را کوتاه کنید.",
  invalid:"تاریخ‌ها و شناسه مدیر را درست وارد کنید.",date:"زمان",by:"مدیر",
  record:"هدف",exportOk:"فایل CSV ساخته شد.",exported:"خروجی در نسخه وب در دسترس است.",
  loadError:"دریافت رویدادها ناموفق بود.",releaseTitle:"اجازه انتشار نیاز به تایید مسئول دارد",
  releaseInfo:"بررسی خودکار فقط اطلاعات است؛ نتیجه سبز اجازه انتشار نیست.",
  unknown:"مستقلاً تایید نشده",backup:"بازیابی نسخه پشتیبان، نظارت، بازگشت نسخه و آزمایش‌ها را تایید کنید.",
  counts:"کارهای باقیمانده",reports:"گزارش‌ها",tickets:"تکت‌های پشتیبانی",
  campaigns:"اعلان‌های در انتظار",push:"پوش ناموفق",
  checks:"بررسی سیستم",pass:"آماده",attention:"نیازمند بررسی",unknownState:"نامعلوم",
 },
 "ps-AF":{audit:"د امنیت او کړنو تاریخچه",readiness:"عملياتي چمتووالی",
  auditDesc:"یوازې مدیر ته تاریخچه؛ حساس جزئیات په فایل کې نه ښکاري.",
  latest:"وروستي فعالیتونه",filter:"د پېښو چاڼ",search:"اقدام، ډول یا پېژند ولټوئ",
  action:"د اقدام نوم",target:"د هدف ډول",actor:"د مدیر پېژند",
  from:"له نېټې (YYYY-MM-DD)",to:"تر نېټې (YYYY-MM-DD)",
  apply:"چاڼ پلي کړئ",reset:"پاکول",reload:"تازه کول",empty:"اړونده پېښه نشته.",
  export:"د ټاکل شوې مودې CSV",csvHelp:"یوازې د ویب لپاره، تر ۳۱ ورځو او ۱۰۰۰ کتارونو پورې.",
  invalid:"نېټې او د مدیر پېژند په سمه بڼه ولیکئ.",date:"وخت",by:"مدیر",
  record:"هدف",exportOk:"CSV جوړ شو.",exported:"فایل په ویب کې شته.",
  loadError:"د پېښو راوړل ناکام شول.",releaseTitle:"د خپرېدو لپاره د مسؤل تایید پکار دی",
  releaseInfo:"اتومات کتنه یوازې معلومات دي، نه د خپرېدو اجازه.",
  unknown:"مستقل نه دی تایید شوی",backup:"بک اپ، بیا راګرځول، څارنه او د بېرته تګ ازموینه تایید کړئ.",
  counts:"پاتې کارونه",reports:"راپورونه",tickets:"د ملاتړ ټکټونه",
  campaigns:"پاتې خبرتیاوې",push:"ناکامې پوش خبرتیاوې",
  checks:"د سیستم کتنې",pass:"چمتو",attention:"پاملرنه",unknownState:"نامعلوم",
 },
};
const PAGE_SIZE=25;
const validDate=(v:string)=>!v||/^\d{4}-\d{2}-\d{2}$/.test(v)&&
  !Number.isNaN(new Date(v+"T00:00:00+04:30").getTime());
function query(filter:AdminAuditFilter){
 return {...filter,page:filter.page,pageSize:PAGE_SIZE};
}
export function AdminGovernancePhase7Section({mode,token}:{mode:"audit"|"readiness";token:string}){
 const {language,isRTL}=useLocale();
 const l=copy[language]??copy.en;
 const [page,setPage]=useState(1),[total,setTotal]=useState(0);
 const [items,setItems]=useState<AdminAuditLogDto[]>([]);
 const [diagnostics,setDiagnostics]=useState<AdminDiagnostics|null>(null);
 const [search,setSearch]=useState(""),[action,setAction]=useState("");
 const [target,setTarget]=useState(""),[actor,setActor]=useState("");
 const [from,setFrom]=useState(""),[to,setTo]=useState("");
 const [filters,setFilters]=useState<Omit<AdminAuditFilter,"page"|"pageSize">>({});
 const [loading,setLoading]=useState(false),[working,setWorking]=useState(false);
 const [error,setError]=useState<string|null>(null),[message,setMessage]=useState("");
 const [refresh,setRefresh]=useState(0);
 const reload=useCallback(()=>setRefresh(n=>n+1),[]);
 useEffect(()=>{
   let alive=true,controller=new AbortController();
   setLoading(true);setError(null);
   const task=mode==="audit"?
     adminApi.auditPage(token,query({page,pageSize:PAGE_SIZE,...filters}),controller.signal):
     adminApi.diagnostics(token,controller.signal);
   void task.then(v=>{
     if(!alive)return;
     if("items" in v){setItems(v.items);setTotal(v.total);}
     else setDiagnostics(v);
   }).catch(e=>{
     if(alive&&!controller.signal.aborted)setError(e instanceof ApiRequestError?e.message:l.loadError);
   }).finally(()=>{if(alive)setLoading(false);});
   return()=>{alive=false;controller.abort();};
 },[token,page,filters,refresh,mode]);
 function apply(){
   if(!validDate(from.trim())||!validDate(to.trim())||!!from&&!!to&&from>to||
     !!actor.trim()&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actor.trim())){
     setError(l.invalid);return;
   }
   setError(null);setPage(1);
   setFilters({...(search.trim()?{q:search.trim()}:{}),
     ...(action.trim()?{action:action.trim()}:{}),
     ...(target.trim()?{targetType:target.trim()}:{}),
     ...(actor.trim()?{actorId:actor.trim()}:{}),
     ...(from.trim()?{from:from.trim()}:{}),...(to.trim()?{to:to.trim()}:{})});
   reload();
 }
 function reset(){
   setSearch("");setAction("");setTarget("");setActor("");setFrom("");setTo("");
   setFilters({});setPage(1);reload();
 }
 async function exportCsv(){
   if(working||Platform.OS!=="web")return;
   if(!filters.from||!filters.to){setError(l.csvHelp);return;}
   if(new Date(filters.to+"T00:00:00+04:30").getTime()-
      new Date(filters.from+"T00:00:00+04:30").getTime()>31*86400000){
     setError(l.csvHelp);return;
   }
   setError(null);setMessage("");setWorking(true);
   try{
     const text=await adminApi.auditExport(token,query({page:1,pageSize:PAGE_SIZE,...filters}));
     const blob=new Blob(["\ufeff",text],{type:"text/csv;charset=utf-8"});
     const fileUrl=URL.createObjectURL(blob);
     const node=document.createElement("a");
     node.href=fileUrl;node.download="futsal-admin-audit-"+filters.from+"_"+filters.to+".csv";
     document.body.appendChild(node);node.click();node.remove();
     setTimeout(()=>URL.revokeObjectURL(fileUrl),1500);
     setMessage(l.exportOk);
   }catch(e){setError(e instanceof ApiRequestError?e.message:l.loadError);}
   finally{setWorking(false);}
 }
 return <View style={{gap:spacing.md}}>
  <Card style={styles.panel}>
   <AppText variant="bodyLarge" weight="bold">{mode==="audit"?l.audit:l.readiness}</AppText>
   <AppText muted>{mode==="audit"?l.auditDesc:l.releaseInfo}</AppText>
   <Button label={l.reload} variant="secondary" onPress={reload} disabled={loading}/>
  </Card>
  {mode==="audit"?<>
   <Card style={styles.panel}>
     <AppText weight="bold">{l.filter}</AppText>
     <View style={styles.formGrid}>
       <TextField label={l.search} value={search} onChangeText={setSearch}
         onSubmitEditing={apply} containerStyle={styles.flexField}/>
       <TextField label={l.action} value={action} onChangeText={setAction}
         containerStyle={styles.flexField}/>
       <TextField label={l.target} value={target} onChangeText={setTarget}
         containerStyle={styles.flexField}/>
       <TextField label={l.actor} value={actor} onChangeText={setActor} forceLtr
         autoCapitalize="none" containerStyle={styles.flexField}/>
       <TextField label={l.from} value={from} onChangeText={setFrom} forceLtr
         autoCapitalize="none" placeholder="YYYY-MM-DD" containerStyle={styles.smallField}/>
       <TextField label={l.to} value={to} onChangeText={setTo} forceLtr
         autoCapitalize="none" placeholder="YYYY-MM-DD" containerStyle={styles.smallField}/>
     </View>
     <View style={[styles.rowActions,{flexDirection:isRTL?"row-reverse":"row"}]}>
       <Button label={l.apply} onPress={apply}/>
       <Button label={l.reset} variant="secondary" onPress={reset}/>
     </View>
     {Platform.OS==="web"?<Button label={l.export} variant="secondary"
       loading={working} disabled={loading||!filters.from||!filters.to}
       onPress={()=>void exportCsv()}/>:null}
     <AppText variant="caption" muted>{l.csvHelp}</AppText>
   </Card>
   <Card style={styles.panel}>
     <AppText weight="bold" variant="bodyLarge">{l.latest}</AppText>
     {loading?<AppText muted>{l.reload}…</AppText>:items.length===0?<AppText muted>{l.empty}</AppText>:
       items.map(item=><View key={item.id} style={[styles.dataRow,{alignItems:"flex-start"}]}>
         <View style={{flex:1,minWidth:230,gap:spacing.xs}}>
           <AppText weight="bold">{item.action}</AppText>
           <AppText variant="caption" muted>{l.date}: {formatCompetitionDateTime(item.createdAt,language)}</AppText>
           <AppText variant="caption" muted forceLtr>{l.by}: {item.actorUserId??"SYSTEM"}</AppText>
           <AppText variant="caption" muted forceLtr>{l.record}: {item.targetType} · {item.targetId??"—"}</AppText>
           {Object.keys(item.metadata).length>0?<View style={{flexDirection:"row",gap:spacing.sm,flexWrap:"wrap"}}>
             {Object.entries(item.metadata).map(([key,value])=>
               <AppText key={key} variant="caption" muted>{key}: {JSON.stringify(value)}</AppText>)}
           </View>:null}
         </View>
       </View>)}
     <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage}
       loading={loading}/>
   </Card>
  </>:<Card style={styles.panel}>
    <AppText weight="bold" variant="bodyLarge">{l.releaseTitle}</AppText>
    <AppText muted>{l.backup}</AppText>
    {loading?<AppText muted>{l.reload}…</AppText>:diagnostics?<View style={{gap:spacing.md}}>
      <AppText variant="caption" muted>{formatCompetitionDateTime(diagnostics.generatedAt,language)}</AppText>
      <AppText weight="bold">{l.counts}</AppText>
      <View style={styles.metricGrid}>
        {[
          [l.reports,diagnostics.counts.unresolvedReports],
          [l.tickets,diagnostics.counts.openSupportTickets],
          [l.campaigns,diagnostics.counts.scheduledAnnouncements],
          [l.push,diagnostics.counts.failedPushDeliveries],
        ].map(([label,value])=><Card key={label} style={styles.metricCard}>
          <AppText variant="caption" muted>{label}</AppText>
          <AppText variant="title" weight="bold">{value}</AppText>
        </Card>)}
      </View>
      <AppText weight="bold">{l.checks}</AppText>
      {diagnostics.checks.map(item=><View key={item.key} style={styles.dataRow}>
        <View style={{flex:1,minWidth:210,gap:spacing.xs}}>
          <AppText weight="bold">{item.key.replaceAll("_"," ")}</AppText>
          <AppText muted>{item.detail}</AppText>
        </View>
        <Card style={{padding:spacing.sm,
          backgroundColor:item.state==="PASS"?colors.primarySoft:colors.surfaceMuted}}>
          <AppText weight="semibold" style={{color:item.state==="ATTENTION"?colors.danger:colors.text}}>
            {item.state==="PASS"?l.pass:item.state==="ATTENTION"?l.attention:l.unknownState}
          </AppText>
        </Card>
      </View>)}
      <AppText variant="caption" muted>{l.unknown}</AppText>
    </View>:null}
   </Card>}
   {error?<Card style={styles.panel}><AppText accessibilityRole="alert" style={{color:colors.danger}}>{error}</AppText></Card>:null}
   {message?<Card style={styles.panel}><AppText>{message}</AppText></Card>:null}
 </View>;
}
