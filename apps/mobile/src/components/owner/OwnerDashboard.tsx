import { colors, spacing } from "@leaguekick/design-tokens";
import type { OwnerOnboardingStatus } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { ownerApi, ApiRequestError } from "../../lib/api";
import { formatLocalDateTimeParts } from "../../lib/date-time";
import { useAuth } from "../../providers/AuthProvider";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Screen } from "../ui/Screen";

function remainingLabel(seconds: number | null) {
  if (seconds === null) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function OwnerDashboard() {
  const { session } = useAuth();
  const { t, isRTL, language } = useLocale();
  const token = session?.accessToken;
  const [status, setStatus] = useState<OwnerOnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setStatus(await ownerApi.getStatus(token));
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.isNetworkError) setError(t("owner.networkError"));
      else setError(t("owner.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <Screen showHeader><AppText>{t("common.loading")}</AppText></Screen>;
  }

  return <Screen showHeader>
    <View style={{ gap: spacing.xs }}>
      <AppText variant="title" weight="bold">{t("owner.dashboardTitle")}</AppText>
      <AppText muted>{t("owner.dashboardSubtitle")}</AppText>
    </View>

    {error ? <Card>
      <AppText style={{ color: colors.danger }}>{error}</AppText>
      <Button label={t("common.retry")} onPress={() => void load()} variant="secondary" />
    </Card> : null}

    {!status?.venue ? <Card>
      <AppText weight="semibold" style={{ color: colors.primary }}>{t("owner.setupRequiredTitle")}</AppText>
      <AppText>{t("owner.setupRequiredBody")}</AppText>
      <Button label={t("owner.startSetup")} onPress={() => router.push("/owner/onboarding")} />
    </Card> : null}

    {status?.venue ? <Card>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="bodyLarge" weight="bold">{status.venue.name}</AppText>
        <AppText muted>{status.venue.city}, {status.venue.province}</AppText>
      </View>
      <InfoRow label={t("owner.setupStatus")} value={status.setupComplete ? t("owner.complete") : t("owner.incomplete")} rtl={isRTL} />
      <InfoRow label={t("owner.subscriptionStatus")} value={t(`owner.subscription.${status.subscription.state}` as never)} rtl={isRTL} />
      {status.subscription.state === "TRIAL" ? <InfoRow label={t("owner.trialRemaining")} value={remainingLabel(status.subscription.remainingSeconds)} rtl={isRTL} ltr /> : null}
      {status.subscription.trialEndsAt ? <TrialEndBlock
        label={t("owner.trialEnds")}
        value={status.subscription.trialEndsAt}
        language={language}
        rtl={isRTL}
      /> : null}
      <Button
        label={status.subscription.state === "NOT_STARTED" ? t("owner.reviewSetup") : t("owner.manageSetup")}
        onPress={() => router.push("/owner/onboarding")}
        variant={status.subscription.state === "NOT_STARTED" ? "primary" : "secondary"}
      />
    </Card> : null}

    {status?.venue ? <Card>
      <AppText variant="bodyLarge" weight="bold">{t("ownerMarketing.marketingTitle")}</AppText>
      <AppText muted>{t("ownerMarketing.marketingBody")}</AppText>
      <Button label={t("ownerMarketing.promotionsTitle")} onPress={() => router.push("/owner/promotions")} />
      <Button label={t("ownerMarketing.postsTitle")} onPress={() => router.push("/owner/posts")} variant="secondary" />
    </Card> : null}

    {status?.subscription.state === "EXPIRED" ? <Card style={{ backgroundColor: colors.surfaceMuted }}>
      <AppText weight="semibold" style={{ color: colors.warning }}>{t("owner.trialExpiredTitle")}</AppText>
      <AppText>{t("owner.trialExpiredBody")}</AppText>
    </Card> : null}
  </Screen>;
}

function InfoRow({ label, value, rtl, ltr = false }: { label: string; value: string; rtl: boolean; ltr?: boolean }) {
  return <View style={{ flexDirection: rtl ? "row-reverse" : "row", justifyContent: "space-between", gap: spacing.md }}>
    <AppText muted>{label}</AppText>
    <AppText weight="semibold" forceLtr={ltr}>{value}</AppText>
  </View>;
}


function TrialEndBlock({
  label,
  value,
  language,
  rtl,
}: {
  label: string;
  value: string;
  language: Parameters<typeof formatLocalDateTimeParts>[1];
  rtl: boolean;
}) {
  const formatted = formatLocalDateTimeParts(value, language);

  return <View style={{ gap: spacing.xs }}>
    <AppText muted>{label}</AppText>
    <View style={{ gap: 2, alignItems: rtl ? "flex-end" : "flex-start" }}>
      <AppText weight="semibold">{formatted.date}</AppText>
      <AppText variant="caption" muted>{formatted.time}</AppText>
    </View>
  </View>;
}
