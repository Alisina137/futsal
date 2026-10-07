import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/providers/AuthProvider";

const adminMode = process.env.EXPO_PUBLIC_ADMIN_MODE === "true";

export default function AuthLayout() {
  const { status } = useAuth();

  if (status === "authenticated") {
    return <Redirect href={adminMode ? "/admin" : "/home"} />;
  }

  return <Stack screenOptions={{ headerShown: false, animation: "none" }} />;
}
