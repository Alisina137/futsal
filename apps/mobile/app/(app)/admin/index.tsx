import { colors, spacing } from "@leaguekick/design-tokens";
import type {
  AdminAuditLogDto,
  AdminDashboardResponse,
  AdminUserDto,
  AdminVenueDto,
  PlatformSettingsDto,
  SubscriptionPaymentDto,
} from "@leaguekick/contracts";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { adminApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function AdminScreen() {
  const { session } = useAuth();
  const { t, isRTL } = useLocale();
  const token = session?.accessToken;
  const isAdmin = session?.user.roles.includes("PLATFORM_ADMIN") ?? false;

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

  const load = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    setMessage(null);
    try {
      const [dashboardData, userData, venueData, duplicateData, auditData, settingsData] = await Promise.all([
        adminApi.dashboard(token),
        adminApi.users(token, query),
        adminApi.venues(token, query),
        adminApi.duplicateVenues(token),
        adminApi.audit(token),
        adminApi.settings(token),
      ]);
      setDashboard(dashboardData);
      setUsers(userData.users);
      setVenues(venueData.venues);
      setDuplicates(duplicateData.groups);
      setAudit(auditData.logs);
      setSettings(settingsData.settings);
      setMonthly(String(settingsData.settings.monthlyPriceAfn));
      setAnnual(String(settingsData.settings.annualPriceAfn));
      setConfigTrialHours(String(settingsData.settings.trialDurationHours));
    } catch {
      setMessage(t("phase7.admin.loadError"));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, query, t, token]);

  useEffect(() => { void load(); }, []);

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

  if (!isAdmin) return <Screen showHeader><Card><AppText style={{ color: colors.danger }}>{t("phase7.admin.denied")}</AppText></Card></Screen>;

  return <Screen showHeader>
    <View style={{ gap: spacing.xs }}>
      <AppText variant="title" weight="bold">{t("phase7.admin.title")}</AppText>
      <AppText muted>{t("phase7.admin.subtitle")}</AppText>
    </View>

    <Button label={t("common.retry")} onPress={() => void load()} loading={loading} variant="secondary" />
    {message ? <AppText style={{ color: message === t("phase7.admin.actionError") ? colors.danger : colors.success }}>{message}</AppText> : null}

    {dashboard ? <Card>
      <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.dashboard")}</AppText>
      <Row rtl={isRTL} label={t("phase7.admin.activeUsers")} value={String(dashboard.activeUsers)} />
      <Row rtl={isRTL} label={t("phase7.admin.activeVenues")} value={String(dashboard.activeVenues)} />
      <Row rtl={isRTL} label={t("phase7.admin.pendingVerification")} value={String(dashboard.pendingVenueVerifications)} />
      <Row rtl={isRTL} label={t("phase7.admin.trials")} value={String(dashboard.trialVenues)} />
      <Row rtl={isRTL} label={t("phase7.admin.paid")} value={String(dashboard.paidVenues)} />
      <Row rtl={isRTL} label={t("phase7.admin.expired")} value={String(dashboard.expiredVenues)} />
      <Row rtl={isRTL} label={t("phase7.admin.payments")} value={`${dashboard.recordedPaymentsAfn} AFN`} ltr />
      <Row rtl={isRTL} label={t("phase7.admin.gmv")} value={`${dashboard.bookingGmvAfn} AFN`} ltr />
    </Card> : null}

    <Card>
      <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.search")}</AppText>
      <TextField label={t("phase7.admin.searchHint")} value={query} onChangeText={setQuery} />
      <TextField label={t("phase7.admin.reason")} value={reason} onChangeText={setReason} multiline />
      <Button label={t("phase7.admin.search")} onPress={() => void load()} loading={loading} />
    </Card>

    <Card>
      <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.venues")}</AppText>
      <AppText variant="caption" muted>{t("phase7.admin.duplicateCount", { count: duplicates.length })}</AppText>
      {venues.map((venue) => <View key={venue.id} style={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
        <AppText weight="bold">{venue.name}</AppText>
        <AppText variant="caption">{venue.city} · {venue.verificationStatus} · {venue.subscriptionState}</AppText>
        <AppText variant="caption" forceLtr>{venue.id}</AppText>
        <View style={{ flexDirection: isRTL ? "row-reverse" : "row", flexWrap: "wrap", gap: spacing.xs }}>
          <Button label={t("phase7.admin.verify")} onPress={() => void action(() => adminApi.venueAction(token!, venue.id, { action: "VERIFY", reason }), t("phase7.admin.updated"))} disabled={busy || reason.trim().length < 3} variant="secondary" />
          <Button label={venue.status === "SUSPENDED" ? t("phase7.admin.restore") : t("phase7.admin.suspend")} onPress={() => void action(() => adminApi.venueAction(token!, venue.id, { action: venue.status === "SUSPENDED" ? "RESTORE" : "SUSPEND", reason }), t("phase7.admin.updated"))} disabled={busy || reason.trim().length < 3} variant="secondary" />
        </View>
        <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: spacing.xs }}>
          <TextField label={t("phase7.admin.months")} value={months} onChangeText={setMonths} keyboardType="number-pad" forceLtr containerStyle={{ flex: 1 }} />
          <TextField label={t("phase7.admin.amount")} value={amountAfn} onChangeText={setAmountAfn} keyboardType="number-pad" forceLtr containerStyle={{ flex: 1 }} />
        </View>
        <Button label={t("phase7.admin.activate")} onPress={() => void action(
          () => adminApi.activateSubscription(token!, venue.id, { months: Number(months), amountAfn: Number(amountAfn), provider: "MANUAL", providerReference: "", note: reason }),
          t("phase7.admin.activated"),
        )} disabled={busy || reason.trim().length < 3} />
        <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: spacing.xs }}>
          <TextField label={t("phase7.admin.trialHours")} value={trialHours} onChangeText={setTrialHours} keyboardType="number-pad" forceLtr containerStyle={{ flex: 1 }} />
          <Button label={t("phase7.admin.extendTrial")} onPress={() => void action(
            () => adminApi.extendTrial(token!, venue.id, { hours: Number(trialHours), reason }),
            t("phase7.admin.updated"),
          )} disabled={busy || reason.trim().length < 3} variant="secondary" style={{ flex: 1 }} />
        </View>
        <Button label={t("phase7.admin.paymentHistory")} onPress={() => void action(async () => {
          const result = await adminApi.payments(token!, venue.id);
          setPaymentVenueId(venue.id);
          setPayments(result.payments);
        }, t("phase7.admin.paymentsLoaded"), false)} variant="secondary" />
      </View>)}
    </Card>

    {paymentVenueId ? <Card>
      <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.paymentHistory")}</AppText>
      <AppText variant="caption" forceLtr>{paymentVenueId}</AppText>
      {payments.length === 0 ? <AppText muted>{t("phase7.subscription.noPayments")}</AppText> : payments.map((payment) => <View key={payment.id} style={{ gap: spacing.xs, paddingVertical: spacing.sm }}>
        <AppText weight="semibold" forceLtr>{payment.amountAfn} AFN · {payment.provider}</AppText>
        <AppText variant="caption">{payment.status}</AppText>
        {payment.status === "RECORDED" ? <Button label={t("phase7.admin.voidPayment")} onPress={() => void action(
          () => adminApi.voidPayment(token!, payment.id, reason),
          t("phase7.admin.updated"),
        )} disabled={busy || reason.trim().length < 3} variant="danger" /> : null}
      </View>)}
    </Card> : null}

    <Card>
      <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.users")}</AppText>
      {users.map((user) => <View key={user.id} style={{ gap: spacing.xs, paddingVertical: spacing.sm }}>
        <AppText weight="semibold">{user.displayName}</AppText>
        <AppText variant="caption" forceLtr>{user.phone} · {user.status}</AppText>
        <Button label={user.status === "SUSPENDED" ? t("phase7.admin.restore") : t("phase7.admin.suspend")} onPress={() => void action(
          () => adminApi.setUserStatus(token!, user.id, { status: user.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED", reason }),
          t("phase7.admin.updated"),
        )} disabled={busy || reason.trim().length < 3} variant="secondary" />
      </View>)}
    </Card>

    {settings ? <Card>
      <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.configuration")}</AppText>
      <TextField label={t("phase7.subscription.monthly")} value={monthly} onChangeText={setMonthly} keyboardType="number-pad" forceLtr />
      <TextField label={t("phase7.subscription.annual")} value={annual} onChangeText={setAnnual} keyboardType="number-pad" forceLtr />
      <TextField label={t("phase7.admin.trialHours")} value={configTrialHours} onChangeText={setConfigTrialHours} keyboardType="number-pad" forceLtr />
      <Button label={t("common.save")} onPress={() => void action(
        () => adminApi.updateSettings(token!, {
          monthlyPriceAfn: Number(monthly),
          annualPriceAfn: Number(annual),
          trialDurationHours: Number(configTrialHours),
          featureFlags: settings.featureFlags,
        }),
        t("phase7.admin.updated"),
      )} disabled={busy} />
    </Card> : null}

    <Card>
      <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.support")}</AppText>
      <Button label={supportTargetType === "VENUE" ? t("phase7.admin.targetVenue") : t("phase7.admin.targetUser")} onPress={() => setSupportTargetType((value) => value === "VENUE" ? "USER" : "VENUE")} variant="secondary" />
      <TextField label={t("phase7.admin.targetId")} value={supportTargetId} onChangeText={setSupportTargetId} forceLtr />
      <TextField label={t("phase7.admin.note")} value={supportNote} onChangeText={setSupportNote} multiline />
      <Button label={t("phase7.admin.addNote")} onPress={() => void action(
        () => adminApi.supportNote(token!, supportTargetType, supportTargetId, supportNote),
        t("phase7.admin.updated"),
      )} disabled={busy || !supportTargetId || supportNote.trim().length < 3} />
    </Card>

    <Card>
      <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.moderation")}</AppText>
      <TextField label={t("phase7.admin.postId")} value={postId} onChangeText={setPostId} forceLtr />
      <Button label={t("phase7.admin.unpublishPost")} onPress={() => void action(
        () => adminApi.unpublishPost(token!, postId, reason),
        t("phase7.admin.updated"),
      )} disabled={busy || !postId || reason.trim().length < 3} variant="secondary" />
      <TextField label={t("phase7.admin.promotionId")} value={promotionId} onChangeText={setPromotionId} forceLtr />
      <Button label={t("phase7.admin.closePromotion")} onPress={() => void action(
        () => adminApi.closePromotion(token!, promotionId, reason),
        t("phase7.admin.updated"),
      )} disabled={busy || !promotionId || reason.trim().length < 3} variant="secondary" />
    </Card>

    <Card>
      <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.audit")}</AppText>
      {audit.slice(0, 30).map((item) => <View key={item.id} style={{ gap: 2, paddingVertical: spacing.xs }}>
        <AppText weight="semibold">{item.action}</AppText>
        <AppText variant="caption" muted>{item.targetType} · {item.targetId ?? "-"}</AppText>
      </View>)}
    </Card>
  </Screen>;
}

function Row({ label, value, rtl, ltr = false }: { label: string; value: string; rtl: boolean; ltr?: boolean }) {
  return <View style={{ flexDirection: rtl ? "row-reverse" : "row", justifyContent: "space-between", gap: spacing.md }}>
    <AppText muted>{label}</AppText>
    <AppText weight="semibold" forceLtr={ltr}>{value}</AppText>
  </View>;
}
