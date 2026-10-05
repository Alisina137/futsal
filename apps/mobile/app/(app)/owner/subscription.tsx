import { colors, spacing } from "@leaguekick/design-tokens";
import type { OwnerBillingSummary } from "@leaguekick/contracts";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { ownerApi } from "../../../src/lib/api";
import { formatLocalDateTimeParts } from "../../../src/lib/date-time";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function OwnerSubscriptionScreen() {
  const { session } = useAuth();
  const { t, language, isRTL } = useLocale();
  const [data, setData] = useState<OwnerBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      setData(await ownerApi.subscription(session.accessToken));
    } catch {
      setError(t("phase7.subscription.loadError"));
    } finally {
      setLoading(false);
    }
  }, [session, t]);

  useEffect(() => { void load(); }, [load]);

  async function reactivate() {
    if (!session) return;
    setRequesting(true);
    setError(null);
    try {
      await ownerApi.requestReactivation(session.accessToken);
      setRequested(true);
    } catch {
      setError(t("phase7.subscription.reactivationError"));
    } finally {
      setRequesting(false);
    }
  }

  return <Screen showHeader>
    <View style={{ gap: spacing.xs }}>
      <AppText variant="title" weight="bold">{t("phase7.subscription.title")}</AppText>
      <AppText muted>{t("phase7.subscription.subtitle")}</AppText>
    </View>

    {loading ? <AppText>{t("common.loading")}</AppText> : null}
    {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}

    {data ? <>
      <Card>
        <AppText variant="bodyLarge" weight="bold">{t("phase7.subscription.statusTitle")}</AppText>
        <Row rtl={isRTL} label={t("phase7.subscription.state")} value={t(`owner.subscription.${data.subscription.state}` as never)} />
        <Row rtl={isRTL} label={t("phase7.subscription.access")} value={t(`phase7.subscription.access.${data.subscription.accessMode}` as never)} />
        <Row rtl={isRTL} label={t("phase7.subscription.verification")} value={t(`phase7.verification.${data.verificationStatus}` as never)} />
        {data.subscription.trialEndsAt ? <DateRow label={t("owner.trialEnds")} value={data.subscription.trialEndsAt} language={language} rtl={isRTL} /> : null}
        {data.subscription.activeUntil ? <DateRow label={t("phase7.subscription.activeUntil")} value={data.subscription.activeUntil} language={language} rtl={isRTL} /> : null}
        {data.subscription.accessMode === "CONTINUITY" ? <AppText style={{ color: colors.warning }}>{t("phase7.subscription.continuityBody")}</AppText> : null}
        {data.canReactivate ? <Button
          label={requested ? t("phase7.subscription.requested") : t("phase7.subscription.reactivate")}
          onPress={() => void reactivate()}
          loading={requesting}
          disabled={requested}
        /> : null}
      </Card>

      <Card>
        <AppText variant="bodyLarge" weight="bold">{t("phase7.subscription.planTitle")}</AppText>
        <Row rtl={isRTL} label={t("phase7.subscription.monthly")} value={`${data.settings.monthlyPriceAfn} AFN`} ltr />
        <Row rtl={isRTL} label={t("phase7.subscription.annual")} value={`${data.settings.annualPriceAfn} AFN`} ltr />
        <Row rtl={isRTL} label={t("phase7.subscription.trialHours")} value={String(data.settings.trialDurationHours)} ltr />
      </Card>

      <Card>
        <AppText variant="bodyLarge" weight="bold">{t("phase7.subscription.historyTitle")}</AppText>
        {data.payments.length === 0 ? <AppText muted>{t("phase7.subscription.noPayments")}</AppText> : data.payments.map((payment) => {
          const date = formatLocalDateTimeParts(payment.createdAt, language);
          return <View key={payment.id} style={{ gap: spacing.xs, paddingVertical: spacing.sm }}>
            <AppText weight="semibold" forceLtr>{payment.amountAfn} AFN · {payment.provider}</AppText>
            <AppText variant="caption" muted>{date.date} · {date.time}</AppText>
            {payment.providerReference ? <AppText variant="caption" forceLtr>{payment.providerReference}</AppText> : null}
            <AppText variant="caption">{t(`phase7.payment.${payment.status}` as never)}</AppText>
          </View>;
        })}
      </Card>
    </> : null}
  </Screen>;
}

function Row({ label, value, rtl, ltr = false }: { label: string; value: string; rtl: boolean; ltr?: boolean }) {
  return <View style={{ flexDirection: rtl ? "row-reverse" : "row", justifyContent: "space-between", gap: spacing.md }}>
    <AppText muted>{label}</AppText>
    <AppText weight="semibold" forceLtr={ltr}>{value}</AppText>
  </View>;
}

function DateRow({ label, value, language, rtl }: { label: string; value: string; language: "fa-AF" | "ps-AF" | "en"; rtl: boolean }) {
  const date = formatLocalDateTimeParts(value, language);
  return <Row label={label} value={`${date.date} · ${date.time}`} rtl={rtl} />;
}
