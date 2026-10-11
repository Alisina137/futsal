import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { AdminUserDetailDto, AdminUserDirectoryFilter, AdminUserDto } from "@leaguekick/contracts";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { adminApi, ApiRequestError } from "../../lib/api";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/TextField";
import { AdminStatusBadge, AdminEmptyState } from "./AdminCommon";
import { AdminPagination } from "./AdminPagination";
import { styles } from "./AdminStyles";

type StatusFilter=NonNullable<AdminUserDirectoryFilter["status"]>|"ALL";
type RoleFilter=NonNullable<AdminUserDirectoryFilter["role"]>|"ALL";
type Tab="Overview"|"Roles"|"Subscriptions"|"Teams"|"Reservations"|"Activity";
const tabs:Tab[]=["Overview","Roles","Subscriptions","Teams","Reservations","Activity"];
const statusChoices:StatusFilter[]=["ALL","ACTIVE","SUSPENDED","DELETED"];
const roleChoices:RoleFilter[]=["ALL","NORMAL_USER","PLAYER","REFEREE","VENUE_OWNER","TEAM_MANAGER","VENUE_STAFF","COMPETITION_ADMIN","PLATFORM_ADMIN"];
const translations={
  en:{
    search:"Search by name, phone or username",city:"City filter",filter:"Filter",
    role:"Role",status:"Status",all:"All",open:"View details",back:"Back to users",
    none:"No records found.",loading:"Loading account details…",failed:"Unable to load account details.",
    overview:"Overview",roles:"Roles",subscriptions:"Subscriptions",teams:"Teams",
    reservations:"Reservations",activity:"Activity",created:"Joined",updated:"Updated",
    effective:"Effective roles",sources:"Role assignments and origins",conflicts:"Role conflicts to review",
    noConflicts:"No known conflicts.",normal:"Normal User",sessions:"Active sessions",revoked:"Revoke all sessions",
    note:"Account note",saveNote:"Save note",reason:"Reason (required)",noteHint:"Private support note",
    limitation:"Role grants follow their authorized flows: venue owners assign referees only to unassigned Normal Users; teams manage players; paid roles require subscriptions. The admin can review conflicts but cannot silently change assignments.",
    expired:"Subscription / entitlement",booking:"Reservation",history:"Account activity",
    phone:"Phone",cityInfo:"City",noItems:"Nothing to show in this section.",confirm:"Account action",
    suspend:"Suspend account",restore:"Restore account",summary:"Suspension immediately revokes all sessions. Restoration requires the user to sign in again.",
    users:"User directory",total:"Total",reasonHelp:"Enter at least 3 characters to perform account actions.",
    newest:"Newest",oldest:"Oldest",refresh:"Refresh",unknown:"Unknown",
  },
  "fa-AF":{
    search:"جستجو با نام، شماره یا نام کاربری",city:"فیلتر شهر",filter:"فیلتر",
    role:"نقش",status:"وضعیت",all:"همه",open:"جزئیات",back:"بازگشت به کاربران",
    none:"موردی یافت نشد.",loading:"در حال دریافت جزئیات…",failed:"دریافت جزئیات ناموفق بود.",
    overview:"نمای کلی",roles:"نقش‌ها",subscriptions:"اشتراک‌ها",teams:"تیم‌ها",
    reservations:"رزروها",activity:"فعالیت",created:"تاریخ پیوستن",updated:"به‌روزرسانی",
    effective:"نقش‌های فعال",sources:"منبع نقش‌ها",conflicts:"تداخل نقش‌ها",
    noConflicts:"تداخلی ثبت نشده است.",normal:"کاربر عادی",sessions:"نشست‌های فعال",revoked:"لغو همه نشست‌ها",
    note:"یادداشت حساب",saveNote:"ذخیره یادداشت",reason:"دلیل (ضروری)",noteHint:"یادداشت خصوصی پشتیبانی",
    limitation:"تعیین نقش‌ها از مسیر مجاز انجام می‌شود: مالک سالن داور را فقط از کاربر عادی بدون نقش انتخاب می‌کند؛ تیم مسئول بازیکنان است و نقش‌های پولی اشتراک لازم دارند. مدیریت تنها تداخل‌ها را بررسی می‌کند.",
    expired:"اشتراک / امتیاز",booking:"رزرو",history:"فعالیت حساب",
    phone:"شماره",cityInfo:"شهر",noItems:"اطلاعاتی برای نمایش نیست.",confirm:"اقدام حساب",
    suspend:"تعلیق حساب",restore:"فعال‌سازی حساب",summary:"با تعلیق حساب، همه نشست‌ها فوراً لغو می‌شوند. بعد از فعال‌سازی، ورود دوباره لازم است.",
    users:"فهرست کاربران",total:"مجموع",reasonHelp:"برای اقدام روی حساب دست‌کم سه حرف دلیل وارد کنید.",
    newest:"جدیدترین",oldest:"قدیمی‌ترین",refresh:"بارگذاری مجدد",unknown:"نامعلوم",
  },
  "ps-AF":{
    search:"په نوم، شمېره یا کارن نوم لټون",city:"د ښار چاڼ",filter:"چاڼ",
    role:"رول",status:"حالت",all:"ټول",open:"تفصیل",back:"کاروونکو ته بېرته",
    none:"هېڅ ریکارډ ونه موندل شو.",loading:"د حساب معلومات ترلاسه کېږي…",failed:"د حساب د معلوماتو ترلاسه کول ناکام شول.",
    overview:"لنډیز",roles:"رولونه",subscriptions:"ګډونونه",teams:"ټیمونه",
    reservations:"ریزرفونه",activity:"فعالیت",created:"د ګډون نېټه",updated:"تازه شوی",
    effective:"فعال رولونه",sources:"د رولونو سرچینې",conflicts:"د رولونو تضاد",
    noConflicts:"تضاد نشته.",normal:"عادي کاروونکی",sessions:"فعالې ناستې",revoked:"ټولې ناستې لغوه کړئ",
    note:"د حساب یادښت",saveNote:"یادښت ثبت کړئ",reason:"لامل (اړین)",noteHint:"د ملاتړ شخصي یادښت",
    limitation:"رولونه د مجازې لارې ټاکل کېږي: د میدان مالک یوازې بې‌روله عادي کاروونکی ریفري ټاکي؛ لوبغاړي ټیم تنظیموي او تادیه شوي رولونه ګډون غواړي. مدیر تضادونه ارزوي، خو رولونه په پټه نه بدلوي.",
    expired:"ګډون / امتیاز",booking:"ریزرف",history:"د حساب فعالیت",
    phone:"شمېره",cityInfo:"ښار",noItems:"د ښودلو لپاره څه نشته.",confirm:"د حساب اقدام",
    suspend:"حساب وځنډوئ",restore:"حساب فعال کړئ",summary:"د حساب په ځنډولو ټولې ناستې سمدستي لغوه کېږي. له بیا فعالېدو وروسته بیا ننوتل اړین دي.",
    users:"د کاروونکو نوملړ",total:"ټول",reasonHelp:"د حساب اقدام لپاره لږ تر لږه درې توري دلیل ورکړئ.",
    newest:"نوي",oldest:"زاړه",refresh:"تازه کړئ",unknown:"نامعلوم",
  },
};
function filterButton(label:string,active:boolean,onPress:()=>void,key:string){
  return <Pressable key={key} onPress={onPress} accessibilityRole="button"
    accessibilityState={{selected:active}}
    style={{minHeight:38,justifyContent:"center",paddingHorizontal:spacing.md,
      borderRadius:radius.pill,borderWidth:1,
      borderColor:active?colors.primary:colors.border,
      backgroundColor:active?colors.primarySoft:colors.surface}}>
    <AppText weight={active?"bold":"medium"} style={{color:active?colors.primary:colors.text}}>{label.replaceAll("_"," ")}</AppText>
  </Pressable>;
}
function Field({label,value}:{label:string;value:string|number|null|undefined}){
  return <View style={{flex:1,minWidth:165,gap:spacing.xs}}>
    <AppText variant="caption" muted>{label}</AppText>
    <AppText weight="semibold">{value==null||value===""?"—":String(value)}</AppText>
  </View>;
}
export function AdminUsersPhase3Section(props:{
  users:AdminUserDto[];query:string;setQuery:(value:string)=>void;
  page:number;total:number;onPage:(n:number)=>void;sort:"newest"|"oldest";
  onSort:(s:"newest"|"oldest")=>void;reason:string;setReason:(v:string)=>void;
  loading:boolean;busy:boolean;reload:()=>void;
  action:(task:()=>Promise<unknown>,success:string,refresh?:boolean,target?:string)=>Promise<void>;
  token:string;t:(key:any,params?:Record<string,string|number>)=>string;isRTL:boolean;
  statusFilter:StatusFilter;onStatusFilter:(s:StatusFilter)=>void;
  roleFilter:RoleFilter;onRoleFilter:(s:RoleFilter)=>void;
  cityFilter:string;onCityFilter:(s:string)=>void;
  selectedUserId:string|null;onSelectedUserId:(id:string|null)=>void;
}){
  const {language}=useLocale();
  const l=translations[language]??translations.en;
  const [cityDraft,setCityDraft]=useState(props.cityFilter);
  const [note,setNote]=useState("");
  const [tab,setTab]=useState<Tab>("Overview");
  const [detail,setDetail]=useState<AdminUserDetailDto|null>(null);
  const [detailLoading,setDetailLoading]=useState(false);
  const [detailError,setDetailError]=useState<string|null>(null);
  const {selectedUserId,token}=props;
  useEffect(()=>{
    if(!selectedUserId){setDetail(null);return;}
    const controller=new AbortController();
    setDetailLoading(true);setDetailError(null);setDetail(null);
    void adminApi.userDetail(token,selectedUserId,controller.signal)
      .then(data=>{if(!controller.signal.aborted)setDetail(data.detail);})
      .catch(error=>{if(!controller.signal.aborted)
        setDetailError(error instanceof ApiRequestError?error.message:l.failed);})
      .finally(()=>{if(!controller.signal.aborted)setDetailLoading(false);});
    return()=>controller.abort();
  },[token,selectedUserId,props.users]);

  function showUser(id:string){setNote("");setTab("Overview");props.onSelectedUserId(id);}
  function action(task:()=>Promise<unknown>,target:string){
    void props.action(task,props.t("phase7.admin.updated"),true,target);
  }
  const canWrite=props.reason.trim().length>=3&&!props.busy;
  if(selectedUserId){
    const name=detail?.user.displayName??props.users.find(u=>u.id===selectedUserId)?.displayName??selectedUserId;
    return <View style={{gap:spacing.md}}>
      <View style={{flexDirection:props.isRTL?"row-reverse":"row",gap:spacing.sm,flexWrap:"wrap",alignItems:"center"}}>
        <Button label={l.back} variant="secondary" onPress={()=>props.onSelectedUserId(null)}/>
        <AppText variant="title" weight="bold">{name}</AppText>
      </View>
      {detailLoading?<Card style={styles.panel}><AppText muted>{l.loading}</AppText></Card>:null}
      {detailError?<Card style={styles.panel}><AppText style={{color:colors.danger}}>{detailError}</AppText>
        <Button label={l.refresh} variant="secondary" onPress={()=>props.onSelectedUserId(null)}/></Card>:null}
      {detail?<><Card style={styles.panel}>
        <View style={{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:spacing.sm}}>
          <AdminStatusBadge label={detail.user.status} tone={detail.user.status==="ACTIVE"?"success":"danger"}/>
          <Field label={l.phone} value={detail.user.phone}/>
          <Field label={l.cityInfo} value={detail.user.city}/>
          <Field label={l.sessions} value={detail.sessions.active+" / "+detail.sessions.total}/>
        </View>
        {detail.conflicts.length?<View style={[styles.notice,styles.noticeWarning,{padding:spacing.md}]}>
          <Ionicons name="warning-outline" size={20} color={colors.warning}/>
          <View style={{flex:1,gap:spacing.xs}}>
            <AppText weight="bold">{l.conflicts}</AppText>
            {detail.conflicts.map(c=><AppText key={c} variant="caption">{c.replaceAll("_"," ")}</AppText>)}
          </View>
        </View>:null}
      </Card>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{gap:spacing.sm,paddingVertical:spacing.xs}}>
        {tabs.map(item=>filterButton(l[item.toLowerCase() as keyof typeof l]??item,tab===item,()=>setTab(item),item))}
      </ScrollView>
      <Card style={styles.panel}>
        {tab==="Overview"?<View style={{gap:spacing.md}}>
          <View style={{flexDirection:"row",flexWrap:"wrap",gap:spacing.md}}>
            <Field label={l.created} value={detail.user.createdAt.slice(0,10)}/>
            <Field label={l.updated} value={detail.user.updatedAt.slice(0,10)}/>
            <Field label={l.effective} value={detail.effectiveRoles.join(" · ")||l.normal}/>
          </View>
          <AppText variant="caption" muted>{l.summary}</AppText>
          <AppText variant="caption" muted>{l.limitation}</AppText>
        </View>:null}
        {tab==="Roles"?<View style={{gap:spacing.md}}>
          <AppText weight="bold">{l.sources}</AppText>
          {detail.roleProvenance.length===0?<AppText muted>{l.normal}</AppText>:detail.roleProvenance.map((r,i)=>
            <View key={i} style={styles.dataRow}>
              <Field label={l.role} value={r.role.replaceAll("_"," ")}/>
              <Field label={r.source.replaceAll("_"," ")} value={r.detail??r.assignedAt?.slice(0,10)}/>
            </View>)}
          <AppText variant="caption" muted>{l.limitation}</AppText>
        </View>:null}
        {tab==="Subscriptions"?<View style={{gap:spacing.sm}}>
          {detail.subscriptions.length===0?<AppText muted>{l.noItems}</AppText>:
            detail.subscriptions.map((s,i)=><View key={i} style={styles.dataRow}>
              <Field label={s.kind} value={s.role}/>
              <Field label={l.status} value={s.status}/>
              <Field label={l.expired} value={s.activeUntil?.slice(0,10)}/>
            </View>)}
        </View>:null}
        {tab==="Teams"?<View style={{gap:spacing.sm}}>
          {detail.teams.length===0?<AppText muted>{l.noItems}</AppText>:
            detail.teams.map(team=><View key={team.id} style={styles.dataRow}>
              <Field label={team.relationship} value={team.name}/>
              <Field label={l.status} value={team.status}/>
            </View>)}
        </View>:null}
        {tab==="Reservations"?<View style={{gap:spacing.sm}}>
          {detail.reservations.length===0?<AppText muted>{l.noItems}</AppText>:
            detail.reservations.map(b=><View key={b.id} style={styles.dataRow}>
              <Field label={l.booking} value={b.venueName+" · "+b.startsAt.slice(0,16).replace("T"," ")}/>
              <Field label={l.status} value={b.status+" · "+b.source}/>
              <Field label="AFN" value={b.priceAfn}/>
            </View>)}
        </View>:null}
        {tab==="Activity"?<View style={{gap:spacing.sm}}>
          {detail.activity.length===0?<AppText muted>{l.noItems}</AppText>:
            detail.activity.map(a=><View key={a.id} style={styles.dataRow}>
              <Field label={a.action.replaceAll("_"," ")} value={a.createdAt.slice(0,16).replace("T"," ")}/>
              <Field label={l.reason} value={String(a.metadata.reason??a.metadata.note??"—")}/>
            </View>)}
        </View>:null}
      </Card>
      <Card style={styles.panel}>
        <AppText variant="bodyLarge" weight="bold">{l.confirm}</AppText>
        <TextField label={l.reason} value={props.reason} onChangeText={props.setReason}/>
        <AppText variant="caption" muted>{l.reasonHelp}</AppText>
        <View style={{flexDirection:"row",gap:spacing.sm,flexWrap:"wrap"}}>
          {detail.user.status!=="DELETED"?<Button
            label={detail.user.status==="SUSPENDED"?l.restore:l.suspend}
            variant={detail.user.status==="SUSPENDED"?"secondary":"danger"} disabled={!canWrite}
            onPress={()=>action(()=>adminApi.setUserStatus(token,detail.user.id,
              {status:detail.user.status==="SUSPENDED"?"ACTIVE":"SUSPENDED",reason:props.reason}),
              name+" · "+detail.user.id)}/>:null}
          <Button label={l.revoked} variant="secondary" disabled={!canWrite}
            onPress={()=>action(()=>adminApi.revokeUserSessions(token,detail.user.id,props.reason),
              name+" · "+detail.user.id)}/>
        </View>
        <TextField label={l.noteHint} value={note} onChangeText={setNote} multiline/>
        <Button label={l.saveNote} variant="secondary" disabled={!canWrite||note.trim().length<3}
          onPress={()=>action(()=>adminApi.userNote(token,detail.user.id,props.reason,note),
            name+" · "+detail.user.id)}/>
      </Card></>:null}
    </View>;
  }
  return <View style={{gap:spacing.md}}>
    <Card style={styles.panel}>
      <AppText variant="bodyLarge" weight="bold">{l.users}</AppText>
      <View style={styles.formGrid}>
        <TextField label={l.search} value={props.query} onChangeText={props.setQuery}
          containerStyle={styles.flexField} onSubmitEditing={props.reload}/>
        <TextField label={l.city} value={cityDraft} onChangeText={setCityDraft}
          containerStyle={styles.smallField} onSubmitEditing={()=>props.onCityFilter(cityDraft.trim())}/>
        <Button label={props.t("phase7.admin.search")} onPress={()=>{
          props.onCityFilter(cityDraft.trim());props.reload();
        }} loading={props.loading}/>
      </View>
      <AppText weight="semibold">{l.status}</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{gap:spacing.sm,paddingVertical:spacing.xs}}>
        {statusChoices.map(s=>filterButton(s==="ALL"?l.all:s,props.statusFilter===s,()=>props.onStatusFilter(s),s))}
      </ScrollView>
      <AppText weight="semibold">{l.role}</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{gap:spacing.sm,paddingVertical:spacing.xs}}>
        {roleChoices.map(r=>filterButton(r==="ALL"?l.all:r,props.roleFilter===r,()=>props.onRoleFilter(r),r))}
      </ScrollView>
      <View style={{flexDirection:"row",gap:spacing.sm,alignItems:"center",flexWrap:"wrap"}}>
        <AppText variant="caption" muted>{l.total+": "+props.total}</AppText>
        <Button variant="secondary" label={l.newest} disabled={props.sort==="newest"} onPress={()=>props.onSort("newest")}/>
        <Button variant="secondary" label={l.oldest} disabled={props.sort==="oldest"} onPress={()=>props.onSort("oldest")}/>
      </View>
    </Card>
    <Card style={styles.panel}>
      {props.users.length===0?<AdminEmptyState title={l.none}/>:props.users.map(user=>
        <View key={user.id} style={[styles.dataRow,{flexDirection:props.isRTL?"row-reverse":"row"}]}>
          <View style={styles.rowIdentity}>
            <View style={styles.avatar}><Ionicons name="person" size={18} color={colors.primary}/></View>
            <View style={{flex:1,gap:spacing.xs}}>
              <AppText weight="bold">{user.displayName}</AppText>
              <AppText variant="caption" muted forceLtr>{user.phone}</AppText>
              <AppText variant="caption" muted>{user.roles.join(" · ")||l.normal}</AppText>
              <AppText variant="caption" muted>{user.createdAt.slice(0,10)}</AppText>
            </View>
          </View>
          <AdminStatusBadge label={user.status} tone={user.status==="ACTIVE"?"success":"danger"}/>
          <Button label={l.open} variant="secondary" onPress={()=>showUser(user.id)}/>
        </View>)}
      <AdminPagination page={props.page} total={props.total} pageSize={25}
        onPage={props.onPage} loading={props.loading}/>
    </Card>
  </View>;
}
