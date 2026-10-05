import { Component, useState, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors, spacing } from "@leaguekick/design-tokens";
import { useLocale } from "../providers/LocaleProvider";
import { AppText } from "./ui/AppText";
import { Button } from "./ui/Button";

type BoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

class CrashBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    console.error("Unhandled mobile UI error");
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function AppCrashBoundary({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const [resetKey, setResetKey] = useState(0);

  return <CrashBoundary key={resetKey} fallback={
    <View style={styles.screen} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <View style={styles.card}>
        <AppText variant="title" weight="bold">{t("crash.title")}</AppText>
        <AppText>{t("crash.body")}</AppText>
        <Button label={t("crash.retry")} onPress={() => setResetKey((value) => value + 1)}/>
      </View>
    </View>
  }>{children}</CrashBoundary>;
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.background,justifyContent:"center",padding:spacing.lg},
  card:{backgroundColor:colors.surface,borderRadius:20,padding:spacing.lg,gap:spacing.md,borderWidth:1,borderColor:colors.border},
});
