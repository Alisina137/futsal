import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale } from "../providers/LocaleProvider";
import { useNetwork } from "../providers/NetworkProvider";
import { AppText } from "./ui/AppText";

export function ConnectivityBanner() {
  const { isOnline, hasResolved, reconnectVersion } = useNetwork();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const mounted = useRef(false);
  useEffect(() => { if (!mounted.current) { mounted.current=true; return; } if (reconnectVersion > 0) { setShowBackOnline(true); const id=setTimeout(()=>setShowBackOnline(false),4000); return ()=>clearTimeout(id); } }, [reconnectVersion]);
  if (!hasResolved || (isOnline && !showBackOnline)) return null;
  const offline = !isOnline;
  return <View pointerEvents="none" style={[styles.container,{top:insets.top+8,backgroundColor:offline?colors.warning:colors.success}]}><AppText weight="semibold" style={styles.white}>{offline?t("network.offlineTitle"):t("network.backOnline")}</AppText>{offline?<AppText variant="caption" style={styles.white}>{t("network.offlineBody")}</AppText>:null}</View>;
}
const styles=StyleSheet.create({container:{position:"absolute",left:spacing.md,right:spacing.md,zIndex:1000,padding:spacing.md,borderRadius:radius.md,gap:4},white:{color:"#FFFFFF"}});
