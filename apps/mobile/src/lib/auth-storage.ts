import type { AuthResponse } from "@leaguekick/contracts";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SESSION_KEY = "leaguekick.auth.session.v1";

type BrowserStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function browserStorage(): BrowserStorage | null {
  if (Platform.OS !== "web") return null;
  try {
    const stores=globalThis as unknown as {
      localStorage?:BrowserStorage;sessionStorage?:BrowserStorage;
    };
    if(process.env.EXPO_PUBLIC_ADMIN_MODE==="true"){
      // Admin credentials never persist beyond the current browser session.
      // Erase older localStorage credentials left by previous admin builds.
      stores.localStorage?.removeItem(SESSION_KEY);
      return stores.sessionStorage??null;
    }
    return stores.localStorage??null;
  } catch {
    return null;
  }
}

export async function readStoredSession(): Promise<AuthResponse | null> {
  try {
    const storage = browserStorage();
    const value = storage
      ? storage.getItem(SESSION_KEY)
      : await SecureStore.getItemAsync(SESSION_KEY);
    return value ? (JSON.parse(value) as AuthResponse) : null;
  } catch {
    return null;
  }
}

export async function writeStoredSession(session: AuthResponse): Promise<void> {
  const value = JSON.stringify(session);
  const storage = browserStorage();

  if (storage) {
    storage.setItem(SESSION_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(SESSION_KEY, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearStoredSession(): Promise<void> {
  const storage = browserStorage();

  if (storage) {
    storage.removeItem(SESSION_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(SESSION_KEY);
}
