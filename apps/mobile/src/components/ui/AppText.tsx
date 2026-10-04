import { typography, colors } from "@leaguekick/design-tokens";
import { Text, type TextProps, type TextStyle } from "react-native";
import { useLocale } from "../../providers/LocaleProvider";

type Variant = "display" | "title" | "bodyLarge" | "body" | "caption";
type Props = TextProps & { variant?: Variant; muted?: boolean; weight?: "regular" | "medium" | "semibold" | "bold"; forceLtr?: boolean };

const sizes: Record<Variant, { fontSize: number; lineHeight: number }> = {
  display: { fontSize: typography.size.display, lineHeight: typography.lineHeight.display },
  title: { fontSize: typography.size.title, lineHeight: typography.lineHeight.title },
  bodyLarge: { fontSize: typography.size.bodyLarge, lineHeight: typography.lineHeight.bodyLarge },
  body: { fontSize: typography.size.body, lineHeight: typography.lineHeight.body },
  caption: { fontSize: typography.size.caption, lineHeight: typography.lineHeight.caption },
};

export function AppText({ variant = "body", muted = false, weight = "regular", forceLtr = false, style, ...props }: Props) {
  const { isRTL, language } = useLocale();
  const direction = forceLtr ? false : isRTL;
  const fontWeight = typography.weight[weight] as TextStyle["fontWeight"];
  const fontFamily = language === "en" ? undefined : weight === "bold" ? "Vazirmatn_700Bold" : weight === "semibold" ? "Vazirmatn_600SemiBold" : weight === "medium" ? "Vazirmatn_500Medium" : "Vazirmatn_400Regular";
  return <Text {...props} style={[sizes[variant], { color: muted ? colors.textMuted : colors.text, textAlign: direction ? "right" : "left", writingDirection: direction ? "rtl" : "ltr", fontWeight, fontFamily }, style]} />;
}
