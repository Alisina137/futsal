import { Vazirmatn_400Regular, Vazirmatn_500Medium, Vazirmatn_600SemiBold, Vazirmatn_700Bold, useFonts } from "@expo-google-fonts/vazirmatn";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppCrashBoundary } from "../src/components/AppCrashBoundary";
import { ConnectivityBanner } from "../src/components/ConnectivityBanner";
import { AuthProvider } from "../src/providers/AuthProvider";
import { LocaleProvider } from "../src/providers/LocaleProvider";
import { NetworkProvider } from "../src/providers/NetworkProvider";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Vazirmatn_400Regular, Vazirmatn_500Medium, Vazirmatn_600SemiBold, Vazirmatn_700Bold });
  useEffect(() => { if (fontsLoaded || fontError) void SplashScreen.hideAsync(); }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError) return null;
  return <SafeAreaProvider><LocaleProvider><AppCrashBoundary><NetworkProvider><AuthProvider><StatusBar style="dark"/><ConnectivityBanner/><Stack screenOptions={{headerShown:false}} /></AuthProvider></NetworkProvider></AppCrashBoundary></LocaleProvider></SafeAreaProvider>;
}
