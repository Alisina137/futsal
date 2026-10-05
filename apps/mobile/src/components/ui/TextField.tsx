import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing, touchTarget } from "@leaguekick/design-tokens";
import { forwardRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "./AppText";

type Props = TextInputProps & {
  label: string;
  hint?: string;
  error?: string | undefined;
  forceLtr?: boolean;
  containerStyle?: ViewStyle;
};

export const TextField = forwardRef<TextInput, Props>(function TextField({
  label,
  hint,
  error,
  forceLtr = false,
  containerStyle,
  style,
  onFocus,
  onBlur,
  secureTextEntry = false,
  placeholder,
  ...props
}, ref) {
  const { isRTL, t } = useLocale();
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const rtl = forceLtr ? false : isRTL;
  const passwordField = Boolean(secureTextEntry);

  return <View style={[styles.wrapper, containerStyle]}>
    <AppText weight="medium" style={error ? styles.errorLabel : focused ? styles.focusedLabel : undefined}>{label}</AppText>

    <View style={styles.inputShell}>
      <TextInput
        ref={ref}
        {...props}
        secureTextEntry={passwordField ? !passwordVisible : false}
        placeholder={placeholder ?? label}
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
          passwordField && (rtl ? styles.passwordInputRtl : styles.passwordInputLtr),
          focused && styles.inputFocused,
          error && styles.inputError,
          style,
        ]}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        accessibilityState={{ disabled: props.editable === false }}
        selectionColor={colors.primary}
      />

      {passwordField ? <Pressable
        accessibilityRole="button"
        accessibilityLabel={passwordVisible ? t("common.hidePassword") : t("common.showPassword")}
        hitSlop={10}
        onPress={() => setPasswordVisible((current) => !current)}
        style={[
          styles.visibilityButton,
          rtl ? styles.visibilityLeft : styles.visibilityRight,
        ]}
      >
        <Ionicons
          name={passwordVisible ? "eye-off-outline" : "eye-outline"}
          size={22}
          color={error ? colors.danger : focused ? colors.primary : colors.textMuted}
        />
      </Pressable> : null}
    </View>

    {error
      ? <AppText variant="caption" accessibilityLiveRegion="polite" style={{ color: colors.danger }}>{error}</AppText>
      : hint
        ? <AppText variant="caption" muted>{hint}</AppText>
        : null}
  </View>;
});

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  focusedLabel: {
    color: colors.primary,
  },
  errorLabel: {
    color: colors.danger,
  },
  inputShell: {
    position: "relative",
  },
  input: {
    width: "100%",
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
  passwordInputLtr: {
    paddingRight: 50,
  },
  passwordInputRtl: {
    paddingLeft: 50,
  },
  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: "#FBFDFF",
  },
  inputError: {
    borderColor: colors.danger,
  },
  visibilityButton: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  visibilityRight: {
    right: 4,
  },
  visibilityLeft: {
    left: 4,
  },
});
