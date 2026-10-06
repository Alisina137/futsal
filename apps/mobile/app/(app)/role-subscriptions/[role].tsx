import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { PaidRole, RoleSubscriptionOfferDto } from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { ApiRequestError, authApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

type RoleSlug = "venue-owner" | "team-owner";

function roleFromSlug(slug: string | undefined): PaidRole | null {
  if (slug === "venue-owner") return "VENUE_OWNER";
  if (slug === "team-owner") return "TEAM_MANAGER";
  return null;
}

export default function PaidRoleSubscriptionScreen() {
  const { role: rawRole } = useLocalSearchParams<{ role: RoleSlug }>();
  const role = roleFromSlug(rawRole);
  const { session, revalidate } = useAuth();
  const { t, isRTL } = useLocale();
  const [offer, setOffer] = useState<RoleSubscriptionOfferDto | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session || !role) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await authApi.roleSubscriptions(session.accessToken);
      const next = result.offers.find((item) => item.role === role) ?? null;
      setOffer(next);
      if (next?.status === "ACTIVE") await revalidate();
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : t("roles.subscriptionLoadError"));
    } finally {
      setLoading(false);
    }
  }, [revalidate, role, session, t]);

  useEffect(() => {
    if (!role) {
      router.replace("/settings");
      return;
    }
    void load();
  }, [load, role]);

  const capabilities = useMemo(() => {
    if (role === "VENUE_OWNER") {
      return [
        "roles.venueCapabilityVenue",
        "roles.venueCapabilityCalendar",
        "roles.venueCapabilityMarketing",
        "roles.venueCapabilityCompetition",
        "roles.venueCapabilityAnalytics",
        "roles.venueCapabilityReferees",
      ];
    }
    return [
      "roles.teamCapabilityCreate",
      "roles.teamCapabilityPlayers",
      "roles.teamCapabilityRoster",
      "roles.teamCapabilityCompetition",
      "roles.teamCapabilityHistory",
    ];
  }, [role]);

  if (!role) return null;

  const title = t(role === "VENUE_OWNER" ? "roles.venueOwner" : "roles.teamOwner");
  const active = offer?.status === "ACTIVE";
  const pending = offer?.status === "PENDING";
  const price = offer?.monthlyPriceAfn ?? (role === "VENUE_OWNER" ? 1000 : 300);

  async function submit() {
    if (!session) return;
    setRequesting(true);
    setMessage(null);
    try {
      const result = await authApi.requestRoleSubscription(session.accessToken, role!, {
        paymentReference: paymentReference.trim(),
      });
      setOffer(result.offer);
      setMessage(t("roles.paymentSubmitted"));
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : t("roles.subscriptionRequestError"));
    } finally {
      setRequesting(false);
    }
  }

  async function checkStatus() {
    setChecking(true);
    try {
      await load();
      await revalidate();
    } finally {
      setChecking(false);
    }
  }

  if(loading)return <Screen showHeader><DataLoadingState variant="detail" minHeight={500}/></Screen>;

  return <Screen showHeader>
    <View style={{ gap: spacing.xs }}>
      <AppText variant="title" weight="bold">{title}</AppText>
      <AppText muted>{t(role === "VENUE_OWNER" ? "roles.venueOwnerPageBody" : "roles.teamOwnerPageBody")}</AppText>
    </View>

    <Card style={styles.priceCard}>
      <View style={[styles.priceHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={styles.priceIcon}>
          <Ionicons name={role === "VENUE_OWNER" ? "business-outline" : "people-outline"} size={28} color={colors.primary}/>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyLarge" weight="bold">{title}</AppText>
          <AppText muted>{t("roles.monthlySubscription")}</AppText>
        </View>
      </View>
      <View style={[styles.priceRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <AppText variant="title" weight="bold" style={{ color: colors.primary }} forceLtr>{price} AFN</AppText>
        <AppText muted>{t("roles.perMonth")}</AppText>
      </View>
      {offer ? <View style={styles.statusLine}>
        <AppText variant="caption" muted>{t("roles.subscriptionStatus")}</AppText>
        <AppText weight="bold" style={{ color: active ? colors.success : pending ? colors.warning : colors.text }}>
          {t(`roles.subscription.${offer.status}` as never)}
        </AppText>
      </View> : null}
      {offer?.activeUntil ? <AppText variant="caption" muted forceLtr>{t("roles.activeUntil")}: {offer.activeUntil}</AppText> : null}
    </Card>

    <Card style={styles.capabilityCard}>
      <AppText variant="bodyLarge" weight="bold">{t("roles.capabilitiesTitle")}</AppText>
      <AppText muted>{t("roles.capabilitiesBody")}</AppText>
      {capabilities.map((key) => <View key={key} style={[styles.capability, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={styles.check}><Ionicons name="checkmark" size={16} color={colors.success}/></View>
        <AppText style={{ flex: 1 }}>{t(key as never)}</AppText>
      </View>)}
    </Card>

    {message ? <Card style={styles.messageCard}>
      <AppText accessibilityRole="alert">{message}</AppText>
    </Card> : null}

    {!loading && !active && !pending ? <Card style={styles.subscribeCard}>
      <AppText variant="bodyLarge" weight="bold">{t("roles.subscribeTitle")}</AppText>
      <AppText muted>{t("roles.subscribeBody",{amount:price})}</AppText>
      <TextField
        label={t("roles.paymentReference")}
        value={paymentReference}
        onChangeText={setPaymentReference}
        placeholder={t("roles.paymentReferencePlaceholder")}
        forceLtr
      />
      <AppText variant="caption" muted>{t("roles.manualPaymentNote")}</AppText>
      <Button
        label={t("roles.subscribeAfterPayment")}
        onPress={() => void submit()}
        loading={requesting}
      />
    </Card> : null}

    {pending ? <Card style={styles.pendingCard}>
      <Ionicons name="time-outline" size={28} color={colors.warning}/>
      <AppText variant="bodyLarge" weight="bold">{t("roles.paymentPendingTitle")}</AppText>
      <AppText muted>{t("roles.paymentPendingBody")}</AppText>
      <Button label={t("roles.checkSubscription")} onPress={() => void checkStatus()} loading={checking} variant="secondary"/>
    </Card> : null}

    {active ? <Card style={styles.activeCard}>
      <Ionicons name="checkmark-circle-outline" size={30} color={colors.success}/>
      <AppText variant="bodyLarge" weight="bold">{t("roles.subscriptionActiveTitle")}</AppText>
      <AppText muted>{t("roles.subscriptionActiveBody")}</AppText>
      <Button
        label={t(role === "VENUE_OWNER" ? "roles.openVenueTools" : "roles.openTeamTools")}
        onPress={() => router.replace(role === "VENUE_OWNER" ? "/home" : "/teams")}
      />
    </Card> : null}

    <Button label={t("owner.back")} onPress={() => router.back()} variant="ghost"/>
  </Screen>;
}

const styles = {
  priceCard: { gap: spacing.md, borderColor: colors.primary },
  priceHeader: { alignItems: "center" as const, gap: spacing.md },
  priceIcon: { width: 54, height: 54, borderRadius: radius.md, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: colors.primarySoft },
  priceRow: { alignItems: "baseline" as const, gap: spacing.sm },
  statusLine: { gap: 4 },
  capabilityCard: { gap: spacing.md },
  capability: { alignItems: "center" as const, gap: spacing.sm },
  check: { width: 28, height: 28, borderRadius: 14, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: "#E9F8EF" },
  subscribeCard: { gap: spacing.md },
  pendingCard: { gap: spacing.md, backgroundColor: "#FFF9E8", borderColor: "#E8D39B" },
  activeCard: { gap: spacing.md, backgroundColor: "#EFFAF3", borderColor: "#B8E2C5" },
  messageCard: { backgroundColor: colors.surfaceMuted },
};
