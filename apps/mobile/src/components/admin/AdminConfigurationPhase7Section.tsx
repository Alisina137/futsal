import {colors,spacing} from "@leaguekick/design-tokens";
import type {PlatformSettingsDto,PlatformSettingsUpdateRequest} from "@leaguekick/contracts";
import {useEffect,useState} from "react";
import {View} from "react-native";
import {adminApi,ApiRequestError} from "../../lib/api";
import {formatCompetitionDateTime} from "../../lib/date-time";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {TextField} from "../ui/TextField";
import {styles} from "./AdminStyles";

const localeLabels={
 en:{title:"Platform configuration",description:"Changes affect future plans or templates; existing subscriptions retain their recorded terms.",
  current:"Last updated",monthly:"Monthly venue price (AFN)",annual:"Annual venue price (AFN)",
  trial:"New venue trial duration (hours)",flags:"Feature flags",templates:"Notification templates",
  key:"Setting key",value:"Template text",add:"Add",remove:"Remove",toggle:"Toggle",
  impact:"Review changes before saving",changed:"Changed fields",reason:"Reason for change (minimum 10 characters)",
  save:"Submit reviewed change",reload:"Reload current settings",empty:"No changes to save.",
  error:"Could not load current configuration.",pending:"Loading configuration…",
  conflict:"If another administrator updated these settings, reload and review before trying again.",
  important:"Changes are audited and version-checked. Role grants, billing history and past bookings are not modified.",
  noFlags:"No feature flags defined.",noTemplates:"No notification templates defined.",
  invalid:"Enter valid prices, trial hours, reason and setting keys before saving.",
 },
 "fa-AF":{title:"تنظیمات پلتفرم",description:"تغییرات بر برنامه‌های آینده اثر می‌گذارد؛ اشتراک‌های قبلی با شرایط ثبت‌شده باقی می‌مانند.",
  current:"آخرین تغییر",monthly:"قیمت ماهانه سالن (افغانی)",annual:"قیمت سالانه سالن (افغانی)",
  trial:"مدت آزمایشی سالن جدید (ساعت)",flags:"فعال‌سازی قابلیت‌ها",templates:"قالب اعلان‌ها",
  key:"کلید تنظیم",value:"متن قالب",add:"افزودن",remove:"حذف",toggle:"تغییر",
  impact:"پیش از ذخیره تغییرات را مرور کنید",changed:"فیلدهای تغییریافته",
  reason:"دلیل تغییر (حداقل ۱۰ حرف)",save:"ثبت تغییر تاییدشده",reload:"دریافت تنظیمات تازه",
  empty:"تغییری برای ذخیره وجود ندارد.",error:"دریافت تنظیمات ناموفق بود.",
  pending:"در حال بارگذاری تنظیمات…",conflict:"اگر مدیر دیگری تنظیمات را تغییر داده، دوباره دریافت و بررسی کنید.",
  important:"تغییرات ثبت و نسخه‌بندی می‌شوند؛ نقش‌ها، پرداخت‌های گذشته و رزروها دست‌نخورده می‌مانند.",
  noFlags:"قابلیتی تعریف نشده.",noTemplates:"قالبی تعریف نشده.",
  invalid:"قیمت‌ها، مدت آزمایش، دلیل و کلیدهای درست وارد کنید.",
 },
 "ps-AF":{title:"د پلیټفارم تنظیمات",description:"بدلونونه په راتلونکو پلانونو اغېز لري؛ پخواني ګډونونه خپل ثبت شوي شرایط ساتي.",
  current:"وروستی بدلون",monthly:"د میدان میاشتنی قیمت (افغانۍ)",annual:"کلنی قیمت (افغانۍ)",
  trial:"د نوي میدان ازمایښتي موده (ساعتونه)",flags:"د ځانګړتیاوو تنظیمات",templates:"د خبرتیاوو قالبونه",
  key:"د تنظیم نوم",value:"د پیغام متن",add:"زیاتول",remove:"لرې کول",toggle:"بدلول",
  impact:"د خوندي کولو مخکې بدلونونه وګورئ",changed:"بدل شوي موارد",
  reason:"د بدلون لامل (لږ تر لږه ۱۰ توري)",save:"تایید شوی بدلون ثبت کړئ",
  reload:"اوسني تنظیمات تازه کړئ",empty:"د خوندي کولو بدلون نشته.",
  error:"د تنظیماتو ترلاسه کول ناکام شول.",pending:"تنظیمات ترلاسه کېږي…",
  conflict:"که بل مدیر تنظیمات بدل کړي، بیا یې تازه او وګورئ.",
  important:"بدلونونه ثبتېږي او نسخه لري؛ رولونه، پخوانۍ پیسې او ریزرفونه نه بدلېږي.",
  noFlags:"ځانګړتیا نشته.",noTemplates:"قالب نشته.",
  invalid:"سم قیمت، موده، دلیل او د تنظیم نوم ولیکئ.",
 },
};
type Draft={monthlyPriceAfn:string;annualPriceAfn:string;trialDurationHours:string;
 featureFlags:Record<string,boolean>;notificationTemplates:Record<string,string>};
function fromDto(v:PlatformSettingsDto):Draft{
 return {monthlyPriceAfn:String(v.monthlyPriceAfn),annualPriceAfn:String(v.annualPriceAfn),
  trialDurationHours:String(v.trialDurationHours),
  featureFlags:{...v.featureFlags},notificationTemplates:{...v.notificationTemplates}};
}
export function AdminConfigurationPhase7Section({token,reason,setReason,busy,action,refreshVersion}:{
 token:string;reason:string;setReason:(v:string)=>void;busy:boolean;
 action:(task:()=>Promise<unknown>,success:string,refresh?:boolean,target?:string)=>Promise<void>;
 refreshVersion:number;
}){
 const {language,isRTL}=useLocale();const l=localeLabels[language]??localeLabels.en;
 const [snapshot,setSnapshot]=useState<PlatformSettingsDto|null>(null);
 const [draft,setDraft]=useState<Draft|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
 const [newFlag,setNewFlag]=useState(""),[newTemplate,setNewTemplate]=useState("");
 const [reload,setReload]=useState(0);
 useEffect(()=>{
   let active=true;setLoading(true);setError(null);
   void adminApi.settings(token).then(res=>{
     if(!active)return;
     setSnapshot(res.settings);setDraft(fromDto(res.settings));
   }).catch(e=>{if(active)setError(e instanceof ApiRequestError?e.message:l.error);})
     .finally(()=>{if(active)setLoading(false);});
   return()=>{active=false;};
 },[token,refreshVersion,reload]);
 function patch<K extends keyof Draft>(key:K,value:Draft[K]){
   setDraft(v=>v?{...v,[key]:value}:v);
 }
 const next=draft?{
   monthlyPriceAfn:Number(draft.monthlyPriceAfn),annualPriceAfn:Number(draft.annualPriceAfn),
   trialDurationHours:Number(draft.trialDurationHours),
   featureFlags:draft.featureFlags,notificationTemplates:draft.notificationTemplates,
 }:null;
 const changed=snapshot&&next?(Object.keys(next) as Array<keyof typeof next>)
   .filter(k=>JSON.stringify(snapshot[k])!==JSON.stringify(next[k])):[];
 const validKey=(k:string)=>/^[a-zA-Z][a-zA-Z0-9_.-]{0,59}$/.test(k);
 const valid=!!next&&Number.isInteger(next.monthlyPriceAfn)&&next.monthlyPriceAfn>=0&&next.monthlyPriceAfn<=100000000
   &&Number.isInteger(next.annualPriceAfn)&&next.annualPriceAfn>=0&&next.annualPriceAfn<=1000000000
   &&Number.isInteger(next.trialDurationHours)&&next.trialDurationHours>=1&&next.trialDurationHours<=720
   &&Object.keys(next.featureFlags).length<=30&&Object.keys(next.notificationTemplates).length<=20
   &&Object.keys(next.featureFlags).every(validKey)
   &&Object.entries(next.notificationTemplates).every(([key,value])=>validKey(key)&&value.length<=500);
 function save(){
   if(!next||!snapshot||!valid||reason.trim().length<10||changed.length===0)return;
   const input:PlatformSettingsUpdateRequest={...next,
     expectedUpdatedAt:snapshot.updatedAt,reason:reason.trim()};
   void action(()=>adminApi.updateSettings(token,input),l.save,true,
     l.changed+": "+changed.join(", ")+" · "+input.reason);
 }
 const dir=isRTL?"row-reverse" as const:"row" as const;
 return <View style={{gap:spacing.md}}>
  <Card style={styles.panel}>
   <AppText variant="bodyLarge" weight="bold">{l.title}</AppText>
   <AppText muted>{l.description}</AppText>
   <Button variant="secondary" label={l.reload} onPress={()=>setReload(n=>n+1)} disabled={loading}/>
   {error?<AppText style={{color:colors.danger}}>{error}</AppText>:null}
   {loading?<AppText muted>{l.pending}</AppText>:null}
   {snapshot&&draft?<View style={{gap:spacing.md}}>
     <AppText variant="caption" muted>{l.current}: {formatCompetitionDateTime(snapshot.updatedAt,language)}</AppText>
     <View style={styles.formGrid}>
       <TextField label={l.monthly} value={draft.monthlyPriceAfn}
         onChangeText={v=>patch("monthlyPriceAfn",v)} keyboardType="number-pad" forceLtr containerStyle={styles.flexField}/>
       <TextField label={l.annual} value={draft.annualPriceAfn}
         onChangeText={v=>patch("annualPriceAfn",v)} keyboardType="number-pad" forceLtr containerStyle={styles.flexField}/>
       <TextField label={l.trial} value={draft.trialDurationHours}
         onChangeText={v=>patch("trialDurationHours",v)} keyboardType="number-pad" forceLtr containerStyle={styles.flexField}/>
     </View>
     <AppText weight="bold">{l.flags}</AppText>
     {Object.keys(draft.featureFlags).length===0?<AppText muted>{l.noFlags}</AppText>:null}
     {Object.entries(draft.featureFlags).map(([key,enabled])=><View key={key}
       style={[styles.dataRow,{flexDirection:dir}]}>
       <AppText weight="semibold" style={{flex:1}}>{key}</AppText>
       <Button variant="secondary" label={enabled?"ON":"OFF"} onPress={()=>patch("featureFlags",
         {...draft.featureFlags,[key]:!enabled})}/>
       <Button variant="danger" label={l.remove} onPress={()=>{
         const flags={...draft.featureFlags};delete flags[key];patch("featureFlags",flags);
       }}/>
     </View>)}
     <View style={styles.formGrid}>
       <TextField label={l.key} value={newFlag} onChangeText={setNewFlag}
         autoCapitalize="none" containerStyle={styles.flexField}/>
       <Button label={l.add} variant="secondary" disabled={!validKey(newFlag)||newFlag in draft.featureFlags}
         onPress={()=>{patch("featureFlags",{...draft.featureFlags,[newFlag]:false});setNewFlag("");}}/>
     </View>
     <AppText weight="bold">{l.templates}</AppText>
     {Object.keys(draft.notificationTemplates).length===0?<AppText muted>{l.noTemplates}</AppText>:null}
     {Object.entries(draft.notificationTemplates).map(([key,value])=><View key={key}
       style={{gap:spacing.xs,paddingVertical:spacing.sm}}>
       <View style={{flexDirection:dir,alignItems:"center",gap:spacing.sm}}>
         <AppText weight="semibold" style={{flex:1}}>{key}</AppText>
         <Button variant="danger" label={l.remove} onPress={()=>{
           const templates={...draft.notificationTemplates};delete templates[key];
           patch("notificationTemplates",templates);
         }}/>
       </View>
       <TextField label={l.value} value={value} multiline maxLength={500}
         onChangeText={v=>patch("notificationTemplates",
           {...draft.notificationTemplates,[key]:v})}/>
     </View>)}
     <View style={styles.formGrid}>
       <TextField label={l.key} value={newTemplate} onChangeText={setNewTemplate}
         autoCapitalize="none" containerStyle={styles.flexField}/>
       <Button label={l.add} variant="secondary"
         disabled={!validKey(newTemplate)||newTemplate in draft.notificationTemplates}
         onPress={()=>{patch("notificationTemplates",
           {...draft.notificationTemplates,[newTemplate]:""});setNewTemplate("");}}/>
     </View>
     <Card style={{gap:spacing.sm,backgroundColor:colors.primarySoft}}>
       <AppText weight="bold">{l.impact}</AppText>
       <AppText>{changed.length?changed.join(" · "):l.empty}</AppText>
       <AppText variant="caption" muted>{l.important}</AppText>
     </Card>
     <TextField label={l.reason} value={reason} onChangeText={setReason} multiline/>
     {!valid?<AppText style={{color:colors.danger}}>{l.invalid}</AppText>:null}
     <Button label={l.save} disabled={busy||!valid||reason.trim().length<10||changed.length===0}
       onPress={save}/>
     <AppText variant="caption" muted>{l.conflict}</AppText>
   </View>:null}
  </Card>
 </View>;
}
