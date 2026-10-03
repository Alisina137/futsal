import { languages, type LanguageCode } from "@leaguekick/localization";
import { colors, radius, spacing, touchTarget } from "@leaguekick/design-tokens";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocale } from "../providers/LocaleProvider";
import { AppText } from "./ui/AppText";

export function LanguagePicker() {
  const { language, setLanguage, isRTL } = useLocale();
  return <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>{languages.map((item) => {
    const selected = item.code === language;
    return <Pressable key={item.code} accessibilityRole="radio" accessibilityState={{ checked:selected }} onPress={() => void setLanguage(item.code as LanguageCode)} style={[styles.item, selected && styles.selected]}>
      <AppText weight={selected ? "semibold" : "regular"} style={selected ? { color:colors.primary } : undefined}>{item.nativeName}</AppText>
    </Pressable>;
  })}</View>;
}
const styles=StyleSheet.create({row:{gap:spacing.sm,flexWrap:"wrap"},item:{minHeight:touchTarget,paddingHorizontal:spacing.md,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:colors.border,borderRadius:radius.pill,backgroundColor:colors.surface},selected:{borderColor:colors.primary,backgroundColor:colors.primarySoft}});
