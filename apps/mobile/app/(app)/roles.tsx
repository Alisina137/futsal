import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { SelfAssignableRole } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "../../src/components/ui/AppText";
import { Button } from "../../src/components/ui/Button";
import { Card } from "../../src/components/ui/Card";
import { Screen } from "../../src/components/ui/Screen";
import { useAuth } from "../../src/providers/AuthProvider";
import { useLocale } from "../../src/providers/LocaleProvider";

type IconName = keyof typeof Ionicons.glyphMap;

const options: Array<{
  role: SelfAssignableRole;
  icon: IconName;
  body: "roles.playerBody" | "roles.ownerBody" | "roles.managerBody" | "roles.refereeBody";
}> = [
  { role: "PLAYER", icon: "football-outline", body: "roles.playerBody" },
  { role: "VENUE_OWNER", icon: "business-outline", body: "roles.ownerBody" },
  { role: "TEAM_MANAGER", icon: "people-outline", body: "roles.managerBody" },
  { role: "REFEREE", icon: "flag-outline", body: "roles.refereeBody" },
];

export default function RolesScreen() {
  const { session, activateRole } = useAuth();
  const { t, isRTL } = useLocale();
  const [busyRole, setBusyRole] = useState<SelfAssignableRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeRoles = session?.user.roles ?? [];

  async function activate(role: SelfAssignableRole) {
    if (activeRoles.includes(role)) return;
    setBusyRole(role);
    setError(null);
    try {
      await activateRole(role);
      if (role === "VENUE_OWNER") router.push("/owner/onboarding");
      else if (role === "TEAM_MANAGER") router.push("/teams");
      else if (role === "PLAYER") router.push("/profile/player");
    } catch {
      setError(t("roles.error"));
    } finally {
      setBusyRole(null);
    }
  }

  return <Screen showHeader>
    <View style={styles.header}>
      <View style={styles.badge}>
        <Ionicons name="layers-outline" size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <AppText variant="title" weight="bold">{t("roles.title")}</AppText>
        <AppText muted>{t("roles.subtitle")}</AppText>
      </View>
    </View>

    {activeRoles.length === 0 ? <Card style={styles.basicCard}>
      <View style={[styles.roleHead, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={styles.basicIcon}>
          <Ionicons name="person-outline" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText weight="bold">{t("roles.basicUser")}</AppText>
          <AppText variant="caption" muted>{t("roles.basicUserBody")}</AppText>
        </View>
      </View>
    </Card> : null}

    {options.map((option) => {
      const active = activeRoles.includes(option.role);
      return <Card key={option.role} style={[styles.roleCard, active && styles.activeCard]}>
        <View style={[styles.roleHead, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={[styles.roleIcon, active && styles.activeIcon]}>
            <Ionicons name={option.icon} size={23} color={active ? colors.success : colors.primary} />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <View style={[styles.titleLine, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <AppText variant="bodyLarge" weight="bold">{t(("role." + option.role) as never)}</AppText>
              {active ? <View style={styles.activePill}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <AppText variant="caption" weight="semibold" style={{ color: colors.success }}>{t("roles.active")}</AppText>
              </View> : null}
            </View>
            <AppText muted>{t(option.body)}</AppText>
          </View>
        </View>
        <Button
          label={active ? t("roles.active") : t("roles.activate")}
          onPress={() => void activate(option.role)}
          loading={busyRole === option.role}
          disabled={active || busyRole !== null}
          variant={active ? "secondary" : "primary"}
        />
      </Card>;
    })}

    {error ? <Card style={styles.errorCard}>
      <AppText style={{ color: colors.danger }}>{error}</AppText>
    </Card> : null}

    <Card style={styles.controlled}>
      <View style={[styles.roleHead, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={styles.lockIcon}>
          <Ionicons name="lock-closed-outline" size={21} color={colors.warning} />
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText weight="bold">{t("roles.controlledTitle")}</AppText>
          <AppText variant="caption" muted>{t("roles.controlledBody")}</AppText>
        </View>
      </View>
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  badge: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  basicCard: { backgroundColor: "#F8FBFF", borderColor: "#C7D7F7" },
  roleCard: { gap: spacing.md, padding: spacing.lg },
  activeCard: { borderColor: "#B7E2C4", backgroundColor: "#FBFFFC" },
  roleHead: { alignItems: "center", gap: spacing.md },
  roleIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  activeIcon: { backgroundColor: "#E9F8EF" },
  basicIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  lockIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF8E7" },
  titleLine: { alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  activePill: { minHeight: 26, borderRadius: radius.pill, paddingHorizontal: spacing.sm, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E9F8EF" },
  controlled: { backgroundColor: "#FFFCF5", borderColor: "#F0D9A5" },
  errorCard: { backgroundColor: "#FFF7F5", borderColor: "#F5C5C1" },
});
