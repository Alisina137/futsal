import { colors, spacing } from "@leaguekick/design-tokens";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "./AppHeader";

type ScreenProps = ViewProps & { showHeader?: boolean };

export function Screen({ children, style, showHeader = false }: ScreenProps) {
  return <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
    {showHeader ? <AppHeader/> : null}
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, style]}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
    flexGrow: 1,
  },
});
