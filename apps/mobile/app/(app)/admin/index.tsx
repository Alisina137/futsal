import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type {
  AdminAuditLogDto,
  AdminDashboardResponse,
  AdminUserDto,
  AdminVenueDto,
  PlatformSettingsDto,
  SubscriptionPaymentDto,
} from "@leaguekick/contracts";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { adminApi, ApiRequestError } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

type SectionKey =
  | "dashboard"
  | "users"
  | "venues"
  | "subscriptions"
  | "configuration"
  | "support"
  | "moderation"
  | "audit";

type IconName = keyof typeof Ionicons.glyphMap;

const adminNavItems: Array<{ key: SectionKey; icon: IconName; labelKey: string }> = [
  { key: "dashboard", icon: "grid-outline", labelKey: "phase7.admin.dashboard" },
  { key: "users", icon: "people-outline", labelKey: "phase7.admin.users" },
  { key: "venues", icon: "business-outline", labelKey: "phase7.admin.venues" },
  { key: "subscriptions", icon: "card-outline", labelKey: "phase7.admin.payments" },
  { key: "configuration", icon: "options-outline", labelKey: "phase7.admin.configuration" },
  { key: "support", icon: "help-buoy-outline", labelKey: "phase7.admin.support" },
  { key: "moderation", icon: "shield-checkmark-outline", labelKey: "phase7.admin.moderation" },
  { key: "audit", icon: "document-text-outline", labelKey: "phase7.admin.audit" },
];

export default function AdminScreen() {
  const { session, signOut } = useAuth();
  const { t, isRTL } = useLocale();
  const { width } = useWindowDimensions();
  const desktop = width >= 980;
  const token = session?.accessToken;
  const isAdmin = session?.user.roles.includes("PLATFORM_ADMIN") ?? false;
  const [section, setSection] = useState<SectionKey>("dashboard");

  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [venues, setVenues] = useState<AdminVenueDto[]>([]);
  const [duplicates, setDuplicates] = useState<AdminVenueDto[][]>([]);
  const [audit, setAudit] = useState<AdminAuditLogDto[]>([]);
  const [settings, setSettings] = useState<PlatformSettingsDto | null>(null);
  const [payments, setPayments] = useState<SubscriptionPaymentDto[]>([]);
  const [paymentVenueId, setPaymentVenueId] = useState("");

  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("");
  const [months, setMonths] = useState("1");
  const [amountAfn, setAmountAfn] = useState("1500");
  const [paymentRef, setPaymentRef] = useState("");
  const [trialHours, setTrialHours] = useState("72");
  const [monthly, setMonthly] = useState("1500");
  const [annual, setAnnual] = useState("15000");
  const [configTrialHours, setConfigTrialHours] = useState("72");
  const [supportTargetType, setSupportTargetType] = useState<"USER" | "VENUE">("VENUE");
  const [supportTargetId, setSupportTargetId] = useState("");
  const [supportNote, setSupportNote] = useState("");
  const [postId, setPostId] = useState("");
  const [promotionId, setPromotionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [loadIssues, setLoadIssues] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    setMessage(null);
    setLoadIssues([]);

    const failures: string[] = [];
    const describeFailure = (label: string, error: unknown) => {
      if (error instanceof ApiRequestError) {
        const status = error.status ? ` HTTP ${error.status}` : "";
        return `${label}: ${error.code}${status}`;
      }
      return `${label}: UNKNOWN_ERROR`;
    };
    const loadPart = async <T,>(
      label: string,
      task: () => Promise<T>,
      apply: (value: T) => void,
    ) => {
      try {
        apply(await task());
      } catch (error) {
        failures.push(describeFailure(label, error));
      }
    };

    await Promise.all([
      loadPart("dashboard", () => adminApi.dashboard(token), setDashboard),
      loadPart("users", () => adminApi.users(token, query), (data) => setUsers(data.users)),
      loadPart("venues", () => adminApi.venues(token, query), (data) => setVenues(data.venues)),
      loadPart("duplicates", () => adminApi.duplicateVenues(token), (data) => setDuplicates(data.groups)),
      loadPart("audit", () => adminApi.audit(token), (data) => setAudit(data.logs)),
      loadPart("settings", () => adminApi.settings(token), (data) => {
        setSettings(data.settings);
        setMonthly(String(data.settings.monthlyPriceAfn));
        setAnnual(String(data.settings.annualPriceAfn));
        setConfigTrialHours(String(data.settings.trialDurationHours));
      }),
    ]);

    setLoadIssues(failures);
    if (failures.length === 6) setMessage(t("phase7.admin.loadError"));
    setLoading(false);
  }, [isAdmin, query, t, token]);

  useEffect(() => { void load(); }, [load]);

  async function action(task: () => Promise<unknown>, success: string, refresh = true) {
    setBusy(true);
    setMessage(null);
    try {
      await task();
      setMessage(success);
      if (refresh) await load();
    } catch {
      setMessage(t("phase7.admin.actionError"));
    } finally {
      setBusy(false);
    }
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

  const sectionTitle = t((adminNavItems.find((item) => item.key === section)?.labelKey ?? "phase7.admin.dashboard") as never);

  return <View style={[styles.adminRoot, { flexDirection: desktop ? (isRTL ? "row-reverse" : "row") : "column" }]}>
    <AdminSidebar
      desktop={desktop}
      isRTL={isRTL}
      section={section}
      onSelect={setSection}
      displayName={session?.user.displayName ?? session?.user.username ?? ""}
      username={session?.user.username ?? ""}
      onSignOut={() => void signOut()}
      t={t}
    />

    <View style={styles.workspace}>
      <View style={[styles.topbar, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={styles.topbarCopy}>
          <AppText variant="title" weight="bold">{sectionTitle}</AppText>
          <AppText muted>{t("phase7.admin.subtitle")}</AppText>
        </View>
        <View style={[styles.topbarActions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={16} color={colors.success}/>
            <AppText variant="caption" weight="bold" style={{ color: colors.success }}>PLATFORM_ADMIN</AppText>
          </View>
          <Button label={t("common.retry")} onPress={() => void load()} loading={loading} variant="secondary" />
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

        {section === "dashboard" ? <DashboardSection dashboard={dashboard} setSection={setSection} t={t} /> : null}
        {section === "users" ? <UsersSection users={users} query={query} setQuery={setQuery} reason={reason} setReason={setReason} loading={loading} busy={busy} reload={load} action={action} token={token!} t={t} isRTL={isRTL} /> : null}
        {section === "venues" ? <VenuesSection venues={venues} duplicates={duplicates} query={query} setQuery={setQuery} reason={reason} setReason={setReason} loading={loading} busy={busy} reload={load} action={action} token={token!} t={t} isRTL={isRTL} /> : null}
        {section === "subscriptions" ? <SubscriptionsSection venues={venues} payments={payments} paymentVenueId={paymentVenueId} setPayments={setPayments} setPaymentVenueId={setPaymentVenueId} months={months} setMonths={setMonths} amountAfn={amountAfn} setAmountAfn={setAmountAfn} paymentRef={paymentRef} setPaymentRef={setPaymentRef} trialHours={trialHours} setTrialHours={setTrialHours} reason={reason} setReason={setReason} busy={busy} action={action} token={token!} t={t} isRTL={isRTL} /> : null}
        {section === "configuration" ? <ConfigurationSection settings={settings} monthly={monthly} setMonthly={setMonthly} annual={annual} setAnnual={setAnnual} configTrialHours={configTrialHours} setConfigTrialHours={setConfigTrialHours} busy={busy} action={action} token={token!} t={t} /> : null}
        {section === "support" ? <SupportSection targetType={supportTargetType} setTargetType={setSupportTargetType} targetId={supportTargetId} setTargetId={setSupportTargetId} note={supportNote} setNote={setSupportNote} busy={busy} action={action} token={token!} t={t} /> : null}
        {section === "moderation" ? <ModerationSection postId={postId} setPostId={setPostId} promotionId={promotionId} setPromotionId={setPromotionId} reason={reason} setReason={setReason} busy={busy} action={action} token={token!} t={t} /> : null}
        {section === "audit" ? <AuditSection audit={audit} t={t} /> : null}
      </ScrollView>
    </View>
  </View>;
}

function AdminSidebar({
  desktop, isRTL, section, onSelect, displayName, username, onSignOut, t,
}: {
  desktop: boolean;
  isRTL: boolean;
  section: SectionKey;
  onSelect: (section: SectionKey) => void;
  displayName: string;
  username: string;
  onSignOut: () => void;
  t: (key: any, params?: Record<string, string | number>) => string;
}) {
  return <View style={[styles.sidebar, desktop ? styles.sidebarDesktop : styles.sidebarCompact]}>
    <View style={[styles.brand, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
      <View style={styles.brandMark}><Ionicons name="football" size={24} color="#FFFFFF"/></View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyLarge" weight="bold" style={{ color: "#FFFFFF" }}>Futsal Admin</AppText>
        <AppText variant="caption" style={{ color: "#AFC5E8" }}>{t("phase7.admin.subtitle")}</AppText>
      </View>
    </View>

    <View style={[styles.nav, !desktop && styles.navCompact]}>
      {adminNavItems.map((item) => {
        const active = section === item.key;
        return <Pressable
          key={item.key}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          onPress={() => onSelect(item.key)}
          style={({ pressed }) => [
            styles.navItem,
            !desktop && styles.navItemCompact,
            { flexDirection: isRTL ? "row-reverse" : "row" },
            active && styles.navItemActive,
            pressed && styles.navItemPressed,
          ]}
        >
          <Ionicons name={item.icon} size={20} color={active ? "#FFFFFF" : "#AFC5E8"}/>
          <AppText weight={active ? "bold" : "medium"} style={{ color: active ? "#FFFFFF" : "#DCE8FA" }}>
            {t(item.labelKey as never)}
          </AppText>
        </Pressable>;
      })}
    </View>

    {desktop ? <View style={styles.sidebarFooter}>
      <View style={styles.adminIdentity}>
        <View style={styles.avatar}><Ionicons name="person" size={18} color={colors.primary}/></View>
        <View style={{ flex: 1 }}>
          <AppText weight="semibold" style={{ color: "#FFFFFF" }}>{displayName}</AppText>
          {username ? <AppText variant="caption" style={{ color: "#AFC5E8" }} forceLtr>@{username}</AppText> : null}
        </View>
      </View>
      <Pressable style={styles.sidebarSignOut} onPress={onSignOut}>
        <Ionicons name="log-out-outline" size={19} color="#FCA5A5"/>
        <AppText weight="semibold" style={{ color: "#FCA5A5" }}>{t("common.signOut")}</AppText>
      </Pressable>
    </View> : null}
  </View>;
}

function DashboardSection({ dashboard, setSection, t }: { dashboard: AdminDashboardResponse | null; setSection: (section: SectionKey) => void; t: (key: any, params?: Record<string, string | number>) => string }) {
  const metrics = dashboard ? [
    { label: t("phase7.admin.activeUsers"), value: String(dashboard.activeUsers), icon: "people-outline" as const },
    { label: t("phase7.admin.activeVenues"), value: String(dashboard.activeVenues), icon: "business-outline" as const },
    { label: t("phase7.admin.pendingVerification"), value: String(dashboard.pendingVenueVerifications), icon: "hourglass-outline" as const },
    { label: t("phase7.admin.trials"), value: String(dashboard.trialVenues), icon: "timer-outline" as const },
    { label: t("phase7.admin.paid"), value: String(dashboard.paidVenues), icon: "checkmark-circle-outline" as const },
    { label: t("phase7.admin.expired"), value: String(dashboard.expiredVenues), icon: "alert-circle-outline" as const },
    { label: t("phase7.admin.payments"), value: `${dashboard.recordedPaymentsAfn} AFN`, icon: "card-outline" as const },
    { label: t("phase7.admin.gmv"), value: `${dashboard.bookingGmvAfn} AFN`, icon: "analytics-outline" as const },
  ] : [];

  return <>
    <View style={styles.sectionIntro}>
      <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.dashboard")}</AppText>
      <AppText muted>{t("phase7.admin.subtitle")}</AppText>
    </View>

    <View style={styles.metricGrid}>
      {metrics.map((metric) => <View key={metric.label} style={styles.metricCard}>
        <View style={styles.metricIcon}><Ionicons name={metric.icon} size={22} color={colors.primary}/></View>
        <AppText variant="caption" muted>{metric.label}</AppText>
        <AppText variant="title" weight="bold" forceLtr>{metric.value}</AppText>
      </View>)}
    </View>

    <Card style={styles.panel}>
      <AppText variant="bodyLarge" weight="bold">Management</AppText>
      <AppText muted>Open a management area without leaving the admin console.</AppText>
      <View style={styles.quickGrid}>
        {adminNavItems.filter((item) => item.key !== "dashboard").map((item) => <Pressable key={item.key} style={styles.quickCard} onPress={() => setSection(item.key)}>
          <View style={styles.quickIcon}><Ionicons name={item.icon} size={22} color={colors.primary}/></View>
          <AppText weight="semibold">{t(item.labelKey as never)}</AppText>
          <Ionicons name="arrow-forward-outline" size={18} color={colors.textMuted}/>
        </Pressable>)}
      </View>
    </Card>
  </>;
}

function SearchPanel({ query, setQuery, reason, setReason, loading, reload, t }: {
  query: string; setQuery: (value: string) => void; reason: string; setReason: (value: string) => void; loading: boolean; reload: () => Promise<void>; t: (key: any, params?: Record<string, string | number>) => string;
}) {
  return <Card style={styles.panel}>
    <View style={styles.formGrid}>
      <TextField label={t("phase7.admin.searchHint")} value={query} onChangeText={setQuery} containerStyle={styles.flexField}/>
      <TextField label={t("phase7.admin.reason")} value={reason} onChangeText={setReason} containerStyle={styles.flexField}/>
      <Button label={t("phase7.admin.search")} onPress={() => void reload()} loading={loading}/>
    </View>
  </Card>;
}

function UsersSection({ users, query, setQuery, reason, setReason, loading, busy, reload, action, token, t, isRTL }: any) {
  return <>
    <SearchPanel query={query} setQuery={setQuery} reason={reason} setReason={setReason} loading={loading} reload={reload} t={t}/>
    <Card style={styles.panel}>
      <View style={styles.tableHeader}>
        <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.users")}</AppText>
        <View style={styles.countBadge}><AppText variant="caption" weight="bold">{users.length}</AppText></View>
      </View>
      {users.length === 0 ? <AppText muted>No users found.</AppText> : users.map((user: AdminUserDto) => <View key={user.id} style={[styles.dataRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={styles.rowIdentity}>
          <View style={styles.avatar}><Ionicons name="person" size={18} color={colors.primary}/></View>
          <View style={{ flex: 1 }}>
            <AppText weight="semibold">{user.displayName}</AppText>
            <AppText variant="caption" muted forceLtr>{user.phone}</AppText>
          </View>
        </View>
        <View style={user.status === "SUSPENDED" ? styles.statusDanger : styles.statusSuccess}>
          <AppText variant="caption" weight="bold" style={{ color: user.status === "SUSPENDED" ? colors.danger : colors.success }}>{user.status}</AppText>
        </View>
        <Button label={user.status === "SUSPENDED" ? t("phase7.admin.restore") : t("phase7.admin.suspend")} onPress={() => void action(
          () => adminApi.setUserStatus(token, user.id, { status: user.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED", reason }),
          t("phase7.admin.updated"),
        )} disabled={busy || reason.trim().length < 3} variant={user.status === "SUSPENDED" ? "secondary" : "danger"}/>
      </View>)}
    </Card>
  </>;
}

function VenuesSection({ venues, duplicates, query, setQuery, reason, setReason, loading, busy, reload, action, token, t, isRTL }: any) {
  return <>
    <SearchPanel query={query} setQuery={setQuery} reason={reason} setReason={setReason} loading={loading} reload={reload} t={t}/>
    <Card style={styles.panel}>
      <View style={styles.tableHeader}>
        <View>
          <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.venues")}</AppText>
          <AppText variant="caption" muted>{t("phase7.admin.duplicateCount", { count: duplicates.length })}</AppText>
        </View>
        <View style={styles.countBadge}><AppText variant="caption" weight="bold">{venues.length}</AppText></View>
      </View>
      {venues.map((venue: AdminVenueDto) => <View key={venue.id} style={styles.venueBlock}>
        <View style={[styles.dataRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={styles.rowIdentity}>
            <View style={styles.avatar}><Ionicons name="business" size={18} color={colors.primary}/></View>
            <View style={{ flex: 1 }}>
              <AppText weight="semibold">{venue.name}</AppText>
              <AppText variant="caption" muted>{venue.city} · {venue.status} · {venue.verificationStatus}</AppText>
              <AppText variant="caption" muted forceLtr>{venue.id}</AppText>
            </View>
          </View>
          <View style={styles.rowActions}>
            <Button label={t("phase7.admin.verify")} onPress={() => void action(() => adminApi.venueAction(token, venue.id, { action: "VERIFY", reason }), t("phase7.admin.updated"))} disabled={busy || reason.trim().length < 3} variant="secondary"/>
            <Button label={t("phase7.admin.reject")} onPress={() => void action(() => adminApi.venueAction(token, venue.id, { action: "REJECT", reason }), t("phase7.admin.updated"))} disabled={busy || reason.trim().length < 3} variant="secondary"/>
            <Button label={venue.status === "SUSPENDED" ? t("phase7.admin.restore") : t("phase7.admin.suspend")} onPress={() => void action(() => adminApi.venueAction(token, venue.id, { action: venue.status === "SUSPENDED" ? "RESTORE" : "SUSPEND", reason }), t("phase7.admin.updated"))} disabled={busy || reason.trim().length < 3} variant={venue.status === "SUSPENDED" ? "secondary" : "danger"}/>
          </View>
        </View>
      </View>)}
    </Card>

    {duplicates.length > 0 ? <Card style={styles.panel}>
      <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.duplicateReview")}</AppText>
      <AppText variant="caption" muted>{t("phase7.admin.duplicateReviewBody")}</AppText>
      {duplicates.map((group: AdminVenueDto[], groupIndex: number) => <View key={`duplicate-${groupIndex}`} style={styles.duplicateGroup}>
        <AppText weight="semibold">{t("phase7.admin.duplicateGroup", { number: groupIndex + 1, count: group.length })}</AppText>
        {group.map((venue) => <AppText key={venue.id} variant="caption">{venue.name} · {venue.city} · {venue.address}</AppText>)}
      </View>)}
    </Card> : null}
  </>;
}

function SubscriptionsSection({ venues, payments, paymentVenueId, setPayments, setPaymentVenueId, months, setMonths, amountAfn, setAmountAfn, paymentRef, setPaymentRef, trialHours, setTrialHours, reason, setReason, busy, action, token, t, isRTL }: any) {
  return <>
    <Card style={styles.panel}>
      <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.payments")}</AppText>
      <TextField label={t("phase7.admin.reason")} value={reason} onChangeText={setReason}/>
      <AppText variant="caption" muted>Choose a venue below to activate a subscription, extend a trial, or inspect payment history.</AppText>
    </Card>

    {venues.map((venue: AdminVenueDto) => <Card key={venue.id} style={styles.panel}>
      <View style={[styles.tableHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={{ flex: 1 }}>
          <AppText weight="bold">{venue.name}</AppText>
          <AppText variant="caption" muted>{venue.city} · {venue.subscriptionState}</AppText>
        </View>
        <AppText variant="caption" muted forceLtr>{venue.id}</AppText>
      </View>
      <View style={styles.formGrid}>
        <TextField label={t("phase7.admin.months")} value={months} onChangeText={setMonths} keyboardType="number-pad" forceLtr containerStyle={styles.smallField}/>
        <TextField label={t("phase7.admin.amount")} value={amountAfn} onChangeText={setAmountAfn} keyboardType="number-pad" forceLtr containerStyle={styles.smallField}/>
        <TextField label={t("phase7.admin.paymentReference")} value={paymentRef} onChangeText={setPaymentRef} forceLtr containerStyle={styles.flexField}/>
      </View>
      <View style={styles.rowActions}>
        <Button label={t("phase7.admin.activate")} onPress={() => void action(
          () => adminApi.activateSubscription(token, venue.id, { months: Number(months), amountAfn: Number(amountAfn), provider: "MANUAL", providerReference: paymentRef, note: reason }),
          t("phase7.admin.activated"),
        )} disabled={busy || reason.trim().length < 3}/>
        <TextField label={t("phase7.admin.trialHours")} value={trialHours} onChangeText={setTrialHours} keyboardType="number-pad" forceLtr containerStyle={styles.smallField}/>
        <Button label={t("phase7.admin.extendTrial")} onPress={() => void action(
          () => adminApi.extendTrial(token, venue.id, { hours: Number(trialHours), reason }),
          t("phase7.admin.updated"),
        )} disabled={busy || reason.trim().length < 3} variant="secondary"/>
        <Button label={t("phase7.admin.paymentHistory")} onPress={() => void action(async () => {
          const result = await adminApi.payments(token, venue.id);
          setPaymentVenueId(venue.id);
          setPayments(result.payments);
        }, t("phase7.admin.paymentsLoaded"), false)} variant="secondary"/>
      </View>
    </Card>)}

    {paymentVenueId ? <Card style={styles.panel}>
      <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.paymentHistory")}</AppText>
      <AppText variant="caption" muted forceLtr>{paymentVenueId}</AppText>
      {payments.length === 0 ? <AppText muted>{t("phase7.subscription.noPayments")}</AppText> : payments.map((payment: SubscriptionPaymentDto) => <View key={payment.id} style={styles.dataRow}>
        <View style={{ flex: 1 }}>
          <AppText weight="semibold" forceLtr>{payment.amountAfn} AFN · {payment.provider}</AppText>
          <AppText variant="caption" muted>{t(`phase7.payment.${payment.status}` as never)}</AppText>
        </View>
        {payment.status === "RECORDED" ? <Button label={t("phase7.admin.voidPayment")} onPress={() => void action(
          () => adminApi.voidPayment(token, payment.id, reason),
          t("phase7.admin.updated"),
        )} disabled={busy || reason.trim().length < 3} variant="danger"/> : null}
      </View>)}
    </Card> : null}
  </>;
}

function ConfigurationSection({ settings, monthly, setMonthly, annual, setAnnual, configTrialHours, setConfigTrialHours, busy, action, token, t }: any) {
  if (!settings) return <Card style={styles.panel}><AppText muted>{t("phase7.admin.loadError")}</AppText></Card>;
  return <Card style={styles.panel}>
    <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.configuration")}</AppText>
    <AppText muted>Manage platform-wide commercial defaults.</AppText>
    <View style={styles.formGrid}>
      <TextField label={t("phase7.subscription.monthly")} value={monthly} onChangeText={setMonthly} keyboardType="number-pad" forceLtr containerStyle={styles.flexField}/>
      <TextField label={t("phase7.subscription.annual")} value={annual} onChangeText={setAnnual} keyboardType="number-pad" forceLtr containerStyle={styles.flexField}/>
      <TextField label={t("phase7.admin.trialHours")} value={configTrialHours} onChangeText={setConfigTrialHours} keyboardType="number-pad" forceLtr containerStyle={styles.flexField}/>
    </View>
    <View style={styles.alignStart}>
      <Button label={t("common.save")} onPress={() => void action(
        () => adminApi.updateSettings(token, {
          monthlyPriceAfn: Number(monthly),
          annualPriceAfn: Number(annual),
          trialDurationHours: Number(configTrialHours),
          featureFlags: settings.featureFlags ?? {},
          notificationTemplates: settings.notificationTemplates ?? {},
        }),
        t("phase7.admin.updated"),
      )} disabled={busy}/>
    </View>
  </Card>;
}

function SupportSection({ targetType, setTargetType, targetId, setTargetId, note, setNote, busy, action, token, t }: any) {
  return <Card style={styles.panel}>
    <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.support")}</AppText>
    <AppText muted>Add an internal support note against a user or venue.</AppText>
    <View style={styles.rowActions}>
      <Button label={targetType === "VENUE" ? t("phase7.admin.targetVenue") : t("phase7.admin.targetUser")} onPress={() => setTargetType((value: "USER" | "VENUE") => value === "VENUE" ? "USER" : "VENUE")} variant="secondary"/>
    </View>
    <TextField label={t("phase7.admin.targetId")} value={targetId} onChangeText={setTargetId} forceLtr/>
    <TextField label={t("phase7.admin.note")} value={note} onChangeText={setNote} multiline/>
    <View style={styles.alignStart}>
      <Button label={t("phase7.admin.addNote")} onPress={() => void action(
        () => adminApi.supportNote(token, targetType, targetId, note),
        t("phase7.admin.updated"),
      )} disabled={busy || !targetId || note.trim().length < 3}/>
    </View>
  </Card>;
}

function ModerationSection({ postId, setPostId, promotionId, setPromotionId, reason, setReason, busy, action, token, t }: any) {
  return <Card style={styles.panel}>
    <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.moderation")}</AppText>
    <AppText muted>Moderate published content and active promotions.</AppText>
    <TextField label={t("phase7.admin.reason")} value={reason} onChangeText={setReason}/>
    <View style={styles.formGrid}>
      <TextField label={t("phase7.admin.postId")} value={postId} onChangeText={setPostId} forceLtr containerStyle={styles.flexField}/>
      <Button label={t("phase7.admin.unpublishPost")} onPress={() => void action(
        () => adminApi.unpublishPost(token, postId, reason),
        t("phase7.admin.updated"),
      )} disabled={busy || !postId || reason.trim().length < 3} variant="danger"/>
    </View>
    <View style={styles.formGrid}>
      <TextField label={t("phase7.admin.promotionId")} value={promotionId} onChangeText={setPromotionId} forceLtr containerStyle={styles.flexField}/>
      <Button label={t("phase7.admin.closePromotion")} onPress={() => void action(
        () => adminApi.closePromotion(token, promotionId, reason),
        t("phase7.admin.updated"),
      )} disabled={busy || !promotionId || reason.trim().length < 3} variant="danger"/>
    </View>
  </Card>;
}

function AuditSection({ audit, t }: { audit: AdminAuditLogDto[]; t: (key: any, params?: Record<string, string | number>) => string }) {
  return <Card style={styles.panel}>
    <View style={styles.tableHeader}>
      <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.audit")}</AppText>
      <View style={styles.countBadge}><AppText variant="caption" weight="bold">{audit.length}</AppText></View>
    </View>
    {audit.length === 0 ? <AppText muted>No audit entries found.</AppText> : audit.slice(0, 50).map((item) => <View key={item.id} style={styles.auditRow}>
      <View style={styles.auditDot}/>
      <View style={{ flex: 1 }}>
        <AppText weight="semibold">{item.action}</AppText>
        <AppText variant="caption" muted>{item.targetType} · {item.targetId ?? "-"}</AppText>
      </View>
    </View>)}
  </Card>;
}

const styles = StyleSheet.create({
  adminRoot: { flex: 1, minHeight: "100%", backgroundColor: "#F3F6FB" },
  sidebar: { backgroundColor: "#071A2B", padding: spacing.lg, gap: spacing.lg },
  sidebarDesktop: { width: 272, minHeight: "100%" },
  sidebarCompact: { width: "100%" },
  brand: { alignItems: "center", gap: spacing.md },
  brandMark: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  nav: { gap: spacing.xs, flex: 1 },
  navCompact: { flexDirection: "row", flexWrap: "wrap", flex: 0 },
  navItem: { minHeight: 46, alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md },
  navItemCompact: { flexGrow: 1, flexBasis: 150 },
  navItemActive: { backgroundColor: "#17447A" },
  navItemPressed: { opacity: 0.8 },
  sidebarFooter: { gap: spacing.md, borderTopWidth: 1, borderTopColor: "#173451", paddingTop: spacing.lg },
  adminIdentity: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sidebarSignOut: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm },
  avatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  workspace: { flex: 1, minWidth: 0 },
  topbar: { minHeight: 92, alignItems: "center", justifyContent: "space-between", gap: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: colors.border },
  topbarCopy: { flex: 1, gap: 2 },
  topbarActions: { alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  adminBadge: { minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: "#EAF8EF", flexDirection: "row", alignItems: "center", gap: spacing.xs },
  scroll: { flex: 1 },
  content: { width: "100%", maxWidth: 1500, alignSelf: "center", padding: spacing.xl, gap: spacing.lg, paddingBottom: 80 },
  notice: { minHeight: 44, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1 },
  noticeSuccess: { backgroundColor: "#EFFAF3", borderColor: "#B8E2C5" },
  noticeError: { backgroundColor: "#FFF3F1", borderColor: "#F2C4BE" },
  noticeWarning: { backgroundColor: "#FFF9E8", borderColor: "#F1D797" },
  sectionIntro: { gap: spacing.xs },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metricCard: { minWidth: 190, flexGrow: 1, flexBasis: 220, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  metricIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  panel: { padding: spacing.lg, gap: spacing.md },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  quickCard: { minWidth: 210, flexGrow: 1, flexBasis: 260, minHeight: 74, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FBFDFF", borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  quickIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  formGrid: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: spacing.md },
  flexField: { flexGrow: 1, flexBasis: 280, minWidth: 220 },
  smallField: { width: 160 },
  tableHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  countBadge: { minWidth: 34, minHeight: 28, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  dataRow: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, flexWrap: "wrap" },
  rowIdentity: { minWidth: 260, flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  statusSuccess: { paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: "#EAF8EF" },
  statusDanger: { paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: "#FFF0EE" },
  venueBlock: { borderTopWidth: 1, borderTopColor: colors.border },
  duplicateGroup: { gap: spacing.xs, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  alignStart: { alignItems: "flex-start" },
  auditRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.sm },
  auditDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  deniedPage: { flex: 1, minHeight: "100%", alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: "#F3F6FB" },
  deniedCard: { width: "100%", maxWidth: 460, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: spacing.md },
  deniedIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: "#FFF0EE", alignItems: "center", justifyContent: "center" },
});
