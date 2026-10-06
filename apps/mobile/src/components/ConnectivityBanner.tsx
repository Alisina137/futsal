import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale } from "../providers/LocaleProvider";
import { useNetwork } from "../providers/NetworkProvider";
import { AppText } from "./ui/AppText";

export function ConnectivityBanner() {
  const {
    isOnline,
    hasResolved,
    reconnectVersion,
    apiReachable,
    apiHasResolved,
    apiReconnectVersion,
  } = useNetwork();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [showServerBack, setShowServerBack] = useState(false);
  const mountedNetwork = useRef(false);
  const mountedApi = useRef(false);

  useEffect(() => {
    if (!mountedNetwork.current) {
      mountedNetwork.current = true;
      return;
    }
    if (reconnectVersion > 0) {
      setShowBackOnline(true);
      const id = setTimeout(() => setShowBackOnline(false), 4000);
      return () => clearTimeout(id);
    }
  }, [reconnectVersion]);

  useEffect(() => {
    if (!mountedApi.current) {
      mountedApi.current = true;
      return;
    }
    if (apiReconnectVersion > 0) {
      setShowServerBack(true);
      const id = setTimeout(() => setShowServerBack(false), 4000);
      return () => clearTimeout(id);
    }
  }, [apiReconnectVersion]);

  if (!hasResolved) return null;

  let title: string | null = null;
  let body: string | null = null;
  let backgroundColor: string = colors.success;

  if (!isOnline) {
    title = t("network.offlineTitle");
    body = t("network.offlineBody");
    backgroundColor = colors.warning;
  } else if (apiHasResolved && apiReachable === false) {
    title = t("network.serverUnavailableTitle");
    body = t("network.serverUnavailableBody");
    backgroundColor = colors.warning;
  } else if (showServerBack) {
    title = t("network.serverBackOnline");
    backgroundColor = colors.success;
  } else if (showBackOnline) {
    title = t("network.backOnline");
    backgroundColor = colors.success;
  }

  if (!title) return null;

  return <View
    pointerEvents="none"
    accessible
    accessibilityRole="alert"
    accessibilityLiveRegion="assertive"
    accessibilityLabel={title}
    style={[styles.container, { top: insets.top + 8, backgroundColor }]}
  >
    <AppText weight="semibold" style={styles.white}>{title}</AppText>
    {body ? <AppText variant="caption" style={styles.white}>{body}</AppText> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    zIndex: 1000,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: 4,
  },
  white: { color: "#FFFFFF" },
});
