import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,spacing,radius} from "@leaguekick/design-tokens";
import type {AdminCaseDto,AdminOperationDetail,AdminOperationItem,AdminOperationKind} from "@leaguekick/contracts";
import {useEffect,useState} from "react";
import {Pressable,ScrollView,View} from "react-native";
import {adminApi,ApiRequestError} from "../../lib/api";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {TextField} from "../ui/TextField";
import {AdminPagination} from "./AdminPagination";
import {AdminStatusBadge,AdminEmptyState} from "./AdminCommon";
import {styles} from "./AdminStyles";

type Section=AdminOperationKind|"CASE";
const stateChoices=["ALL","OPEN","UNDER_REVIEW","RESOLVED"] as const;
const labels={
 en:{search:"Search",filter:"Apply filters",clear:"Clear filters",status:"Status",verification:"Verification",
  all:"All",pending:"Awaiting review",venueId:"Venue ID",from:"From (YYYY-MM-DD)",to:"To (YYYY-MM-DD)",
  total:"Total",open:"Inspect",back:"Back to directory",reason:"Reason for action (required)",
  note:"Investigation note",start:"Open investigation",review:"Mark under review",
  resolve:"Resolve investigation",empty:"No records match your filters.",loadFailed:"Could not load these records.",
  warning:"Attention / possible inconsistency",confirm:"These changes require confirmation and are audited.",
  noCases:"No investigations for this record.",cases:"Investigations",duplicate:"Possible duplicate venues",
  duplicateInfo:"Matching venue name, city and address; review manually. Nothing is automatically merged.",
  details:"Entity details",related:"Related records (bounded)",overview:"Summary",openCases:"Open investigations",
  new:"Newest",old:"Oldest",refresh:"Refresh",none:"None",venueAction:"Venue verification and access",
  verify:"Verify",reject:"Reject",suspend:"Suspend venue",restore:"Restore venue",
  immutable:"Reservations, competition results, referee assignments and team memberships are not modified from this console. Open a case for investigation.",
  caseState:"Case state",updateCase:"Update case",previous:"Existing note",
  security:"Referee eligibility: only Normal Users without player or other assigned roles may be made referees by venue owners.",
  once:"One venue owner account represents one venue with one active court.",
  dateInfo:"Date filters use Afghanistan local dates.",changeReason:"Use a specific reason of at least 3 characters.",
 },
 "fa-AF":{search:"جستجو",filter:"اعمال فیلتر",clear:"پاک کردن فیلتر",status:"وضعیت",verification:"تایید",
  all:"همه",pending:"منتظر بررسی",venueId:"شناسه سالن",from:"از تاریخ (YYYY-MM-DD)",to:"تا تاریخ (YYYY-MM-DD)",
  total:"مجموع",open:"بررسی",back:"بازگشت به فهرست",reason:"دلیل اقدام (ضروری)",
  note:"یادداشت بررسی",start:"آغاز بررسی",review:"در حال بررسی",resolve:"بستن بررسی",
  empty:"موردی با این فیلتر یافت نشد.",loadFailed:"دریافت اطلاعات ناموفق بود.",
  warning:"هشدار / ناسازگاری احتمالی",confirm:"این تغییرات نیاز به تایید دارند و ثبت می‌شوند.",
  noCases:"بررسی‌ای برای این مورد ثبت نشده.",cases:"بررسی‌ها",duplicate:"سالن‌های احتمالاً تکراری",
  duplicateInfo:"نام، شهر و آدرس یکسان؛ فقط بررسی دستی. هیچ سالنی خودکار ادغام نمی‌شود.",
  details:"جزئیات",related:"اطلاعات مرتبط (محدود)",overview:"خلاصه",openCases:"بررسی‌های باز",
  new:"جدیدترین",old:"قدیمی‌ترین",refresh:"تازه‌سازی",none:"هیچ",venueAction:"تایید و وضعیت سالن",
  verify:"تایید",reject:"رد",suspend:"تعلیق سالن",restore:"فعال‌سازی سالن",
  immutable:"رزروها، نتایج مسابقات، نقش داوران و عضویت‌های تیم از این بخش تغییر نمی‌کند. برای بررسی مورد ثبت کنید.",
  caseState:"وضعیت بررسی",updateCase:"به‌روزرسانی بررسی",previous:"یادداشت قبلی",
  security:"داور فقط از کاربر عادی بدون نقش بازیکن یا نقش‌های دیگر و توسط مالک سالن تعیین می‌شود.",
  once:"هر مالک تنها یک سالن و یک میدان فعال دارد.",
  dateInfo:"فیلتر تاریخ به وقت افغانستان است.",changeReason:"دلیلی مشخص با حداقل سه نویسه وارد کنید.",
 },
 "ps-AF":{search:"لټون",filter:"چاڼ پلي کړئ",clear:"چاڼ پاک کړئ",status:"حالت",verification:"تایید",
  all:"ټول",pending:"د بیاکتنې په تمه",venueId:"د میدان پېژند",from:"له نېټې (YYYY-MM-DD)",to:"تر نېټې (YYYY-MM-DD)",
  total:"ټول",open:"وګورئ",back:"بېرته نوملړ ته",reason:"د اقدام لامل (اړین)",
  note:"د څېړنې یادښت",start:"څېړنه پرانیزئ",review:"تر څېړنې لاندې",
  resolve:"څېړنه بشپړه کړئ",empty:"د دې چاڼ لپاره معلومات نشته.",loadFailed:"معلومات ترلاسه نه شول.",
  warning:"خبرتیا / احتمالي تېروتنه",confirm:"دغه بدلون تایید او ثبت ته اړتیا لري.",
  noCases:"د دې ریکارډ لپاره څېړنه نشته.",cases:"څېړنې",duplicate:"احتمالي تکراري میدانونه",
  duplicateInfo:"نوم، ښار او پته ورته دي؛ یوازې لاسي ارزونه. هېڅ اتومات یوځای کول نشته.",
  details:"تفصیل",related:"اړوند ریکارډونه (محدود)",overview:"لنډیز",openCases:"پرانیستې څېړنې",
  new:"نوي",old:"زاړه",refresh:"تازه کول",none:"نشته",venueAction:"د میدان تایید او حالت",
  verify:"تایید",reject:"رد",suspend:"میدان وځنډوئ",restore:"میدان فعال کړئ",
  immutable:"ریزرفونه، د سیالیو پایلې، د ریفریانو رولونه او د ټیم غړیتوبونه دلته نه بدلېږي. د څېړنې دوسیه پرانیزئ.",
  caseState:"د څېړنې حالت",updateCase:"څېړنه تازه کړئ",previous:"مخکینی یادښت",
  security:"ریفري یوازې د میدان د مالک له خوا له بې‌روله عادي کاروونکي ټاکل کېږي.",
  once:"یو مالک یوازې یو میدان او یو فعال کورټ لرلای شي.",
  dateInfo:"د نېټې چاڼ د افغانستان په وخت دی.",changeReason:"لږ تر لږه درې توري لرونکی مشخص لامل ولیکئ.",
 },
};
const filterStatuses:Record<AdminOperationKind,readonly string[]>={
 VENUE:["ALL","DRAFT","READY","ACTIVE","SUSPENDED"],
 TEAM:["ALL","ACTIVE","ARCHIVED"],
 COMPETITION:["ALL","DRAFT","REGISTRATION_OPEN","REGISTRATION_CLOSED","SCHEDULED",
   "IN_PROGRESS","COMPLETED","ARCHIVED","CANCELLED"],
 REFEREE:["ALL","ACTIVE","SUSPENDED"],
 RESERVATION:["ALL","PENDING","CONFIRMED","CANCELLED"],
};
function Choice({label,selected,onPress}:{label:string;selected:boolean;onPress:()=>void}){
 return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{selected}}
   style={{minHeight:39,borderRadius:radius.pill,paddingHorizontal:spacing.md,
     backgroundColor:selected?colors.primarySoft:colors.surface,
     borderWidth:1,borderColor:selected?colors.primary:colors.border,justifyContent:"center"}}>
   <AppText weight={selected?"bold":"medium"} style={{color:selected?colors.primary:colors.text}}>
    {label.replaceAll("_"," ")}
   </AppText>
 </Pressable>;
}
function localDate(value:unknown,language:"en"|"fa-AF"|"ps-AF"){
 const raw=String(value??"");
 if(!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}/.test(raw))return raw||"—";
 const d=new Date(raw);
 if(Number.isNaN(d.getTime()))return raw;
 return new Intl.DateTimeFormat(language==="en"?"en-GB":language,{
   timeZone:"Asia/Kabul",year:"numeric",month:"short",day:"2-digit",
   hour:"2-digit",minute:"2-digit",
 }).format(d);
}
function Info({name,value}:{name:string;value:unknown}){
 const {language}=useLocale();
 return <View style={{flexGrow:1,flexBasis:210,minWidth:0,gap:spacing.xs}}>
  <AppText muted variant="caption">{name}</AppText>
  <AppText selectable weight="medium">{localDate(value,language)}</AppText>
 </View>;
}
function Issue({title}:{title:string}){
 return <View style={[styles.notice,styles.noticeWarning,{padding:spacing.md}]}>
  <Ionicons name="alert-circle-outline" size={18} color={colors.warning}/>
  <AppText style={{flex:1,color:colors.text}}>{title}</AppText>
 </View>;
}
export function AdminOperationsPhase4Section({kind,token,reason,setReason,busy,action,refreshVersion}:{
 kind:Section;token:string;reason:string;setReason:(v:string)=>void;busy:boolean;
 action:(task:()=>Promise<unknown>,success:string,refresh?:boolean,target?:string)=>Promise<void>;
 refreshVersion:number;
}){
 const {language,isRTL,t}=useLocale();
 const l=labels[language]??labels.en;
 const [items,setItems]=useState<AdminOperationItem[]>([]);
 const [cases,setCases]=useState<AdminCaseDto[]>([]);
 const [relatedCases,setRelatedCases]=useState<AdminCaseDto[]>([]);
 const [duplicates,setDuplicates]=useState<Array<{key:string;count:number;items:AdminOperationItem[]}>>([]);
 const [total,setTotal]=useState(0);
 const [page,setPage]=useState(1);
 const [sort,setSort]=useState<"newest"|"oldest">("newest");
 const [queryDraft,setQueryDraft]=useState("");
 const [query,setQuery]=useState("");
 const [status,setStatus]=useState("ALL");
 const [verification,setVerification]=useState("ALL");
 const [caseType,setCaseType]=useState("ALL");
 const [venueDraft,setVenueDraft]=useState("");
 const [venueId,setVenueId]=useState("");
 const [fromDraft,setFromDraft]=useState("");
 const [toDraft,setToDraft]=useState("");
 const [from,setFrom]=useState("");
 const [to,setTo]=useState("");
 const [selected,setSelected]=useState<string|null>(null);
 const [detail,setDetail]=useState<AdminOperationDetail|null>(null);
 const [selectedCase,setSelectedCase]=useState<AdminCaseDto|null>(null);
 const [caseState,setCaseState]=useState<"OPEN"|"UNDER_REVIEW"|"RESOLVED">("UNDER_REVIEW");
 const [note,setNote]=useState("");
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [nonce,setNonce]=useState(0);

 useEffect(()=>{
   // Abort stale queries after filter or section change.
   let active=true;
   const controller=new AbortController();
   setLoading(true);setError(null);
   void (async()=>{
     try{
       if(kind==="CASE"){
         const result=await adminApi.adminCases(token,{page,pageSize:25,
           state:status==="ALL"?undefined:status,
           targetType:caseType==="ALL"?undefined:caseType},controller.signal);
         if(active){setCases(result.items);setTotal(result.total);}
       }else{
         const result=await adminApi.operationsPage(token,kind,{
           page,pageSize:25,sort,q:query||undefined,status:status==="ALL"?undefined:status,
           verification:kind==="VENUE"&&verification!=="ALL"?verification as "PENDING"|"VERIFIED"|"REJECTED":undefined,
           venueId:venueId||undefined,from:from||undefined,to:to||undefined},controller.signal);
         if(active){setItems(result.items);setTotal(result.total);}
         if(kind==="VENUE"){
           const dup=await adminApi.operationDuplicates(token,controller.signal);
           if(active)setDuplicates(dup.groups);
         }
       }
     }catch(e){if(active&&!controller.signal.aborted)
       setError(e instanceof ApiRequestError?e.message:l.loadFailed);
     }finally{if(active)setLoading(false);}
   })();
   return()=>{active=false;controller.abort();};
 },[kind,token,page,sort,query,status,caseType,verification,venueId,from,to,refreshVersion,nonce]);
 useEffect(()=>{
   if(kind==="CASE"||!selected)return;
   let active=true;
   const controller=new AbortController();
   setDetail(null);setRelatedCases([]);setError(null);
   void Promise.all([
     adminApi.operationDetail(token,kind,selected,controller.signal),
     adminApi.operationCases(token,kind,selected,controller.signal),
   ]).then(([d,c])=>{if(active){setDetail(d.detail);setRelatedCases(c.items);}})
     .catch(e=>{if(active&&!controller.signal.aborted)
       setError(e instanceof ApiRequestError?e.message:l.loadFailed);});
   return()=>{active=false;controller.abort();};
 },[kind,token,selected,refreshVersion,nonce]);
 useEffect(()=>{setSelectedCase(null);},[refreshVersion]);
 const writeAllowed=reason.trim().length>=3&&!busy;
 const confirm=(task:()=>Promise<unknown>,target:string)=>
   void action(task,t("phase7.admin.updated"),true,target);
 const apply=()=>{setPage(1);setQuery(queryDraft.trim());setVenueId(venueDraft.trim());
   setFrom(fromDraft.trim());setTo(toDraft.trim());};
 const clear=()=>{setQuery("");setQueryDraft("");setVenueId("");setVenueDraft("");
   setFrom("");setTo("");setFromDraft("");setToDraft("");setStatus("ALL");
   setVerification("ALL");setCaseType("ALL");setPage(1);};
 const openItem=(id:string)=>{setSelected(id);setDetail(null);setRelatedCases([]);setNote("");};
 const heading=kind==="CASE"?l.cases:kind==="VENUE"?"Venues":kind==="TEAM"?"Teams":
   kind==="COMPETITION"?"Competitions":kind==="REFEREE"?"Referees":"Reservations";
 const dir= isRTL?"row-reverse" as const:"row" as const;

 if(kind==="CASE"&&selectedCase){
   const c=selectedCase;
   return <View style={{gap:spacing.md}}>
     <Button label={l.back} variant="secondary" onPress={()=>setSelectedCase(null)}/>
     <Card style={styles.panel}>
       <AppText variant="title" weight="bold">{l.cases}: {c.targetType} · {c.targetId.slice(0,8)}</AppText>
       <AdminStatusBadge label={c.state} tone={c.state==="RESOLVED"?"success":"warning"}/>
       <Info name={l.previous} value={c.note}/>
       <Info name={l.reason} value={c.reason}/>
       <Info name="Opened" value={c.openedAt}/>
       <Info name="Updated" value={c.updatedAt}/>
       {c.state==="RESOLVED"?<Issue title="Resolved investigations are immutable. Open a new case if needed."/>:<>
         <View style={{flexDirection:dir,gap:spacing.sm,flexWrap:"wrap"}}>
           {(["UNDER_REVIEW","RESOLVED"] as const).map(s=><Choice key={s}
             label={s} selected={caseState===s} onPress={()=>setCaseState(s)}/>)}
         </View>
         <TextField label={l.reason} value={reason} onChangeText={setReason}/>
         <TextField label={l.note} value={note} onChangeText={setNote} multiline/>
         <Button label={l.updateCase} disabled={!writeAllowed||note.trim().length<3}
           onPress={()=>confirm(()=>adminApi.updateAdminCase(token,c.id,
             {state:caseState,reason,note}),c.targetType+" · "+c.targetId)}/>
       </>}
     </Card>
   </View>;
 }
 if(selected&&kind!=="CASE"){
   return <View style={{gap:spacing.md}}>
     <View style={{flexDirection:dir,gap:spacing.sm,alignItems:"center",flexWrap:"wrap"}}>
       <Button label={l.back} variant="secondary" onPress={()=>setSelected(null)}/>
       <AppText variant="title" weight="bold">{detail?.item.title??selected}</AppText>
     </View>
     {error?<Issue title={error}/>:null}
     {!detail&&!error?<Card style={styles.panel}><AppText muted>{l.details}…</AppText></Card>:null}
     {detail?<><Card style={styles.panel}>
       <View style={{flexDirection:dir,alignItems:"center",gap:spacing.sm,flexWrap:"wrap"}}>
         <AdminStatusBadge label={detail.item.status}
           tone={detail.item.status==="SUSPENDED"||detail.item.status==="CANCELLED"?"danger":"success"}/>
         {detail.item.secondaryStatus?<AdminStatusBadge label={detail.item.secondaryStatus}
           tone={detail.item.secondaryStatus==="REJECTED"?"danger":"warning"}/>:null}
       </View>
       <View style={{flexDirection:"row",flexWrap:"wrap",gap:spacing.lg}}>
         {detail.facts.map((f,i)=><Info key={i} name={f.label} value={f.value}/>)}
       </View>
       {detail.warnings.length?detail.warnings.map((w,i)=><Issue key={i} title={w}/>)
         :<AppText muted variant="caption">{l.none} {l.warning.toLowerCase()}</AppText>}
       <AppText variant="caption" muted>{kind==="VENUE"?l.once:kind==="REFEREE"?l.security:l.immutable}</AppText>
     </Card>
     {detail.groups.map(group=><Card key={group.title} style={styles.panel}>
       <AppText variant="bodyLarge" weight="bold">{group.title}</AppText>
       {group.rows.length===0?<AppText muted>{l.none}</AppText>:
        group.rows.map(row=><View key={row.id} style={[styles.dataRow,{flexDirection:dir}]}>
         <View style={{flex:1,minWidth:190,gap:3}}>
           <AppText weight="semibold">{row.primary}</AppText>
           <AppText variant="caption" muted>{row.secondary}</AppText>
         </View>
         {row.status?<AdminStatusBadge label={row.status} tone="warning"/>:null}
        </View>)}
     </Card>)}
     {kind==="VENUE"?<Card style={styles.panel}>
       <AppText variant="bodyLarge" weight="bold">{l.venueAction}</AppText>
       <TextField label={l.reason} value={reason} onChangeText={setReason}/>
       <AppText muted variant="caption">{l.confirm}</AppText>
       <View style={{flexDirection:"row",gap:spacing.sm,flexWrap:"wrap"}}>
         {(["VERIFY","REJECT","SUSPEND","RESTORE"] as const).map(a=>
           <Button key={a} label={a==="VERIFY"?l.verify:a==="REJECT"?l.reject:a==="SUSPEND"?l.suspend:l.restore}
             disabled={!writeAllowed|| (a==="RESTORE"?detail.item.status!=="SUSPENDED":
               a==="SUSPEND"?detail.item.status==="SUSPENDED":
               detail.item.secondaryStatus!=="PENDING")}
             variant={a==="SUSPEND"||a==="REJECT"?"danger":"secondary"}
             onPress={()=>confirm(()=>adminApi.venueAction(token,selected,{action:a,reason}),
               detail.item.title+" · "+a)}/>)}
       </View>
     </Card>:null}
     <Card style={styles.panel}>
       <AppText variant="bodyLarge" weight="bold">{l.cases}</AppText>
       {relatedCases.length?relatedCases.map(c=><View key={c.id} style={styles.dataRow}>
         <Info name={c.state} value={c.note}/>
         <AppText variant="caption" muted>{localDate(c.openedAt,language)}</AppText>
       </View>):<AppText muted>{l.noCases}</AppText>}
       {relatedCases.some(c=>c.state!=="RESOLVED")?
         <Issue title="A case is already open for this record. Resolve it in Investigations before opening another."/>:<>
         <TextField label={l.reason} value={reason} onChangeText={setReason}/>
         <TextField label={l.note} value={note} onChangeText={setNote} multiline/>
         <Button label={l.start} disabled={!writeAllowed||note.trim().length<3}
           onPress={()=>confirm(()=>adminApi.openAdminCase(token,
             {targetType:kind,targetId:selected,reason,note}),kind+" · "+detail.item.title)}/>
       </>}
     </Card></>:null}
   </View>;
 }
 return <View style={{gap:spacing.md}}>
   <Card style={styles.panel}>
     <View style={{flexDirection:dir,alignItems:"center",justifyContent:"space-between",gap:spacing.md}}>
       <AppText variant="bodyLarge" weight="bold">{heading}</AppText>
       <AppText variant="caption" muted>{l.total}: {total}</AppText>
     </View>
     {kind!=="CASE"?<><View style={styles.formGrid}>
       <TextField label={l.search} value={queryDraft} onChangeText={setQueryDraft}
         onSubmitEditing={apply} containerStyle={styles.flexField}/>
       <TextField label={l.venueId} value={venueDraft} onChangeText={setVenueDraft}
         containerStyle={styles.smallField} autoCapitalize="none"/>
     </View>
     <View style={styles.formGrid}>
       <TextField label={l.from} value={fromDraft} onChangeText={setFromDraft} containerStyle={styles.smallField}/>
       <TextField label={l.to} value={toDraft} onChangeText={setToDraft} containerStyle={styles.smallField}/>
       <Button label={l.filter} onPress={apply}/>
       <Button label={l.clear} variant="secondary" onPress={clear}/>
     </View>
     <AppText muted variant="caption">{l.dateInfo}</AppText></>:null}
     <AppText weight="semibold">{kind==="CASE"?l.caseState:l.status}</AppText>
     <ScrollView horizontal showsHorizontalScrollIndicator={false}
       contentContainerStyle={{gap:spacing.sm,paddingVertical:spacing.xs}}>
       {(kind==="CASE"?stateChoices:filterStatuses[kind]).map(s=>
         <Choice key={s} label={s==="ALL"?l.all:s} selected={status===s}
           onPress={()=>{setStatus(s);setPage(1);}}/>)}
     </ScrollView>
     {kind==="VENUE"?<><AppText weight="semibold">{l.verification}</AppText>
       <ScrollView horizontal showsHorizontalScrollIndicator={false}
         contentContainerStyle={{gap:spacing.sm,paddingVertical:spacing.xs}}>
         {(["ALL","PENDING","VERIFIED","REJECTED"] as const).map(s=>
           <Choice key={s} label={s==="ALL"?l.all:s} selected={verification===s}
             onPress={()=>{setVerification(s);setPage(1);}}/>)}
       </ScrollView>
       <Choice label={l.pending} selected={verification==="PENDING"}
         onPress={()=>{setVerification("PENDING");setStatus("ALL");setPage(1);}}/>
     </>:null}
     {kind==="CASE"?<ScrollView horizontal showsHorizontalScrollIndicator={false}
       contentContainerStyle={{gap:spacing.sm,paddingVertical:spacing.xs}}>
       {(["ALL","VENUE","TEAM","COMPETITION","REFEREE","RESERVATION"] as const).map(s=>
         <Choice key={s} label={s==="ALL"?l.all:s} selected={caseType===s}
           onPress={()=>{setCaseType(s);setPage(1);}}/>)}
     </ScrollView>:null}
     <View style={{flexDirection:dir,flexWrap:"wrap",gap:spacing.sm}}>
       {kind!=="CASE"?<><Button label={l.new} variant="secondary"
         disabled={sort==="newest"} onPress={()=>{setSort("newest");setPage(1);}}/>
       <Button label={l.old} variant="secondary"
         disabled={sort==="oldest"} onPress={()=>{setSort("oldest");setPage(1);}}/></>:null}
       <Button label={l.refresh} variant="secondary" onPress={()=>setNonce(x=>x+1)}/>
     </View>
   </Card>
   {error?<Issue title={error}/>:null}
   {loading?<Card style={styles.panel}><AppText muted>{l.details}…</AppText></Card>:null}
   {!loading?<Card style={styles.panel}>
     {kind==="CASE"?(cases.length?cases.map(c=><View key={c.id} style={[styles.dataRow,{flexDirection:dir}]}>
       <View style={{flex:1,minWidth:200,gap:spacing.xs}}>
         <AppText weight="semibold">{c.targetType} · {c.targetId.slice(0,8)}</AppText>
         <AppText variant="caption" muted>{c.reason}</AppText>
         <AppText variant="caption" muted>{localDate(c.openedAt,language)}</AppText>
       </View>
       <AdminStatusBadge label={c.state} tone={c.state==="RESOLVED"?"success":"warning"}/>
       <Button label={l.open} variant="secondary" onPress={()=>{setSelectedCase(c);setNote(c.note);
         setCaseState(c.state==="OPEN"?"UNDER_REVIEW":c.state);}}/>
     </View>):<AdminEmptyState title={l.empty}/>):
       (items.length?items.map(item=><View key={item.id} style={[styles.dataRow,{flexDirection:dir}]}>
         <View style={styles.rowIdentity}>
           <View style={styles.avatar}><Ionicons name={kind==="VENUE"?"business-outline":
             kind==="TEAM"?"people-outline":kind==="COMPETITION"?"trophy-outline":
             kind==="REFEREE"?"flag-outline":"calendar-outline"} size={19} color={colors.primary}/></View>
           <View style={{flex:1,gap:3}}>
             <AppText weight="semibold">{item.title}</AppText>
             <AppText variant="caption" muted>{item.subtitle}</AppText>
             <AppText variant="caption" muted>{item.venueName??item.ownerName??item.location??""}</AppText>
             {item.startsAt?<AppText variant="caption" muted>{localDate(item.startsAt,language)}</AppText>:null}
           </View>
         </View>
         <View style={{flexDirection:"row",gap:spacing.sm,alignItems:"center",flexWrap:"wrap"}}>
           <AdminStatusBadge label={item.status} tone={item.status==="SUSPENDED"?"danger":"warning"}/>
           {item.secondaryStatus?<AdminStatusBadge label={item.secondaryStatus}
             tone={item.secondaryStatus==="REJECTED"?"danger":"success"}/>:null}
           <Button label={l.open} variant="secondary" onPress={()=>openItem(item.id)}/>
         </View>
       </View>):<AdminEmptyState title={l.empty}/>)}
     <AdminPagination page={page} total={total} pageSize={25} onPage={setPage} loading={loading}/>
   </Card>:null}
   {kind==="VENUE"&&duplicates.length?<Card style={styles.panel}>
     <AppText variant="bodyLarge" weight="bold">{l.duplicate}</AppText>
     <AppText variant="caption" muted>{l.duplicateInfo}</AppText>
     {duplicates.map(group=><View key={group.key} style={{gap:spacing.sm}}>
       <AppText weight="semibold">{group.count} · {group.key}</AppText>
       {group.items.map(item=><View key={item.id} style={[styles.dataRow,{flexDirection:dir}]}>
         <Info name={item.title} value={item.ownerName}/>
         <Button label={l.open} variant="secondary" onPress={()=>openItem(item.id)}/>
       </View>)}
     </View>)}
   </Card>:null}
 </View>;
}
