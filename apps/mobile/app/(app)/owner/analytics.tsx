import { colors, spacing } from "@leaguekick/design-tokens";
import type { OwnerAnalyticsResponse } from "@leaguekick/contracts";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { ownerApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

function kabulDate(daysAgo = 0) {
  const now = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kabul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export default function OwnerAnalyticsScreen() {
  const { session } = useAuth();
  const { t, isRTL } = useLocale();
  const [from, setFrom] = useState(kabulDate(29));
  const [to, setTo] = useState(kabulDate());
  const [data, setData] = useState<OwnerAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      setData(await ownerApi.analytics(session.accessToken, from, to));
    } catch {
      setError(t("phase7.analytics.loadError"));
    } finally {
      setLoading(false);
    }
  }, [from, session, t, to]);

  useEffect(() => { void load(); }, []);

  return <Screen showHeader>
    <View style={{ gap: spacing.xs }}>
      <AppText variant="title" weight="bold">{t("phase7.analytics.title")}</AppText>
      <AppText muted>{t("phase7.analytics.subtitle")}</AppText>
    </View>

    <Card>
      <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: spacing.sm }}>
        <TextField label={t("phase7.analytics.from")} value={from} onChangeText={setFrom} forceLtr containerStyle={{ flex: 1 }} />
        <TextField label={t("phase7.analytics.to")} value={to} onChangeText={setTo} forceLtr containerStyle={{ flex: 1 }} />
      </View>
      <Button label={t("phase7.analytics.refresh")} onPress={() => void load()} loading={loading} />
    </Card>

    {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}
    {!loading && data && data.bookingCount === 0 ? <Card><AppText>{t("phase7.analytics.empty")}</AppText></Card> : null}

    {data ? <>
      <Metric title={t("phase7.analytics.occupancy")} value={`${(data.occupancyRate * 100).toFixed(1)}%`} body={t("phase7.analytics.occupancyBody", { booked: Math.round(data.bookedMinutes / 60), available: Math.round(data.availableMinutes / 60) })} />
      <Metric title={t("phase7.analytics.gmv")} value={`${data.grossBookingValueAfn} AFN`} body={t("phase7.analytics.gmvBody")} />
      <Metric title={t("phase7.analytics.bookings")} value={String(data.bookingCount)} body={t("phase7.analytics.bookingBody", { confirmed: data.confirmedBookingCount, cancelled: data.cancelledBookingCount })} />
      <Metric title={t("phase7.analytics.onlineShare")} value={`${(data.onlineBookingShare * 100).toFixed(1)}%`} body={t("phase7.analytics.onlineBody", { online: data.onlineBookingCount, manual: data.manualBookingCount })} />
    </> : null}
  </Screen>;
}

function Metric({ title, value, body }: { title: string; value: string; body: string }) {
  return <Card>
    <AppText weight="semibold" muted>{title}</AppText>
    <AppText variant="title" weight="bold">{value}</AppText>
    <AppText variant="caption" muted>{body}</AppText>
  </Card>;
}
