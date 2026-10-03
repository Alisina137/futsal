import { colors, spacing } from "@leaguekick/design-tokens";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
export function Screen({ children, style }: ViewProps) {
  return <SafeAreaView style={styles.safe} edges={["top","left","right"]}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, style]}>{children}</ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},flex:{flex:1},content:{padding:spacing.md,gap:spacing.md,flexGrow:1}});
