import { colors, radius, spacing, touchTarget } from "@leaguekick/design-tokens";
import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { AppText } from "./AppText";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  icon?: ReactNode;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  icon,
  style,
}: Props) {
  const blocked = disabled || loading;

  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: blocked, busy: loading }}
    disabled={blocked}
    onPress={onPress}
    style={({ pressed }) => [
      styles.base,
      variant === "primary" ? styles.primary : variant === "secondary" ? styles.secondary : styles.ghost,
      pressed && !blocked && (variant === "primary" ? styles.primaryPressed : styles.pressed),
      blocked && styles.disabled,
      style,
    ]}
  >
    {loading
      ? <ActivityIndicator color={variant === "primary" ? "#FFFFFF" : colors.primary} />
      : <>
        {icon}
        <AppText weight="semibold" style={{ color: variant === "primary" ? "#FFFFFF" : colors.primary }}>
          {label}
        </AppText>
      </>}
  </Pressable>;
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  primaryPressed: {
    backgroundColor: colors.primaryPressed,
    transform: [{ scale: 0.985 }],
  },
  secondary: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "#B9CEF8",
  },
  ghost: {
    backgroundColor: "transparent",
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.48,
    shadowOpacity: 0,
    elevation: 0,
  },
});
