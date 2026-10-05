import { colors } from "@leaguekick/design-tokens";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/providers/AuthProvider";

const adminMode = process.env.EXPO_PUBLIC_ADMIN_MODE === "true";

export default function Index() {
  const { status } = useAuth();

  if (status === "hydrating") {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>;
  }

  if (status === "authenticated") {
    return <Redirect href={adminMode ? "/admin" : "/home"} />;
  }

  return <Redirect href={adminMode ? { pathname: "/login", params: { next: "/admin" } } : "/login"} />;
}
