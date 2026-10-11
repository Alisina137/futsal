import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { AdminDashboardResponse, AdminUserDto, AdminVenueDto, AdminRoleSubscriptionDto, SubscriptionPaymentDto, PlatformSettingsDto, AdminAuditLogDto } from "@leaguekick/contracts";
import { Pressable, View } from "react-native";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/TextField";
import { adminApi } from "../../lib/api";
import { styles } from "./AdminStyles";

import type { SectionKey } from "./admin-navigation";
import {adminNavItems} from "./admin-navigation";
export function DashboardSection({ dashboard, setSection, t }: { dashboard: AdminDashboardResponse | null; setSection: (section: SectionKey) => void; t: (key: any, params?: Record<string, string | number>) => string }) {
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

