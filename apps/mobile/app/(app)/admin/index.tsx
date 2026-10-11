import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type {
  AdminAuditLogDto,
  AdminDashboardResponse,
  AdminRoleSubscriptionDto,
  AdminUserDto,
  AdminVenueDto,
  PlatformSettingsDto,
  SubscriptionPaymentDto,
} from "@leaguekick/contracts";
import { useCallback, useEffect, useState } from "react";
import { styles } from "../../../src/components/admin/AdminStyles";
import { adminNavItems, type SectionKey } from "../../../src/components/admin/admin-navigation";
import { DashboardSection } from "../../../src/components/admin/AdminDashboardSection";
import { UsersSection, VenuesSection } from "../../../src/components/admin/AdminDirectorySections";
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
  const [roleSubscriptions, setRoleSubscriptions] = useState<AdminRoleSubscriptionDto[]>([]);
  const [paymentVenueId, setPaymentVenueId] = useState("");

  const [query, setQuery] = useState("");
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
      loadPart("role subscriptions", () => adminApi.roleSubscriptions(token), (data) => setRoleSubscriptions(data.subscriptions)),
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
    if (failures.length === 7) setMessage(t("phase7.admin.loadError"));
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

        {loading?<DataLoadingState variant="dashboard" minHeight={520}/>:<>
          {section === "dashboard" ? <DashboardSection dashboard={dashboard} setSection={setSection} t={t} /> : null}
          {section === "users" ? <UsersSection users={users} query={query} setQuery={setQuery} reason={reason} setReason={setReason} loading={loading} busy={busy} reload={load} action={action} token={token!} t={t} isRTL={isRTL} /> : null}
          {section === "manualTeams" ? <ManualTeamsAdminSection /> : null}
          {section === "venues" ? <VenuesSection venues={venues} duplicates={duplicates} query={query} setQuery={setQuery} reason={reason} setReason={setReason} loading={loading} busy={busy} reload={load} action={action} token={token!} t={t} isRTL={isRTL} /> : null}
          {section === "subscriptions" ? <SubscriptionsSection roleSubscriptions={roleSubscriptions} venues={venues} payments={payments} paymentVenueId={paymentVenueId} setPayments={setPayments} setPaymentVenueId={setPaymentVenueId} months={months} setMonths={setMonths} amountAfn={amountAfn} setAmountAfn={setAmountAfn} paymentRef={paymentRef} setPaymentRef={setPaymentRef} trialHours={trialHours} setTrialHours={setTrialHours} reason={reason} setReason={setReason} busy={busy} action={action} token={token!} t={t} isRTL={isRTL} /> : null}
          {section === "subscriptions" && token ? <TeamSlotsAdminSection token={token}/> : null}
          {section === "configuration" ? <ConfigurationSection settings={settings} monthly={monthly} setMonthly={setMonthly} annual={annual} setAnnual={setAnnual} configTrialHours={configTrialHours} setConfigTrialHours={setConfigTrialHours} busy={busy} action={action} token={token!} t={t} /> : null}
          {section === "support" ? <SupportSection targetType={supportTargetType} setTargetType={setSupportTargetType} targetId={supportTargetId} setTargetId={setSupportTargetId} note={supportNote} setNote={setSupportNote} busy={busy} action={action} token={token!} t={t} /> : null}
          {section === "moderation" ? <ModerationSection postId={postId} setPostId={setPostId} promotionId={promotionId} setPromotionId={setPromotionId} reason={reason} setReason={setReason} busy={busy} action={action} token={token!} t={t} /> : null}
          {section === "audit" ? <AuditSection audit={audit} t={t} /> : null}
        </>}
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
