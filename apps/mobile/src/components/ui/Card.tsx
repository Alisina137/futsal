import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { StyleSheet, View, type ViewProps } from "react-native";
export function Card({ style, ...props }: ViewProps) { return <View {...props} style={[styles.card, style]} />; }
const styles=StyleSheet.create({card:{backgroundColor:colors.surface,borderColor:colors.border,borderWidth:1,borderRadius:radius.lg,padding:spacing.md,gap:spacing.sm}});
