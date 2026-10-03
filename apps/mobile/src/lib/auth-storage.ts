import * as SecureStore from "expo-secure-store";
import type { AuthResponse } from "@leaguekick/contracts";

const SESSION_KEY = "leaguekick.auth.session.v1";

export async function readStoredSession(): Promise<AuthResponse | null> {
  try {
    const value = await SecureStore.getItemAsync(SESSION_KEY);
    return value ? (JSON.parse(value) as AuthResponse) : null;
  } catch {
    return null;
  }
}

export async function writeStoredSession(session: AuthResponse): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearStoredSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
