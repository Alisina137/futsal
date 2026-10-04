import { colors, radius, spacing, touchTarget } from "@leaguekick/design-tokens";
import { useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "./AppText";

type Props = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  forceLtr?: boolean;
  containerStyle?: ViewStyle;
};

export function TextField({
  label,
  hint,
  error,
  forceLtr = false,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...props
}: Props) {
  const { isRTL } = useLocale();
  const [focused, setFocused] = useState(false);
  const rtl = forceLtr ? false : isRTL;

  return <View style={[styles.wrapper, containerStyle]}>
    <AppText weight="medium" style={focused ? styles.focusedLabel : undefined}>{label}</AppText>
    <TextInput
      {...props}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        styles.input,
        {
          textAlign: rtl ? "right" : "left",
          writingDirection: rtl ? "rtl" : "ltr",
        },
        focused && styles.inputFocused,
        error && styles.inputError,
        style,
      ]}
      placeholderTextColor={colors.textMuted}
      accessibilityLabel={label}
      selectionColor={colors.primary}
    />
    {error
      ? <AppText variant="caption" style={{ color: colors.danger }}>{error}</AppText>
      : hint
        ? <AppText variant="caption" muted>{hint}</AppText>
        : null}
  </View>;
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  focusedLabel: {
    color: colors.primary,
  },
  input: {
    minHeight: touchTarget + 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: "#FBFDFF",
  },
  inputError: {
    borderColor: colors.danger,
  },
});
