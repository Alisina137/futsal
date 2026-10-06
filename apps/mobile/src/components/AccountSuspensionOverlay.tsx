import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useAuth } from "../providers/AuthProvider";
import { useLocale } from "../providers/LocaleProvider";
import { AppText } from "./ui/AppText";
import { Button } from "./ui/Button";

type FeedbackKey =
  | "auth.suspendedStill"
  | "auth.suspendedOffline"
  | "auth.suspendedCheckFailed"
  | null;

export function AccountSuspensionOverlay() {
  const { accessState, revalidate, signOut } = useAuth();
  const { t } = useLocale();
  const [checking, setChecking] = useState(false);
  const [feedbackKey, setFeedbackKey] = useState<FeedbackKey>(null);

  if (accessState !== "suspended") return null;

  async function checkStatus() {
    if (checking) return;
    setChecking(true);
    setFeedbackKey(null);

    try {
      const result = await revalidate();

      if (result === "suspended") {
        setFeedbackKey("auth.suspendedStill");
      } else if (result === "offline") {
        setFeedbackKey("auth.suspendedOffline");
      } else if (result === "unchanged") {
        setFeedbackKey("auth.suspendedCheckFailed");
      }
      // If result is "active", AuthProvider changes accessState to active and
      // this modal disappears immediately. "signed_out" routes to login.
    } finally {
      setChecking(false);
    }
  }

  return <Modal
    visible
    transparent
    animationType="fade"
    statusBarTranslucent
    onRequestClose={() => undefined}
  >
    <View style={styles.backdrop}>
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={styles.card}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="ban-outline" size={34} color={colors.danger} />
        </View>

        <View style={styles.copy}>
          <AppText variant="title" weight="bold" style={styles.center}>
            {t("auth.suspendedTitle")}
          </AppText>
          <AppText muted style={styles.center}>
            {t("auth.suspendedBody")}
          </AppText>
          <AppText variant="caption" muted style={styles.center}>
            {t("auth.suspendedContact")}
          </AppText>
        </View>

        {feedbackKey ? <View
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.feedback}
        >
          <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
          <AppText variant="caption" style={styles.feedbackText}>
            {t(feedbackKey)}
          </AppText>
        </View> : null}

        <Button
          label={t("auth.suspendedCheck")}
          onPress={() => void checkStatus()}
          loading={checking}
          variant="secondary"
        />

        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <AppText weight="semibold" style={{ color: colors.danger }}>
            {t("common.signOut")}
          </AppText>
        </Pressable>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
  },
  card: {
    width: "100%",
    maxWidth: 460,
    padding: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 68,
    height: 68,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#FFF0EE",
  },
  copy: {
    gap: spacing.sm,
  },
  center: {
    textAlign: "center",
  },
  feedback: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#E8D39B",
    backgroundColor: "#FFF9E8",
  },
  feedbackText: {
    flex: 1,
    color: colors.warning,
  },
  signOut: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
});
