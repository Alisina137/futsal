import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type {
  AdminAuditLogDto,
  AdminAnalyticsResponse,
  AdminAnalyticsDays,
  AdminRoleSubscriptionDto,
  AdminUserDto,
  AdminUserDirectoryFilter,
  AdminVenueDto,
  PlatformSettingsDto,
  SubscriptionPaymentDto,
} from "@leaguekick/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { styles } from "../../../src/components/admin/AdminStyles";
import { adminNavItems, type SectionKey } from "../../../src/components/admin/admin-navigation";
import { adminPhase4Label } from "../../../src/components/admin/admin-phase4-labels";
import { AdminSidebar } from "../../../src/components/admin/AdminSidebar";
import { AdminConfirmModal } from "../../../src/components/admin/AdminConfirmModal";
import { DashboardSection } from "../../../src/components/admin/AdminDashboardSection";
import {AdminAnalyticsSection} from "../../../src/components/admin/AdminAnalyticsSection";
import { VenuesSection } from "../../../src/components/admin/AdminDirectorySections";
import { AdminOperationsPhase4Section } from "../../../src/components/admin/AdminOperationsPhase4Section";
import { AdminUsersPhase3Section } from "../../../src/components/admin/AdminUsersPhase3Section";
import { SubscriptionsSection } from "../../../src/components/admin/AdminBillingSection";
import { ConfigurationSection, SupportSection, ModerationSection, AuditSection } from "../../../src/components/admin/AdminOperationsSections";

import { ManualTeamsAdminSection } from "../../../src/components/admin/ManualTeamsAdminSection";
import {TeamSlotsAdminSection} from "../../../src/components/admin/TeamSlotsAdminSection";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { adminApi, ApiRequestError } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function AdminScreen() {
  const { session, signOut } = useAuth();
  const { t, isRTL, language } = useLocale();
  const { width } = useWindowDimensions();
  const desktop = width >= 980;
  const token = session?.accessToken;
  const isAdmin = session?.user.roles.includes("PLATFORM_ADMIN") ?? false;
  const [section,setSection]=useState<SectionKey>(()=>{
    // Keep the selected workspace after a browser refresh, without persisting
    // any credentials or account data.
    try{
      const saved=(globalThis as unknown as {sessionStorage?:{getItem:(key:string)=>string|null}})
        .sessionStorage?.getItem("futsal.admin.section");
      return adminNavItems.some(item=>item.key===saved)?saved as SectionKey:"dashboard";
    }catch{return "dashboard";}
  });
  useEffect(()=>{
    try{(globalThis as unknown as {sessionStorage?:{setItem:(k:string,v:string)=>void}})
      .sessionStorage?.setItem("futsal.admin.section",section);}catch{/* restricted browser storage */}
  },[section]);

  const [analytics,setAnalytics]=useState<AdminAnalyticsResponse|null>(null);
  const [analyticsDays,setAnalyticsDays]=useState<AdminAnalyticsDays>(30);
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [venues, setVenues] = useState<AdminVenueDto[]>([]);
  const [duplicates, setDuplicates] = useState<AdminVenueDto[][]>([]);
  const [audit, setAudit] = useState<AdminAuditLogDto[]>([]);
  const [settings, setSettings] = useState<PlatformSettingsDto | null>(null);
  const [payments, setPayments] = useState<SubscriptionPaymentDto[]>([]);
  const [roleSubscriptions, setRoleSubscriptions] = useState<AdminRoleSubscriptionDto[]>([]);
  const [paymentVenueId, setPaymentVenueId] = useState("");

  const [query, setQuery] = useState("");
  const [queryDraft,setQueryDraft]=useState("");
  const [page,setPage]=useState(1);
  const [sort,setSort]=useState<"newest"|"oldest">("newest");
  const [userTotal,setUserTotal]=useState(0);
  const [statusFilter,setStatusFilter]=useState<NonNullable<AdminUserDirectoryFilter["status"]>|"ALL">("ALL");
  const [roleFilter,setRoleFilter]=useState<NonNullable<AdminUserDirectoryFilter["role"]>|"ALL">("ALL");
  const [cityFilter,setCityFilter]=useState("");
  const [selectedUserId,setSelectedUserId]=useState<string|null>(null);
  const [venueTotal,setVenueTotal]=useState(0);
  const loadSequence=useRef(0);
  const abortController=useRef<AbortController|null>(null);
  const [reason, setReason] = useState("");
  const [months, setMonths] = useState("1");
  const [amountAfn, setAmountAfn] = useState("1000");
  const [paymentRef, setPaymentRef] = useState("");
  const [trialHours, setTrialHours] = useState("72");
  const [monthly, setMonthly] = useState("1000");
  const [annual, setAnnual] = useState("12000");
  const [configTrialHours, setConfigTrialHours] = useState("72");
  const [supportTargetType, setSupportTargetType] = useState<"USER" | "VENUE">("VENUE");
  const [supportTargetId, setSupportTargetId] = useState("");
  const [supportNote, setSupportNote] = useState("");
  const [postId, setPostId] = useState("");
  const [promotionId, setPromotionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [operationRefresh,setOperationRefresh]=useState(0);
  const [loadIssues, setLoadIssues] = useState<string[]>([]);
  const [pending,setPending]=useState<{
    task:()=>Promise<unknown>;success:string;refresh:boolean;target:string;reason:string;
  }|null>(null);
  const [confirmError,setConfirmError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!token||!isAdmin)return;
    const serial=++loadSequence.current;
    abortController.current?.abort();
    const controller=new AbortController();
    abortController.current=controller;
    setLoading(true);setLoadIssues([]);
    const failures:string[]=[];
    const describeFailure=(name:string,e:unknown)=>
      e instanceof ApiRequestError?`${name}: ${e.code}${e.status?" HTTP "+e.status:""}`
      :`${name}: UNKNOWN_ERROR`;
    const loadPart=async<T,>(name:string,task:()=>Promise<T>,apply:(data:T)=>void)=>{
      try{
        const data=await task();
        if(serial===loadSequence.current)apply(data);
      }catch(e){
        if(serial===loadSequence.current&&!controller.signal.aborted)
          failures.push(describeFailure(name,e));
      }
    };
    // Demand-load the selected section only. A user search must not refetch
    // audits, settings, billing or dashboard metrics.
    if(section==="dashboard"||section==="analytics"){
      setAnalytics(null); // never show last period metrics after a failed period change
      await loadPart("analytics",()=>adminApi.analytics(token,analyticsDays,controller.signal),setAnalytics);
    }
    else if(section==="users")await loadPart("users",
      ()=>adminApi.usersPage(token,query,page,25,controller.signal,sort,{status:statusFilter==="ALL"?undefined:statusFilter,role:roleFilter==="ALL"?undefined:roleFilter,city:cityFilter||undefined}),data=>{
        setUsers(data.users);setUserTotal(data.total);
      });
    else if(section==="venues")await Promise.all([
      loadPart("venues",()=>adminApi.venuesPage(token,query,page,25,controller.signal,sort),data=>{
        setVenues(data.venues);setVenueTotal(data.total);
      }),
      loadPart("duplicates",()=>adminApi.duplicateVenues(token),data=>setDuplicates(data.groups)),
    ]);
    else if(section==="subscriptions")await Promise.all([
      loadPart("subscriptions",()=>adminApi.roleSubscriptions(token),data=>setRoleSubscriptions(data.subscriptions)),
      loadPart("venues",()=>adminApi.venues(token),data=>setVenues(data.venues)),
    ]);
    else if(section==="configuration")await loadPart("settings",()=>adminApi.settings(token),data=>{
      setSettings(data.settings);
      setMonthly(String(data.settings.monthlyPriceAfn));
      setAnnual(String(data.settings.annualPriceAfn));
      setConfigTrialHours(String(data.settings.trialDurationHours));
    });
    else if(section==="audit")await loadPart("audit",()=>adminApi.audit(token),data=>setAudit(data.logs));
    if(serial===loadSequence.current){
      setLoadIssues(failures);
      setLoading(false);
    }
  },[isAdmin,token,section,query,page,sort,analyticsDays,statusFilter,roleFilter,cityFilter]);

  useEffect(()=>{
    void load();
    return()=>{loadSequence.current++;abortController.current?.abort();};
  },[load]);

  function submitSearch(){
    const next=queryDraft.trim();
    setPage(1);
    if(next===query&&page===1)void load();else setQuery(next);
  }
  function updateSort(next:"newest"|"oldest"){
    setPage(1);setSort(next);
  }
  function selectSection(next:SectionKey){
    setSection(next);setPage(1);setQuery("");setQueryDraft("");setSort("newest");
    setStatusFilter("ALL");setRoleFilter("ALL");setCityFilter("");setSelectedUserId(null);
    setMessage(null);
  }

  async function action(task:()=>Promise<unknown>,success:string,refresh=true,target?:string){
    if(busy||pending)return;
    if(!refresh){
      // Read-only payment-history inspection does not need a confirmation.
      setBusy(true);setMessage(null);
      try{await task();setMessage(success);}catch{setMessage(t("phase7.admin.actionError"));}
      finally{setBusy(false);}
      return;
    }
    setConfirmError(null);
    setPending({task,success,refresh,target:target??sectionTitle+" · "+success,reason});
  }

  async function confirmPending(){
    if(!pending||busy)return;
    setBusy(true);setConfirmError(null);
    try{
      await pending.task();
      setPending(null);
      setMessage(pending.success);
      setOperationRefresh(current=>current+1);
      if(pending.refresh)await load();
    }catch(e){
      setConfirmError(e instanceof ApiRequestError?e.message:t("phase7.admin.actionError"));
    }finally{setBusy(false);}
  }


  if (!isAdmin) {
    return <View style={styles.deniedPage}>
      <View style={styles.deniedCard}>
        <View style={styles.deniedIcon}><Ionicons name="shield-outline" size={34} color={colors.danger}/></View>
        <AppText variant="title" weight="bold">{t("phase7.admin.title")}</AppText>
        <AppText muted style={{ textAlign: "center" }}>{t("phase7.admin.denied")}</AppText>
        <Button label={t("common.signOut")} variant="danger" onPress={() => void signOut()} />
      </View>
    </View>;
  }

  const sectionTitle = adminPhase4Label(section,language) ??
    t((adminNavItems.find((item) => item.key === section)?.labelKey ?? "phase7.admin.dashboard") as never);

  return <View style={[styles.adminRoot, { flexDirection: desktop ? (isRTL ? "row-reverse" : "row") : "column" }]}>
    <AdminSidebar
      desktop={desktop}
      isRTL={isRTL}
      section={section}
      onSelect={selectSection}
      displayName={session?.user.displayName ?? session?.user.username ?? ""}
      username={session?.user.username ?? ""}
      onSignOut={() => void signOut()}
      t={t}
    />

    <View style={styles.workspace}>
      <View style={[styles.topbar, { flexDirection:desktop?(isRTL?"row-reverse":"row"):"column", alignItems:desktop?"center":"stretch" }]}>
        <View style={styles.topbarCopy}>
          <View style={[styles.adminBreadcrumb,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <AppText variant="caption" muted>Futsal Admin</AppText>
            <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={14} color={colors.textMuted}/>
            <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>{sectionTitle}</AppText>
          </View>
          <AppText variant="title" weight="bold">{sectionTitle}</AppText>
          <AppText muted>{t("phase7.admin.subtitle")}</AppText>
        </View>
        <View style={[styles.topbarActions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={16} color={colors.success}/>
            <AppText variant="caption" weight="bold" style={{ color: colors.success }}>PLATFORM_ADMIN</AppText>
          </View>
          <Button label={t("common.retry")} onPress={() => void load()} loading={loading} variant="secondary" />
          {!desktop?<Button label={t("common.signOut")} onPress={()=>void signOut()} variant="secondary" />:null}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {message ? <View style={[styles.notice, message === t("phase7.admin.actionError") ? styles.noticeError : styles.noticeSuccess]}>
          <Ionicons name={message === t("phase7.admin.actionError") ? "alert-circle-outline" : "checkmark-circle-outline"} size={18} color={message === t("phase7.admin.actionError") ? colors.danger : colors.success}/>
          <AppText weight="medium" style={{ color: message === t("phase7.admin.actionError") ? colors.danger : colors.success }}>{message}</AppText>
        </View> : null}

        {loadIssues.length > 0 ? <View style={[styles.notice, styles.noticeWarning]}>
          <Ionicons name="warning-outline" size={18} color={colors.warning}/>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText weight="semibold" style={{ color: colors.warning }}>{t("phase7.admin.loadError")}</AppText>
            <AppText variant="caption" forceLtr style={{ color: colors.warning }}>{loadIssues.join(" · ")}</AppText>
          </View>
        </View> : null}

        {loading?<DataLoadingState variant={section==="dashboard"?"dashboard":"list"} minHeight={360}/>:<>
          {section === "dashboard" ? <DashboardSection data={analytics} days={analyticsDays} onDays={setAnalyticsDays} setSection={selectSection} /> : null}
          {section === "analytics" ? <AdminAnalyticsSection data={analytics} days={analyticsDays} onDays={setAnalyticsDays}/> : null}
          {section === "users" ? <AdminUsersPhase3Section users={users} query={queryDraft} setQuery={setQueryDraft} page={page} total={userTotal} onPage={setPage} sort={sort} onSort={updateSort} reason={reason} setReason={setReason} loading={loading} busy={busy} reload={submitSearch} action={action} token={token!} t={t} isRTL={isRTL}
            statusFilter={statusFilter} onStatusFilter={value=>{setStatusFilter(value);setPage(1);setSelectedUserId(null);}}
            roleFilter={roleFilter} onRoleFilter={value=>{setRoleFilter(value);setPage(1);setSelectedUserId(null);}}
            cityFilter={cityFilter} onCityFilter={value=>{setCityFilter(value);setPage(1);setSelectedUserId(null);}}
            selectedUserId={selectedUserId} onSelectedUserId={setSelectedUserId}/> : null}
          {section === "manualTeams" ? <ManualTeamsAdminSection /> : null}
          {section === "venues" ? <AdminOperationsPhase4Section key="VENUE" kind="VENUE" token={token!}
            reason={reason} setReason={setReason} busy={busy} action={action}
            refreshVersion={operationRefresh}/> : null}
          {section === "teams" ? <AdminOperationsPhase4Section key="TEAM" kind="TEAM" token={token!}
            reason={reason} setReason={setReason} busy={busy} action={action}
            refreshVersion={operationRefresh}/> : null}
          {section === "competitions" ? <AdminOperationsPhase4Section key="COMPETITION" kind="COMPETITION" token={token!}
            reason={reason} setReason={setReason} busy={busy} action={action}
            refreshVersion={operationRefresh}/> : null}
          {section === "referees" ? <AdminOperationsPhase4Section key="REFEREE" kind="REFEREE" token={token!}
            reason={reason} setReason={setReason} busy={busy} action={action}
            refreshVersion={operationRefresh}/> : null}
          {section === "reservations" ? <AdminOperationsPhase4Section key="RESERVATION" kind="RESERVATION" token={token!}
            reason={reason} setReason={setReason} busy={busy} action={action}
            refreshVersion={operationRefresh}/> : null}
          {section === "cases" ? <AdminOperationsPhase4Section key="CASE" kind="CASE" token={token!}
            reason={reason} setReason={setReason} busy={busy} action={action}
            refreshVersion={operationRefresh}/> : null}
          {section === "subscriptions" ? <SubscriptionsSection roleSubscriptions={roleSubscriptions} venues={venues} payments={payments} paymentVenueId={paymentVenueId} setPayments={setPayments} setPaymentVenueId={setPaymentVenueId} months={months} setMonths={setMonths} amountAfn={amountAfn} setAmountAfn={setAmountAfn} paymentRef={paymentRef} setPaymentRef={setPaymentRef} trialHours={trialHours} setTrialHours={setTrialHours} reason={reason} setReason={setReason} busy={busy} action={action} token={token!} t={t} isRTL={isRTL} /> : null}
          {section === "subscriptions" && token ? <TeamSlotsAdminSection token={token}/> : null}
          {section === "configuration" ? <ConfigurationSection settings={settings} monthly={monthly} setMonthly={setMonthly} annual={annual} setAnnual={setAnnual} configTrialHours={configTrialHours} setConfigTrialHours={setConfigTrialHours} busy={busy} action={action} token={token!} t={t} /> : null}
          {section === "support" ? <SupportSection targetType={supportTargetType} setTargetType={setSupportTargetType} targetId={supportTargetId} setTargetId={setSupportTargetId} note={supportNote} setNote={setSupportNote} busy={busy} action={action} token={token!} t={t} /> : null}
          {section === "moderation" ? <ModerationSection postId={postId} setPostId={setPostId} promotionId={promotionId} setPromotionId={setPromotionId} reason={reason} setReason={setReason} busy={busy} action={action} token={token!} t={t} /> : null}
          {section === "audit" ? <AuditSection audit={audit} t={t} /> : null}
        </>}
      </ScrollView>
      <AdminConfirmModal visible={pending!==null} target={pending?.target??""}
        reason={pending?.reason??""} busy={busy} error={confirmError}
        onCancel={()=>{if(!busy){setPending(null);setConfirmError(null);}}}
        onConfirm={()=>void confirmPending()}/>
    </View>
  </View>;
}
