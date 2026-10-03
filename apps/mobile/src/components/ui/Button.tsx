import { colors, radius, spacing, touchTarget } from "@leaguekick/design-tokens";
import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { AppText } from "./AppText";

type Props = { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; variant?: "primary" | "secondary" | "ghost"; icon?: ReactNode; style?: ViewStyle };

export function Button({ label, onPress, loading = false, disabled = false, variant = "primary", icon, style }: Props) {
  const blocked = disabled || loading;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: blocked, busy: loading }} disabled={blocked} onPress={onPress}
    style={({ pressed }) => [styles.base, variant === "primary" ? styles.primary : variant === "secondary" ? styles.secondary : styles.ghost, pressed && !blocked && styles.pressed, blocked && styles.disabled, style]}>
    {loading ? <ActivityIndicator color={variant === "primary" ? "#FFFFFF" : colors.primary} /> : <>{icon}<AppText weight="semibold" style={{ color: variant === "primary" ? "#FFFFFF" : colors.primary }}>{label}</AppText></>}
  </Pressable>;
}

const styles = StyleSheet.create({
  base:{ minHeight:touchTarget, paddingHorizontal:spacing.lg, borderRadius:radius.md, flexDirection:"row", gap:spacing.sm, alignItems:"center", justifyContent:"center" },
  primary:{ backgroundColor:colors.primary }, secondary:{ backgroundColor:colors.primarySoft, borderWidth:1, borderColor:colors.primary }, ghost:{ backgroundColor:"transparent" },
  pressed:{ opacity:0.86 }, disabled:{ opacity:0.52 },
});
