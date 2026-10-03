import { colors, radius, spacing, touchTarget } from "@leaguekick/design-tokens";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "./AppText";

type Props = TextInputProps & { label: string; hint?: string; error?: string; forceLtr?: boolean };
export function TextField({ label, hint, error, forceLtr = false, style, ...props }: Props) {
  const { isRTL } = useLocale();
  const rtl = forceLtr ? false : isRTL;
  return <View style={styles.wrapper}>
    <AppText weight="medium">{label}</AppText>
    <TextInput {...props} style={[styles.input, { textAlign: rtl ? "right" : "left", writingDirection: rtl ? "rtl" : "ltr" }, error && styles.inputError, style]}
      placeholderTextColor={colors.textMuted} accessibilityLabel={label} />
    {error ? <AppText variant="caption" style={{ color: colors.danger }}>{error}</AppText> : hint ? <AppText variant="caption" muted>{hint}</AppText> : null}
  </View>;
}
const styles=StyleSheet.create({ wrapper:{gap:spacing.sm}, input:{minHeight:touchTarget+4,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:spacing.md,paddingVertical:spacing.sm,color:colors.text,backgroundColor:colors.surface,fontSize:16}, inputError:{borderColor:colors.danger} });
