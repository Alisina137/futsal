import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, spacing } from "@leaguekick/design-tokens";
import { Redirect, router } from "expo-router";
import { View } from "react-native";
import { AppText } from "../../src/components/ui/AppText";
import { Button } from "../../src/components/ui/Button";
import { Card } from "../../src/components/ui/Card";
import { Screen } from "../../src/components/ui/Screen";
import { useAuth } from "../../src/providers/AuthProvider";
import { useLocale } from "../../src/providers/LocaleProvider";
import { TeamManagerDashboard } from "../../src/components/team-manager/TeamManagerDashboard";

type DashboardRole = "PLATFORM_ADMIN" | "VENUE_OWNER" | "TEAM_MANAGER" | "REFEREE" | "PLAYER";

function resolveDashboardRole(roles: string[]): DashboardRole | null {
  const priority: DashboardRole[] = [
    "PLATFORM_ADMIN",
    "VENUE_OWNER",
    "TEAM_MANAGER",
    "REFEREE",
    "PLAYER",
  ];
  return priority.find((role) => roles.includes(role)) ?? null;
}

export default function DashboardScreen() {
  const { session } = useAuth();
  const { t } = useLocale();
  const role = resolveDashboardRole(session?.user.roles ?? []);

  if (role === "VENUE_OWNER") {
    return <Redirect href="/owner/competitions" />;
  }

  if (role === "TEAM_MANAGER") return <TeamManagerDashboard />;

  if (!role) {
    return <Screen showHeader>
      <Card style={{ gap: spacing.md }}>
        <View style={{ alignItems: "center", gap: spacing.sm }}>
          <View style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surfaceMuted,
          }}>
            <Ionicons name="grid-outline" size={26} color={colors.textMuted}/>
          </View>
          <AppText variant="bodyLarge" weight="bold">{t("dashboard.normalUnavailableTitle")}</AppText>
          <AppText muted style={{ textAlign: "center" }}>{t("dashboard.normalUnavailableBody")}</AppText>
        </View>
        <Button label={t("home.title")} onPress={() => router.replace("/home")} />
      </Card>
    </Screen>;
  }

  const config = role === "PLAYER"
      ? {
          title: t("dashboard.playerTitle"),
          body: t("dashboard.playerBody"),
          icon: "football-outline" as const,
          actionLabel: t("teams.profileTitle"),
          action: () => router.push("/profile/player"),
        }
      : role === "REFEREE"
        ? {
            title: t("dashboard.refereeTitle"),
            body: t("dashboard.refereeBody"),
            icon: "flag-outline" as const,
            actionLabel: t("competition.title"),
            action: () => router.push("/competitions"),
          }
        : {
            title: t("dashboard.adminTitle"),
            body: t("dashboard.adminBody"),
            icon: "shield-checkmark-outline" as const,
            actionLabel: t("phase7.admin.title"),
            action: () => router.push("/admin"),
          };

  return <Screen showHeader>
    <View style={{ gap: spacing.xs }}>
      <AppText variant="title" weight="bold">{t("dashboard.title")}</AppText>
      <AppText muted>{t("dashboard.subtitle")}</AppText>
    </View>

    <Card style={{ gap: spacing.md }}>
      <View style={{ alignItems: "center", gap: spacing.sm }}>
        <View style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primarySoft,
        }}>
          <Ionicons name={config.icon} size={30} color={colors.primary}/>
        </View>
        <AppText variant="title" weight="bold" style={{ textAlign: "center" }}>{config.title}</AppText>
        <AppText muted style={{ textAlign: "center" }}>{config.body}</AppText>
      </View>
      <Button label={config.actionLabel} onPress={config.action} />
    </Card>
  </Screen>;
}
