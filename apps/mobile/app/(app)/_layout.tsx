import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/providers/AuthProvider";

const adminMode = process.env.EXPO_PUBLIC_ADMIN_MODE === "true";

export default function ProtectedLayout() {
  const { status } = useAuth();

  if (status === "anonymous") {
    return <Redirect href={adminMode ? { pathname: "/login", params: { next: "/admin" } } : "/login"} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
