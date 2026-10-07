import { Vazirmatn_400Regular, Vazirmatn_500Medium, Vazirmatn_600SemiBold, Vazirmatn_700Bold, useFonts } from "@expo-google-fonts/vazirmatn";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AccountSuspensionOverlay } from "../src/components/AccountSuspensionOverlay";
import { AppCrashBoundary } from "../src/components/AppCrashBoundary";
import { ConnectivityBanner } from "../src/components/ConnectivityBanner";
import { AuthProvider } from "../src/providers/AuthProvider";
import { LocaleProvider } from "../src/providers/LocaleProvider";
import { NetworkProvider } from "../src/providers/NetworkProvider";

if (__DEV__) {
  LogBox.ignoreLogs(["Cannot connect to Expo CLI."]);
}

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Vazirmatn_400Regular, Vazirmatn_500Medium, Vazirmatn_600SemiBold, Vazirmatn_700Bold });
  useEffect(() => { if (fontsLoaded || fontError) void SplashScreen.hideAsync(); }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError) return null;
  return <SafeAreaProvider><LocaleProvider><AppCrashBoundary><NetworkProvider><AuthProvider><StatusBar style="dark"/><ConnectivityBanner/><AccountSuspensionOverlay/><Stack screenOptions={{headerShown:false,animation:"none"}} /></AuthProvider></NetworkProvider></AppCrashBoundary></LocaleProvider></SafeAreaProvider>;
}
