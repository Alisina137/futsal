import { colors, spacing } from "@leaguekick/design-tokens";
import type { Ref } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "./AppHeader";
import { PublicTopNavigation } from "./PublicTopNavigation";

type ScreenProps = ViewProps & {
  showHeader?: boolean;
  publicNav?: boolean;
  embedded?: boolean;
  scrollRef?: Ref<ScrollView>;
};

export function Screen({ children, style, showHeader = false, publicNav = false, embedded = false, scrollRef }: ScreenProps) {
  const content = <>
    {!embedded && showHeader ? <AppHeader/> : null}
    {!embedded && showHeader && publicNav ? <PublicTopNavigation/> : null}
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, style]}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </>;

  if (embedded) return <View style={styles.safe}>{content}</View>;

  return <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
    {content}
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
