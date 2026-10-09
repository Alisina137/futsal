import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/providers/AuthProvider";

const adminMode = process.env.EXPO_PUBLIC_ADMIN_MODE === "true";

export default function ProtectedLayout() {
  const { status } = useAuth();

  if (status === "anonymous") {
    return <Redirect href={adminMode ? { pathname: "/login", params: { next: "/admin" } } : "/login"} />;
  }

  return <Stack screenOptions={{ headerShown: false, animation: "none" }}>
    <Stack.Screen
      name="posts/[postId]/comments"
      options={{
        headerShown:false,
        presentation:"transparentModal",
        animation:"slide_from_bottom",
        gestureEnabled:false,
      }}
    />
  </Stack>;
}
